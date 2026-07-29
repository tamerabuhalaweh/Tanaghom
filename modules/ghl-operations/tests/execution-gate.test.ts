import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMocks = vi.hoisted(() => ({
  ghlOperationCommand: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  auditRecord: {
    create: vi.fn(),
  },
}));

const prismaMocks = vi.hoisted(() => ({
  ghlOperationCommand: {
    findFirst: vi.fn(),
  },
  approval: { findFirst: vi.fn() },
  capabilityResolution: { findFirst: vi.fn() },
  mcpMediationRequest: { findFirst: vi.fn() },
  mcpMediationDecision: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const syncMocks = vi.hoisted(() => ({
  resolveGhlSyncRuntimeConfig: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('../../ghl-sync/repository', () => ({
  resolveGhlSyncRuntimeConfig: syncMocks.resolveGhlSyncRuntimeConfig,
}));

import type { GhlOperationsClient } from '../client';
import { executeOperation } from '../repository';

const operationId = '11111111-1111-4111-8111-111111111111';
const leadId = '22222222-2222-4222-8222-222222222222';
const previewHash = 'a'.repeat(64);

function approvedLegacySale() {
  const now = new Date();
  return {
    id: operationId,
    tenant_key: 'tenant-a',
    event_id: null,
    commercial_plan_id: null,
    lead_id: leadId,
    stitchi_action_run_id: null,
    operation_type: 'opportunity_upsert',
    status: 'approved',
    reconciliation_status: 'pending',
    idempotency_key: 'legacy-approved-sale',
    request_hash: 'b'.repeat(64),
    preview_hash: previewHash,
    version: 3,
    input_payload: {
      type: 'opportunity_upsert',
      leadId,
      pipelineId: 'pipeline-1',
      stageId: 'stage-sale',
      name: 'Partially paid ticket',
      status: 'open',
      monetaryValue: 1000,
      payment: {
        totalSaleValue: 1000,
        amountPaid: 400,
        outstandingBalance: 600,
        paymentStatus: 'partial',
        paymentDate: '2026-07-29T12:00:00.000Z',
        ticketQuantity: 1,
      },
      customFields: {},
    },
    preview_payload: {
      operationType: 'opportunity_upsert',
      provider: 'gohighlevel',
      providerEndpoint: '/opportunities/opportunity-1',
      resolvedOpportunityId: 'opportunity-1',
      providerPayload: {
        status: 'open',
        monetaryValue: 1000,
      },
      summary: { title: 'Update sale in GHL' },
      blockers: [],
      readyForApproval: true,
      rawSecretsReturned: false,
    },
    provider_endpoint: '/opportunities/opportunity-1',
    provider_object_id: null,
    provider_contact_id: null,
    provider_opportunity_id: null,
    provider_appointment_id: null,
    provider_message_id: null,
    provider_response_status: null,
    provider_result: null,
    failure_reason: null,
    requested_by_user_id: 'user-1',
    requested_by_agent_rep_id: 'agent-1',
    approved_by_user_id: 'cco-1',
    approved_by_agent_rep_id: 'cco-agent-1',
    approval_id: null,
    capability_resolution_id: null,
    mcp_mediation_request_id: null,
    mcp_mediation_decision_id: null,
    approved_at: now,
    executed_at: null,
    reconciled_at: null,
    expires_at: new Date(now.getTime() + 60_000),
    attempt_count: 0,
    execution_lease_id: null,
    execution_lease_expires_at: null,
    created_at: now,
    updated_at: now,
  };
}

function providerClient(): GhlOperationsClient {
  return {
    referenceData: vi.fn(),
    upsertContact: vi.fn(),
    addTags: vi.fn(),
    removeTags: vi.fn(),
    createOpportunity: vi.fn(),
    updateOpportunity: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    sendWhatsApp: vi.fn(),
    getContact: vi.fn(),
    getOpportunity: vi.fn(),
    getAppointment: vi.fn(),
    getMessage: vi.fn(),
  };
}

describe('GHL execution safety gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.ghlOperationCommand.findFirst.mockResolvedValue(approvedLegacySale());
    syncMocks.resolveGhlSyncRuntimeConfig.mockResolvedValue({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'encrypted-runtime-secret',
      locationId: 'location-1',
      source: 'tenant_vault',
    });
    transactionMocks.ghlOperationCommand.updateMany.mockResolvedValue({ count: 1 });
    transactionMocks.ghlOperationCommand.findUniqueOrThrow.mockResolvedValue({
      ...approvedLegacySale(),
      status: 'blocked',
      version: 4,
      failure_reason: 'A partial or fully paid sale must use Won opportunity status',
    });
    transactionMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
    prismaMocks.$transaction.mockImplementation(
      async (callback: (tx: typeof transactionMocks) => Promise<unknown>) =>
        callback(transactionMocks),
    );
  });

  it('blocks a stale approved Open partial sale before any provider write and audits it', async () => {
    const client = providerClient();

    await expect(
      executeOperation(
        'tenant-a',
        'worker-user',
        operationId,
        { previewHash, expectedVersion: 3 },
        () => client,
      ),
    ).rejects.toThrow('A partial or fully paid sale must use Won opportunity status');

    expect(transactionMocks.ghlOperationCommand.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'blocked',
          failure_reason: expect.stringContaining(
            'A partial or fully paid sale must use Won opportunity status',
          ),
        }),
      }),
    );
    expect(transactionMocks.auditRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ghl_operation_blocked',
          result: 'blocked',
        }),
      }),
    );
    expect(client.createOpportunity).not.toHaveBeenCalled();
    expect(client.updateOpportunity).not.toHaveBeenCalled();
  });
});
