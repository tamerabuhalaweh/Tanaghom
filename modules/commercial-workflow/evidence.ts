import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import type { SessionContext } from '@shared/auth';
import { logger } from '@shared/logging';
import { getCommercialWorkflowState } from './service';
import { recordCommercialWorkflowRunEventFromAudit } from './run-service';

const SOCIAL_PLATFORMS = new Set(['linkedin', 'instagram', 'x', 'twitter', 'facebook', 'threads', 'tiktok', 'youtube']);

export type CommercialEvidenceStageState = 'complete' | 'active' | 'waiting' | 'blocked';

export interface WorkflowAuditInput {
  action: string;
  result: 'success' | 'failure' | 'blocked' | 'denied' | 'deferred' | 'escalated' | 'cancelled';
  humanUserId?: string | null;
  agentRepId?: string | null;
  targetObjectType?: string | null;
  targetObjectId?: string | null;
  sourceModule: string;
  reason?: string | null;
  rationale?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  riskCategory?: string | null;
  policyMatched?: string | null;
  approvalId?: string | null;
}

export async function recordCommercialWorkflowAudit(input: WorkflowAuditInput): Promise<void> {
  try {
    const auditRecord = await prisma.auditRecord.create({
      data: {
        audit_type: 'commercial_social_workflow',
        action: input.action,
        result: input.result,
        human_user_id: input.humanUserId || undefined,
        agent_rep_id: input.agentRepId || undefined,
        acting_agent_type: 'human',
        target_object_type: input.targetObjectType || undefined,
        target_object_id: input.targetObjectId || undefined,
        source_substrate: 'STITCH',
        source_module: input.sourceModule,
        reason: input.reason || undefined,
        rationale: input.rationale || undefined,
        before_state: input.beforeState as Prisma.InputJsonValue | undefined,
        after_state: input.afterState as Prisma.InputJsonValue | undefined,
        risk_category: input.riskCategory || undefined,
        policy_matched: input.policyMatched || undefined,
        approval_id: input.approvalId || undefined,
      },
    });
    await recordCommercialWorkflowRunEventFromAudit(input, auditRecord?.id);
  } catch (err) {
    logger.warn({ err, action: input.action, targetObjectId: input.targetObjectId }, 'Commercial workflow audit persistence failed');
  }
}

