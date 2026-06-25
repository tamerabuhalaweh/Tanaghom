import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type {
  CreateApprovalInput, ApprovalDecisionInput, EscalationInput, CancellationInput,
  ApprovalDecisionPacket, ApprovalSummary, ApprovalStatus,
} from './types';
import { getRoutingRule, validateApprovalTransition } from './types';

export async function createApproval(input: CreateApprovalInput): Promise<ApprovalSummary> {
  const routingRule = getRoutingRule(input.riskCategory, input.targetType);

  const approval = await prisma.approval.create({
    data: {
      target_type: input.targetType,
      target_id: input.targetId,
      saif_decision_record_id: input.saifDecisionRecordId,
      requester_user_id: input.requesterUserId,
      requester_agent_rep_id: input.requesterAgentRepId,
      approval_type: input.approvalType || routingRule?.approvalType || 'department_review',
      risk_category: input.riskCategory,
      required_department: input.requiredDepartment || routingRule?.requiredDepartment,
      required_role: input.requiredRole || routingRule?.requiredRole,
      comment: input.comment,
    },
  });
  return mapApproval(approval);
}

export async function getApprovalById(id: string): Promise<ApprovalSummary> {
  const approval = await prisma.approval.findUnique({ where: { id } });
  if (!approval) throw new NotFoundError('Approval', id);
  return mapApproval(approval);
}

export async function listApprovals(filters?: {
  targetId?: string;
  targetType?: string;
  approvalStatus?: string;
  requesterUserId?: string;
  approverUserId?: string;
  requiredDepartment?: string;
}): Promise<ApprovalSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.targetId) where.target_id = filters.targetId;
  if (filters?.targetType) where.target_type = filters.targetType;
  if (filters?.approvalStatus) where.approval_status = filters.approvalStatus;
  if (filters?.requesterUserId) where.requester_user_id = filters.requesterUserId;
  if (filters?.approverUserId) where.approver_user_id = filters.approverUserId;
  if (filters?.requiredDepartment) where.required_department = filters.requiredDepartment;

  const approvals = await prisma.approval.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return approvals.map(mapApproval);
}

