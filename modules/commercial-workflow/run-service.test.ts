import { beforeEach, describe, expect, it, vi } from 'vitest';

const campaignId = '550e8400-e29b-41d4-a716-446655440000';
const userId = '11111111-1111-4111-8111-111111111111';
const agentRepId = '22222222-2222-4222-8222-222222222222';
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const prismaMocks = vi.hoisted(() => ({
  tenant: {
    upsert: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  contentRequest: {
    findFirst: vi.fn(),
  },
  contentItem: {
    findUnique: vi.fn(),
  },
  approval: {
    findUnique: vi.fn(),
  },
  publishingPackage: {
    findUnique: vi.fn(),
  },
  commercialWorkflowRun: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  commercialWorkflowStep: {
    upsert: vi.fn(),
  },
  commercialWorkflowRunEvent: {
    create: vi.fn(),
  },
}));

const workflowState = vi.hoisted(() => ({
  sourceOfTruth: 'STITCH' as const,
  generatedAt: '2026-06-29T10:00:00.000Z',
  mode: 'derived_from_backend_records' as const,
  activeCampaign: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'CEO launch campaign',
    objective: 'Generate qualified leads',
    status: 'pending_review',
    riskCategory: 'medium',
    platforms: ['linkedin', 'instagram', 'x'],
  },
  counts: {
    activeCampaigns: 1,
    generatedDrafts: 3,
    scoredDrafts: 1,
    pendingApprovals: 1,
    approvedApprovals: 0,
    publishingPackages: 0,
    analyticsReports: 0,
    capturedLeads: 0,
    qualifiedLeads: 0,
  },
  readiness: {
    score: 44,
    blockers: ['External execution kill switch is disabled.'],
  },
  nextAction: {
    label: 'Human approval',
    href: '/approvals',
    reason: 'The selected draft is waiting for a human decision.',
  },
  stages: [
    { id: 'brief', label: 'Campaign brief', state: 'done', summary: 'Brief exists.', evidenceCount: 1 },
    { id: 'draft', label: 'AI drafts', state: 'done', summary: 'Drafts exist.', evidenceCount: 3 },
    { id: 'optimize', label: 'Optimize', state: 'done', summary: 'Draft scored.', evidenceCount: 1 },
    { id: 'approval', label: 'Human approval', state: 'active', summary: 'Waiting for human review.', evidenceCount: 1 },
    { id: 'package', label: 'Publishing package', state: 'waiting', summary: 'Approval required.', evidenceCount: 0 },
    { id: 'postiz', label: 'Postiz sandbox', state: 'waiting', summary: 'Package required.', evidenceCount: 0 },
    { id: 'analytics', label: 'Analytics', state: 'waiting', summary: 'Package required.', evidenceCount: 0 },
    { id: 'leads', label: 'Lead handoff', state: 'waiting', summary: 'Package required.', evidenceCount: 0 },
    { id: 'evidence', label: 'Evidence', state: 'done', summary: 'Evidence exists.', evidenceCount: 5 },
  ],
  provider: {
    ready: true,
    label: 'DeepSeek / deepseek-chat',
    provider: 'deepseek',
    credentialStatus: 'configured' as const,
  },
  postiz: {
    serverReachable: true,
    credentialStatus: 'missing' as const,
    integrationIdStatus: 'missing' as const,
    connectedChannelCount: 0,
    label: 'Requires Credentials' as const,
  },
  safety: {
    externalExecutionEnabled: false,
    m5WriteExecutionEnabled: false,
    demoMode: false,
    externalWritesBlocked: true,
    m5Disabled: true,
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('./service', () => ({
  getCommercialWorkflowState: vi.fn(async () => workflowState),
}));

import {
  getCommercialWorkflowSnapshot,
  recordCommercialWorkflowRunEventFromAudit,
} from './run-service';

const session = {
  humanUserId: userId,
  agentRepId,
  role: 'admin',
  tenantKey: 'customer-a',
};

function runRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    tenant_key: 'customer-a',
    campaign_id: campaignId,
    created_by_user_id: userId,
    created_by_agent_rep_id: agentRepId,
    status: 'active',
    active_stage: 'approval',
    readiness_score: 44,
    blockers: ['External execution kill switch is disabled.'],
    source: 'STITCH',
    started_at: new Date('2026-06-29T10:00:00.000Z'),
    updated_at: new Date('2026-06-29T10:01:00.000Z'),
    completed_at: null,
    steps: [],
    events: [],
    ...overrides,
  };
}

describe('commercial workflow run service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.user.findMany.mockResolvedValue([{ id: userId }]);
    prismaMocks.user.findUnique.mockResolvedValue({ tenant_key: 'customer-a' });
    prismaMocks.contentRequest.findFirst.mockResolvedValue({ id: campaignId });
    prismaMocks.tenant.upsert.mockResolvedValue({ tenant_key: 'customer-a' });
    prismaMocks.commercialWorkflowRun.findFirst.mockResolvedValue(null);
    prismaMocks.commercialWorkflowRun.create.mockResolvedValue(runRecord());
    prismaMocks.commercialWorkflowRun.update.mockResolvedValue(runRecord({ status: 'active', active_stage: 'approval' }));
    prismaMocks.commercialWorkflowRun.findUnique.mockResolvedValue(runRecord({
      steps: [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          stage_id: 'approval',
          step_status: 'active',
          summary: 'Waiting for human review.',
          blocking_reason: null,
          evidence_count: 1,
          updated_at: new Date('2026-06-29T10:01:00.000Z'),
        },
      ],
      events: [],
    }));
    prismaMocks.commercialWorkflowStep.upsert.mockResolvedValue({});
    prismaMocks.commercialWorkflowRunEvent.create.mockResolvedValue({});
  });

  it('starts and synchronizes one tenant-scoped workflow run for the selected campaign', async () => {
    const snapshot = await getCommercialWorkflowSnapshot(session, campaignId);

    expect(snapshot.workflowRun?.id).toBe(runId);
    expect(snapshot.workflowRun?.tenantKey).toBe('customer-a');
    expect(snapshot.workflowRun?.activeStage).toBe('approval');
    expect(prismaMocks.contentRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: campaignId,
        tenant_key: 'customer-a',
      },
    }));
    expect(prismaMocks.commercialWorkflowStep.upsert).toHaveBeenCalledTimes(workflowState.stages.length);
  });

  it('blocks workflow synchronization when the campaign is outside the tenant scope', async () => {
    prismaMocks.contentRequest.findFirst.mockResolvedValue(null);

    await expect(getCommercialWorkflowSnapshot(session, campaignId)).rejects.toThrow('Campaign is not available in the current tenant workflow scope');
  });

  it('links commercial audit events to the tenant workflow run when a campaign can be resolved', async () => {
    prismaMocks.commercialWorkflowRun.findFirst.mockResolvedValue(runRecord());
    prismaMocks.contentItem.findUnique.mockResolvedValue({ request_id: campaignId });

    await recordCommercialWorkflowRunEventFromAudit({
      action: 'draft_generated',
      result: 'success',
      humanUserId: userId,
      agentRepId,
      targetObjectType: 'content_item',
      targetObjectId: '33333333-3333-4333-8333-333333333333',
      sourceModule: 'ai-generation',
      reason: 'Generated LinkedIn draft',
    }, '99999999-9999-4999-8999-999999999999');

    expect(prismaMocks.commercialWorkflowRunEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        run_id: runId,
        audit_record_id: '99999999-9999-4999-8999-999999999999',
        action: 'draft_generated',
        result: 'success',
        source_module: 'ai-generation',
      }),
    }));
  });
});
