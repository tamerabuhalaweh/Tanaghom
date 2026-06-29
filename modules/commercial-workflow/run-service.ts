import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import type { SessionContext } from '@shared/auth';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import type { WorkflowAuditInput } from './evidence';
import { getCommercialWorkflowState } from './service';
import type { CommercialWorkflowStage, CommercialWorkflowState, WorkflowStageId, WorkflowStageState } from './workflow-state';

type RunStatus = 'active' | 'blocked' | 'completed' | 'cancelled';

export interface CommercialWorkflowRunSummary {
  id: string;
  tenantKey: string;
  campaignId: string | null;
  status: RunStatus;
  activeStage: WorkflowStageId;
  readinessScore: number;
  blockers: string[];
  source: 'STITCH';
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  steps: Array<{
    id: string;
    stageId: WorkflowStageId;
    status: WorkflowStageState;
    summary: string;
    blockingReason: string | null;
    evidenceCount: number;
    updatedAt: Date;
  }>;
  recentEvents: Array<{
    id: string;
    action: string;
    result: string;
    sourceModule: string | null;
    targetObjectType: string | null;
    targetObjectId: string | null;
    reason: string | null;
    createdAt: Date;
  }>;
}

export interface CommercialWorkflowSnapshot extends CommercialWorkflowState {
  workflowRun: CommercialWorkflowRunSummary | null;
}

export async function getCommercialWorkflowSnapshot(
  session: SessionContext,
  campaignId?: string,
): Promise<CommercialWorkflowSnapshot> {
  const state = await getCommercialWorkflowState(session, campaignId);
  const workflowRun = await syncCommercialWorkflowRun(session, state);
  return {
    ...state,
    workflowRun,
  };
}

export async function startCommercialWorkflowRun(
  session: SessionContext,
  campaignId?: string,
): Promise<CommercialWorkflowSnapshot> {
  return getCommercialWorkflowSnapshot(session, campaignId);
}

export async function listCommercialWorkflowRuns(session: SessionContext): Promise<CommercialWorkflowRunSummary[]> {
  const runs = await prisma.commercialWorkflowRun.findMany({
    where: { tenant_key: session.tenantKey },
    orderBy: { updated_at: 'desc' },
    take: 50,
    include: runInclude,
  });
  return runs.map(mapRun);
}

export async function syncCommercialWorkflowRunById(
  session: SessionContext,
  runId: string,
): Promise<CommercialWorkflowRunSummary> {
  const run = await prisma.commercialWorkflowRun.findFirst({
    where: { id: runId, tenant_key: session.tenantKey },
  });
  if (!run) throw new NotFoundError('CommercialWorkflowRun', runId);
  const state = await getCommercialWorkflowState(session, run.campaign_id || undefined);
  const synced = await syncCommercialWorkflowRun(session, state);
  if (!synced || synced.id !== runId) {
    const refreshed = await prisma.commercialWorkflowRun.findFirst({
      where: { id: runId, tenant_key: session.tenantKey },
      include: runInclude,
    });
    if (!refreshed) throw new NotFoundError('CommercialWorkflowRun', runId);
    return mapRun(refreshed);
  }
  return synced;
}

export async function recordCommercialWorkflowRunEventFromAudit(
  input: WorkflowAuditInput,
  auditRecordId?: string,
): Promise<void> {
  if (!input.humanUserId) return;
  const user = await prisma.user.findUnique({
    where: { id: input.humanUserId },
    select: { tenant_key: true },
  });
  if (!user) return;

  const campaignId = await resolveCampaignIdFromAuditTarget(input.targetObjectType || null, input.targetObjectId || null);
  if (!campaignId) return;

  const campaign = await prisma.contentRequest.findFirst({
    where: {
      id: campaignId,
      tenant_key: user.tenant_key,
    },
    select: { id: true },
  });
  if (!campaign) return;

  const run = await findOrCreateRun({
    tenantKey: user.tenant_key,
    campaignId,
    humanUserId: input.humanUserId,
    agentRepId: input.agentRepId || null,
  });

  await prisma.commercialWorkflowRunEvent.create({
    data: {
      run_id: run.id,
      audit_record_id: auditRecordId || null,
      action: input.action,
      result: input.result,
      source_module: input.sourceModule,
      target_object_type: input.targetObjectType || null,
      target_object_id: input.targetObjectId || null,
      reason: input.reason || null,
      metadata: {
        policyMatched: input.policyMatched || null,
        approvalId: input.approvalId || null,
        riskCategory: input.riskCategory || null,
      },
    },
  });
}