export async function getCommercialWorkflowEvidence(
  session: SessionContext,
  campaignId?: string,
) {
  const workflow = await getCommercialWorkflowState(session, campaignId);
  const campaign = await resolveCampaign(session, campaignId || workflow.activeCampaign?.id || null);

  if (!campaign) {
    return {
      sourceOfTruth: 'STITCH',
      mode: 'derived_from_database_records',
      generatedAt: workflow.generatedAt,
      campaign: null,
      coverage: {
        requiredActions: [],
        recordedActions: [],
        missingActions: ['campaign_selected'],
        score: 0,
      },
      stages: [
        stage('brief', 'Campaign brief', 'active', 0, 'Create or select a campaign before evidence can be reconstructed.'),
      ],
      actions: [],
      safety: {
        externalWritesBlocked: workflow.safety.externalWritesBlocked,
        m5Disabled: workflow.safety.m5Disabled,
      },
      _label: 'No Commercial/Social campaign evidence available yet',
    };
  }

  const contentItems = await prisma.contentItem.findMany({
    where: { request_id: campaign.id, tenant_key: session.tenantKey },
    orderBy: { created_at: 'desc' },
  });
  const contentItemIds = contentItems.map(item => item.id);
  const contentItemTargetClauses = contentItemIds.map(id => ({ target_type: 'content_item' as const, target_id: id }));

  const approvals = await prisma.approval.findMany({
    where: {
      tenant_key: session.tenantKey,
      OR: [
        { target_type: 'campaign' as const, target_id: campaign.id },
        ...contentItemTargetClauses,
      ],
    },
    orderBy: { created_at: 'desc' },
  });
  const approvalIds = approvals.map(approval => approval.id);

  const packages = await prisma.publishingPackage.findMany({
    where: {
      tenant_key: session.tenantKey,
      OR: [
        { campaign_id: campaign.id },
        ...contentItemIds.map(id => ({ content_item_id: id })),
      ],
    },
    orderBy: { created_at: 'desc' },
  });
  const packageIds = packages.map(pkg => pkg.id);

  const auditRecords = await prisma.auditRecord.findMany({
    where: {
      OR: [
        { target_object_type: 'content_request', target_object_id: campaign.id },
        { target_object_type: 'campaign', target_object_id: campaign.id },
        ...contentItemIds.map(id => ({ target_object_type: 'content_item', target_object_id: id })),
        ...approvalIds.map(id => ({ target_object_type: 'approval', target_object_id: id })),
        ...packageIds.map(id => ({ target_object_type: 'publishing_package', target_object_id: id })),
      ],
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  const recordedActions = Array.from(new Set(auditRecords.map(record => record.action)));
  const requiredActions = requiredWorkflowActions({
    draftCount: contentItems.length,
    approvalsCount: approvals.length,
    hasApprovedApproval: approvals.some(approval => approval.approval_status === 'approved'),
    packageCount: packages.length,
  });
  const missingActions = requiredActions.filter(action => !recordedActions.includes(action));
  const approved = approvals.some(approval => approval.approval_status === 'approved');

  return {
    sourceOfTruth: 'STITCH',
    mode: 'derived_from_database_records',
    generatedAt: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      title: campaignTitle(campaign.raw_message, campaign.objective),
      objective: campaignObjective(campaign.objective, campaign.raw_message),
    },
    coverage: {
      requiredActions,
      recordedActions,
      missingActions,
      score: requiredActions.length === 0
        ? 100
        : Math.round(((requiredActions.length - missingActions.length) / requiredActions.length) * 100),
    },
    stages: [
      stage('brief', 'Campaign brief', 'complete', 1, 'Campaign record exists in STITCH.'),
      stage('drafts', 'AI drafts', contentItems.length ? 'complete' : 'active', contentItems.length, contentItems.length
        ? `${contentItems.length} generated draft record(s) exist.`
        : 'Generate platform drafts from the campaign.'),
      stage('approval', 'Human approval', approvalState(approvals), approvals.length, approvalSummary(approvals)),
      stage('package', 'Publishing package', packages.length ? 'complete' : approved ? 'active' : 'waiting', packages.length, packages.length
        ? `${packages.length} publishing package record(s) exist.`
        : 'Approved content is required before package creation.'),
      stage('audit', 'Evidence trail', missingActions.length ? 'active' : 'complete', auditRecords.length, missingActions.length
        ? `${missingActions.length} expected action(s) have no persistent audit record yet.`
        : 'Required workflow actions are represented in persistent audit records.'),
    ],
    actions: auditRecords.map(record => ({
      id: record.id,
      action: record.action,
      result: record.result,
      targetObjectType: record.target_object_type,
      targetObjectId: record.target_object_id,
      sourceModule: record.source_module,
      reason: record.reason,
      createdAt: record.created_at,
    })),
    safety: {
      externalWritesBlocked: workflow.safety.externalWritesBlocked,
      m5Disabled: workflow.safety.m5Disabled,
    },
    _label: 'Commercial/Social evidence trail reconstructed from STITCH database records',
  };
}

async function resolveCampaign(session: SessionContext, campaignId: string | null) {
  if (campaignId) {
    return prisma.contentRequest.findFirst({
      where: {
        id: campaignId,
        tenant_key: session.tenantKey,
      },
    });
  }

  const campaigns = await prisma.contentRequest.findMany({
    where: {
      tenant_key: session.tenantKey,
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return campaigns.find(campaign => campaign.channel === 'social_media'
    || campaign.target_platforms.some(platform => SOCIAL_PLATFORMS.has(platform.toLowerCase()))) || null;
}

function requiredWorkflowActions(facts: {
  draftCount: number;
  approvalsCount: number;
  hasApprovedApproval: boolean;
  packageCount: number;
}): string[] {
  const required: string[] = [];
  if (facts.draftCount > 0) required.push('draft_generated');
  if (facts.approvalsCount > 0) required.push('approval_submitted');
  if (facts.hasApprovedApproval) required.push('approval_decided');
  if (facts.packageCount > 0) required.push('publishing_package_created');
  return required;
}

function stage(
  id: string,
  label: string,
  state: CommercialEvidenceStageState,
  evidenceCount: number,
  summary: string,
) {
  return { id, label, state, evidenceCount, summary };
}

function approvalState(approvals: Array<{ approval_status: string }>): CommercialEvidenceStageState {
  if (approvals.some(approval => approval.approval_status === 'approved')) return 'complete';
  if (approvals.some(approval => approval.approval_status === 'pending')) return 'active';
  if (approvals.some(approval => approval.approval_status === 'rejected' || approval.approval_status === 'changes_requested')) return 'blocked';
  return 'waiting';
}

function approvalSummary(approvals: Array<{ approval_status: string }>): string {
  if (approvals.some(approval => approval.approval_status === 'approved')) return 'A human approval decision is recorded.';
  if (approvals.some(approval => approval.approval_status === 'pending')) return 'A reviewer decision is pending.';
  if (approvals.some(approval => approval.approval_status === 'rejected' || approval.approval_status === 'changes_requested')) {
    return 'Reviewer requested changes or rejected the draft.';
  }
  return 'Submit the selected draft for human approval.';
}

function campaignTitle(rawMessage: string, objective: string): string {
  const match = `${objective}\n${rawMessage}`.match(/Campaign:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return rawMessage.split('\n')[0]?.trim() || objective.split('\n')[0]?.trim() || 'Commercial/Social campaign';
}

function campaignObjective(objective: string, rawMessage: string): string {
  const match = `${objective}\n${rawMessage}`.match(/Objective:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return objective.split('\n')[0]?.trim() || rawMessage.split('\n')[0]?.trim() || 'Campaign objective pending';
}
