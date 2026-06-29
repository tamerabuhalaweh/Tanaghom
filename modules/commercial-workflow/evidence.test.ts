import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  auditRecord: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  contentRequest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  contentItem: {
    findMany: vi.fn(),
  },
  approval: {
    findMany: vi.fn(),
  },
  publishingPackage: {
    findMany: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({
  logger: {
    warn: vi.fn(),
  },
}));
vi.mock('./service', () => ({
  getCommercialWorkflowState: vi.fn(async () => ({
    generatedAt: '2026-06-27T12:00:00.000Z',
    activeCampaign: { id: '550e8400-e29b-41d4-a716-446655440000' },
    safety: {
      externalWritesBlocked: true,
      m5Disabled: true,
    },
  })),
}));

import { getCommercialWorkflowEvidence, recordCommercialWorkflowAudit } from './evidence';

const session = {
  humanUserId: '11111111-1111-4111-8111-111111111111',
  agentRepId: '22222222-2222-4222-8222-222222222222',
  role: 'admin',
  tenantKey: 'default',
};

describe('commercial workflow evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.user.findMany.mockResolvedValue([{ id: session.humanUserId }]);
    prismaMocks.contentRequest.findFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      raw_message: 'Campaign: CEO launch',
      objective: 'Objective: Generate qualified leads',
      channel: 'social_media',
      target_platforms: ['linkedin'],
    });
    prismaMocks.contentItem.findMany.mockResolvedValue([
      { id: '33333333-3333-4333-8333-333333333333', reach_score: 82 },
    ]);
    prismaMocks.approval.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        approval_status: 'approved',
      },
    ]);
    prismaMocks.publishingPackage.findMany.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
      },
    ]);
    prismaMocks.auditRecord.findMany.mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        action: 'draft_generated',
        result: 'success',
        target_object_type: 'content_item',
        target_object_id: '33333333-3333-4333-8333-333333333333',
        source_module: 'ai-generation',
        reason: 'Generated LinkedIn draft',
        created_at: new Date('2026-06-27T12:01:00.000Z'),
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        action: 'approval_submitted',
        result: 'success',
        target_object_type: 'approval',
        target_object_id: '44444444-4444-4444-8444-444444444444',
        source_module: 'approvals',
        reason: 'Approval submitted',
        created_at: new Date('2026-06-27T12:02:00.000Z'),
      },
    ]);
  });

  it('persists durable audit records for commercial workflow actions', async () => {
    await recordCommercialWorkflowAudit({
      action: 'publishing_package_blocked',
      result: 'blocked',
      humanUserId: session.humanUserId,
      agentRepId: session.agentRepId,
      targetObjectType: 'content_item',
      targetObjectId: '33333333-3333-4333-8333-333333333333',
      sourceModule: 'publishing-package',
      reason: 'Approval required',
      policyMatched: 'approval_required_before_package',
    });

    expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        audit_type: 'commercial_social_workflow',
        action: 'publishing_package_blocked',
        result: 'blocked',
        source_substrate: 'STITCH',
        source_module: 'publishing-package',
        policy_matched: 'approval_required_before_package',
      }),
    }));
  });

  it('reconstructs coverage from campaign records and persistent audit records', async () => {
    const evidence = await getCommercialWorkflowEvidence(session, '550e8400-e29b-41d4-a716-446655440000');

    expect(evidence.sourceOfTruth).toBe('STITCH');
    expect(evidence.campaign?.title).toBe('CEO launch');
    expect(evidence.coverage.requiredActions).toEqual([
      'draft_generated',
      'approval_submitted',
      'approval_decided',
      'publishing_package_created',
    ]);
    expect(evidence.coverage.recordedActions).toEqual(['draft_generated', 'approval_submitted']);
    expect(evidence.coverage.missingActions).toEqual(['approval_decided', 'publishing_package_created']);
    expect(evidence.stages.find(stage => stage.id === 'audit')).toMatchObject({
      state: 'active',
      evidenceCount: 2,
    });
    expect(evidence.safety.externalWritesBlocked).toBe(true);
    expect(evidence.safety.m5Disabled).toBe(true);
  });
});