async function syncCommercialWorkflowRun(
  session: SessionContext,
  state: CommercialWorkflowState,
): Promise<CommercialWorkflowRunSummary | null> {
  const campaignId = state.activeCampaign?.id || null;
  if (!campaignId) return null;

  await assertCampaignBelongsToTenant(campaignId, session.tenantKey);
  const status = resolveRunStatus(state);
  const activeStage = resolveActiveStage(state.stages);
  const run = await findOrCreateRun({
    tenantKey: session.tenantKey,
    campaignId,
    humanUserId: session.humanUserId,
    agentRepId: session.agentRepId,
  });

  const updated = await prisma.commercialWorkflowRun.update({
    where: { id: run.id },
    data: {
      status,
      active_stage: activeStage,
      readiness_score: state.readiness.score,
      blockers: state.readiness.blockers,
      completed_at: status === 'completed' ? new Date() : null,
      metadata: ({
        nextAction: state.nextAction,
        sourceMode: state.mode,
        generatedAt: state.generatedAt,
        provider: state.provider,
        postiz: state.postiz,
        safety: {
          externalWritesBlocked: state.safety.externalWritesBlocked,
          m5Disabled: state.safety.m5Disabled,
        },
      } as unknown) as Prisma.InputJsonValue,
    },
  });

  await Promise.all(state.stages.map(stage => upsertWorkflowStep(updated.id, stage)));
  const hydrated = await prisma.commercialWorkflowRun.findUnique({
    where: { id: updated.id },
    include: runInclude,
  });
  if (!hydrated) throw new NotFoundError('CommercialWorkflowRun', updated.id);
  return mapRun(hydrated);
}

async function findOrCreateRun(input: {
  tenantKey: string;
  campaignId: string;
  humanUserId: string;
  agentRepId: string | null;
}) {
  await ensureTenantExists(input.tenantKey);
  const existing = await prisma.commercialWorkflowRun.findFirst({
    where: {
      tenant_key: input.tenantKey,
      campaign_id: input.campaignId,
      status: { in: ['active', 'blocked', 'completed'] },
    },
    orderBy: { updated_at: 'desc' },
  });
  if (existing) return existing;
  return prisma.commercialWorkflowRun.create({
    data: {
      tenant_key: input.tenantKey,
      campaign_id: input.campaignId,
      created_by_user_id: input.humanUserId,
      created_by_agent_rep_id: input.agentRepId,
      status: 'active',
      active_stage: 'brief',
      readiness_score: 0,
      blockers: [],
      metadata: {
        createdReason: 'Commercial/Social workflow run created by STITCH backend',
      },
    },
  });
}

async function upsertWorkflowStep(runId: string, stage: CommercialWorkflowStage): Promise<void> {
  const now = new Date();
  await prisma.commercialWorkflowStep.upsert({
    where: {
      run_id_stage_id: {
        run_id: runId,
        stage_id: stage.id,
      },
    },
    create: {
      run_id: runId,
      stage_id: stage.id,
      step_status: stage.state,
      summary: stage.summary,
      blocking_reason: stage.blockingReason || null,
      evidence_count: stage.evidenceCount,
      started_at: stage.state === 'waiting' ? null : now,
      completed_at: stage.state === 'done' ? now : null,
    },
    update: {
      step_status: stage.state,
      summary: stage.summary,
      blocking_reason: stage.blockingReason || null,
      evidence_count: stage.evidenceCount,
      completed_at: stage.state === 'done' ? now : null,
    },
  });
}

async function assertCampaignBelongsToTenant(campaignId: string, tenantKey: string): Promise<void> {
  const campaign = await prisma.contentRequest.findFirst({
    where: {
      id: campaignId,
      tenant_key: tenantKey,
    },
    select: { id: true },
  });
  if (!campaign) {
    throw new ForbiddenError('Campaign is not available in the current tenant workflow scope');
  }
}