export async function getApprovalDecisionPacket(id: string): Promise<ApprovalDecisionPacket> {
  const approval = await prisma.approval.findUnique({ where: { id } });
  if (!approval) throw new NotFoundError('Approval', id);

  const summary = mapApproval(approval);
  let contentItem: Record<string, unknown> | null = null;
  let campaign: Record<string, unknown> | null = null;
  let latestDraftVersion: Record<string, unknown> | null = null;

  if (summary.targetType === 'content_item') {
    contentItem = await prisma.contentItem.findUnique({
      where: { id: summary.targetId },
      include: {
        request: true,
        draft_versions: { orderBy: { version_no: 'desc' }, take: 1 },
      },
    }) as Record<string, unknown> | null;
    if (contentItem) {
      campaign = contentItem.request as Record<string, unknown>;
      const versions = contentItem.draft_versions as Record<string, unknown>[] | undefined;
      latestDraftVersion = versions?.[0] ?? null;
    }
  } else if (summary.targetType === 'campaign') {
    campaign = await prisma.contentRequest.findUnique({ where: { id: summary.targetId } }) as Record<string, unknown> | null;
  } else if (summary.targetType === 'draft_version') {
    latestDraftVersion = await prisma.draftVersion.findUnique({
      where: { id: summary.targetId },
      include: { content_item: { include: { request: true } } },
    }) as Record<string, unknown> | null;
    const item = latestDraftVersion?.content_item as Record<string, unknown> | undefined;
    contentItem = item ?? null;
    campaign = item?.request as Record<string, unknown> | undefined ?? null;
  }

  const campaignId = campaign?.id as string | undefined;
  const contentItemId = contentItem?.id as string | undefined;
  const packages = await prisma.publishingPackage.findMany({
    where: {
      OR: [
        { approval_id: summary.id },
        ...(campaignId ? [{ campaign_id: campaignId }] : []),
        ...(contentItemId ? [{ content_item_id: contentItemId }] : []),
      ],
    },
    orderBy: { created_at: 'desc' },
    take: 5,
  });

  return {
    approval: summary,
    campaign: campaign ? {
      id: campaign.id as string,
      topic: campaign.raw_message as string,
      objective: campaign.objective as string,
      audience: campaign.audience as string | null,
      platforms: campaign.target_platforms as string[],
      cta: campaign.cta as string | null,
      riskCategory: campaign.risk_category as string,
      status: campaign.status as string,
    } : null,
    contentItem: contentItem ? {
      id: contentItem.id as string,
      platform: contentItem.platform as string,
      contentType: contentItem.content_type as string,
      draftText: contentItem.draft_text as string,
      riskScore: contentItem.risk_score as number,
      riskReason: contentItem.risk_reason as string | null,
      reachScore: contentItem.reach_score as number,
      reachBreakdown: contentItem.reach_breakdown,
      status: contentItem.status as string,
    } : null,
    latestDraftVersion: latestDraftVersion ? {
      id: latestDraftVersion.id as string,
      versionNo: latestDraftVersion.version_no as number,
      text: latestDraftVersion.text as string,
      modelUsed: latestDraftVersion.model_used as string | null,
      createdAt: latestDraftVersion.created_at as Date,
    } : null,
    publishingPackages: packages.map((pkg: Record<string, unknown>) => ({
      id: pkg.id as string,
      status: pkg.package_status as string,
      readinessScore: pkg.readiness_score as number | null,
      readinessSummary: pkg.readiness_summary as string | null,
      createdAt: pkg.created_at as Date,
    })),
    safety: {
      humanApprovalRequired: true,
      externalExecutionBlocked: true,
      m5Disabled: true,
    },
  };
}

export async function approve(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'approved');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'approved',
      decision: input.decision || 'approved',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function reject(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'rejected');

  if (!input.comment) {
    throw new ForbiddenError('Rejection requires a comment');
  }

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'rejected',
      decision: 'rejected',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function requestChanges(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'changes_requested');

  if (!input.comment) {
    throw new ForbiddenError('Requesting changes requires a comment');
  }

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'changes_requested',
      decision: 'changes_requested',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function escalate(id: string, input: EscalationInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'escalated');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approval_status: 'escalated',
      escalated_at: new Date(),
      comment: input.reason || 'Escalated',
    },
  });
  return mapApproval(approval);
}

export async function cancel(id: string, input: CancellationInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'cancelled');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approval_status: 'cancelled',
      comment: input.reason || 'Cancelled',
    },
  });
  return mapApproval(approval);
}

function mapApproval(a: Record<string, unknown>): ApprovalSummary {
  return {
    id: a.id as string,
    targetType: a.target_type as ApprovalSummary['targetType'],
    targetId: a.target_id as string,
    saifDecisionRecordId: a.saif_decision_record_id as string | null,
    requesterUserId: a.requester_user_id as string,
    requesterAgentRepId: a.requester_agent_rep_id as string,
    approverUserId: a.approver_user_id as string | null,
    approverAgentRepId: a.approver_agent_rep_id as string | null,
    approvalType: a.approval_type as ApprovalSummary['approvalType'],
    approvalStatus: a.approval_status as ApprovalSummary['approvalStatus'],
    decision: a.decision as string | null,
    comment: a.comment as string | null,
    rationale: a.rationale as string | null,
    riskCategory: a.risk_category as ApprovalSummary['riskCategory'],
    requiredDepartment: a.required_department as string | null,
    requiredRole: a.required_role as string | null,
    requestedAt: a.requested_at as Date,
    decidedAt: a.decided_at as Date | null,
    expiresAt: a.expires_at as Date | null,
    escalatedAt: a.escalated_at as Date | null,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}
