import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMocks = vi.hoisted(() => ({
  capability: { upsert: vi.fn() },
  executionPattern: { findFirst: vi.fn(), create: vi.fn() },
  implementation: { findFirst: vi.fn(), create: vi.fn() },
  mcpConnector: { upsert: vi.fn() },
  intent: { create: vi.fn() },
  objective: { create: vi.fn() },
  saifDecisionRecord: { create: vi.fn() },
  capabilityResolution: { create: vi.fn() },
  mcpMediationRequest: { create: vi.fn() },
  mcpMediationDecision: { create: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMock }));

import { createPublishingPackageGovernance } from '../governance';

describe('publishing package governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMocks));
    txMocks.capability.upsert.mockResolvedValue({ id: 'capability-id' });
    txMocks.executionPattern.findFirst.mockResolvedValue(null);
    txMocks.executionPattern.create.mockResolvedValue({ id: 'pattern-id' });
    txMocks.implementation.findFirst.mockResolvedValue(null);
    txMocks.implementation.create.mockResolvedValue({ id: 'implementation-id' });
    txMocks.mcpConnector.upsert.mockResolvedValue({ id: 'connector-id' });
    txMocks.intent.create.mockResolvedValue({ id: 'intent-id' });
    txMocks.objective.create.mockResolvedValue({ id: 'objective-id' });
    txMocks.saifDecisionRecord.create.mockResolvedValue({ id: 'saif-id' });
    txMocks.capabilityResolution.create.mockResolvedValue({ id: 'resolution-id' });
    txMocks.mcpMediationRequest.create.mockResolvedValue({ id: 'mediation-id' });
    txMocks.mcpMediationDecision.create.mockResolvedValue({ id: 'decision-id' });
  });

  it('creates SAIF, capability resolution, and MCP mediation links for a package', async () => {
    const result = await createPublishingPackageGovernance({
      humanUserId: '00000000-0000-0000-0000-000000000001',
      agentRepId: '00000000-0000-0000-0000-000000000002',
      campaignId: '00000000-0000-0000-0000-000000000003',
      contentItemId: '00000000-0000-0000-0000-000000000004',
      approvalId: '00000000-0000-0000-0000-000000000005',
      packageTitle: 'Production campaign',
    });

    expect(result).toEqual({
      saifDecisionRecordId: 'saif-id',
      capabilityResolutionId: 'resolution-id',
      mcpMediationRequestId: 'mediation-id',
      mcpMediationDecisionId: 'decision-id',
      mcpConnectorId: 'connector-id',
    });
    expect(txMocks.capability.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { name: 'PreparePublishingPackage' },
    }));
    expect(txMocks.mcpConnector.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        name: 'postiz_package_scheduling_mcp',
        supports_write: false,
        m5_allowed: false,
      }),
    }));
    expect(txMocks.mcpMediationRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requested_operation: 'prepare_schedule',
        request_status: 'approved',
        approval_id: '00000000-0000-0000-0000-000000000005',
        saif_decision_record_id: 'saif-id',
        capability_resolution_id: 'resolution-id',
      }),
    });
    expect(txMocks.mcpMediationDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mediation_request_id: 'mediation-id',
        decision: 'allow',
        policy_matched: 'approval_gated_prepare_schedule',
      }),
    });
  });
});