async function resolveCampaignIdFromAuditTarget(
  targetObjectType: string | null,
  targetObjectId: string | null,
): Promise<string | null> {
  if (!targetObjectType || !targetObjectId) return null;
  if (targetObjectType === 'campaign' || targetObjectType === 'content_request') return targetObjectId;
  if (targetObjectType === 'content_item') {
    const item = await prisma.contentItem.findUnique({
      where: { id: targetObjectId },
      select: { request_id: true },
    });
    return item?.request_id || null;
  }
  if (targetObjectType === 'approval') {
    const approval = await prisma.approval.findUnique({
      where: { id: targetObjectId },
      select: { target_type: true, target_id: true },
    });
    if (!approval) return null;
    return resolveCampaignIdFromAuditTarget(approval.target_type === 'campaign' ? 'campaign' : approval.target_type, approval.target_id);
  }
  if (targetObjectType === 'publishing_package') {
    const pkg = await prisma.publishingPackage.findUnique({
      where: { id: targetObjectId },
      select: { campaign_id: true, content_item_id: true },
    });
    if (!pkg) return null;
    if (pkg.campaign_id) return pkg.campaign_id;
    return pkg.content_item_id ? resolveCampaignIdFromAuditTarget('content_item', pkg.content_item_id) : null;
  }
  return null;
}

async function ensureTenantExists(tenantKey: string): Promise<void> {
  await prisma.tenant.upsert({
    where: { tenant_key: tenantKey },
    create: {
      tenant_key: tenantKey,
      name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
      status: 'active',
    },
    update: {},
  });
}

function resolveRunStatus(state: CommercialWorkflowState): RunStatus {
  if (state.stages.every(stage => stage.state === 'done')) return 'completed';
  if (state.stages.some(stage => stage.state === 'blocked')) return 'blocked';
  return 'active';
}

function resolveActiveStage(stages: CommercialWorkflowStage[]): WorkflowStageId {
  return (stages.find(stage => stage.state === 'active')
    || stages.find(stage => stage.state === 'blocked')
    || stages.find(stage => stage.state === 'waiting')
    || stages[stages.length - 1]).id;
}

const runInclude = {
  steps: {
    orderBy: { stage_id: 'asc' as const },
  },
  events: {
    orderBy: { created_at: 'desc' as const },
    take: 10,
  },
};

function mapRun(run: {
  id: string;
  tenant_key: string;
  campaign_id: string | null;
  status: string;
  active_stage: string;
  readiness_score: number;
  blockers: string[];
  source: string;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  steps?: Array<{
    id: string;
    stage_id: string;
    step_status: string;
    summary: string;
    blocking_reason: string | null;
    evidence_count: number;
    updated_at: Date;
  }>;
  events?: Array<{
    id: string;
    action: string;
    result: string;
    source_module: string | null;
    target_object_type: string | null;
    target_object_id: string | null;
    reason: string | null;
    created_at: Date;
  }>;
}): CommercialWorkflowRunSummary {
  return {
    id: run.id,
    tenantKey: run.tenant_key,
    campaignId: run.campaign_id,
    status: run.status as RunStatus,
    activeStage: run.active_stage as WorkflowStageId,
    readinessScore: run.readiness_score,
    blockers: run.blockers,
    source: 'STITCH',
    startedAt: run.started_at,
    updatedAt: run.updated_at,
    completedAt: run.completed_at,
    steps: (run.steps || []).map(step => ({
      id: step.id,
      stageId: step.stage_id as WorkflowStageId,
      status: step.step_status as WorkflowStageState,
      summary: step.summary,
      blockingReason: step.blocking_reason,
      evidenceCount: step.evidence_count,
      updatedAt: step.updated_at,
    })),
    recentEvents: (run.events || []).map(event => ({
      id: event.id,
      action: event.action,
      result: event.result,
      sourceModule: event.source_module,
      targetObjectType: event.target_object_type,
      targetObjectId: event.target_object_id,
      reason: event.reason,
      createdAt: event.created_at,
    })),
  };
}
