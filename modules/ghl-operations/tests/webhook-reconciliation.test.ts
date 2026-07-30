import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMocks = vi.hoisted(() => ({
  ghlWebhookEvent: {
    createMany: vi.fn(),
    update: vi.fn(),
  },
  ghlOperationCommand: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  auditRecord: {
    create: vi.fn(),
  },
}));

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { reconcileFromWebhook } from '../repository';

function reconciledAppointment() {
  const now = new Date('2026-07-30T10:00:00.000Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenant_key: 'tenant-a',
    event_id: null,
    commercial_plan_id: null,
    lead_id: null,
    stitchi_action_run_id: null,
    operation_type: 'appointment_upsert',
    status: 'reconciled',
    reconciliation_status: 'confirmed',
    idempotency_key: 'appointment-acceptance',
    request_hash: 'a'.repeat(64),
    preview_hash: 'b'.repeat(64),
    version: 8,
    input_payload: {},
    preview_payload: {},
    provider_endpoint: '/calendars/events/appointments',
    provider_object_id: 'appointment-1',
    provider_contact_id: 'contact-1',
    provider_opportunity_id: null,
    provider_appointment_id: 'appointment-1',
    provider_message_id: null,
    provider_response_status: 201,
    provider_result: {},
    failure_reason: null,
    approval_id: null,
    capability_resolution_id: null,
    mcp_mediation_request_id: null,
    mcp_mediation_decision_id: null,
    requested_by_user_id: '22222222-2222-4222-8222-222222222222',
    requested_by_agent_rep_id: '33333333-3333-4333-8333-333333333333',
    approved_by_user_id: null,
    approved_by_agent_rep_id: null,
    approved_at: now,
    executed_at: now,
    execution_lease_id: null,
    execution_lease_expires_at: null,
    reconciled_at: now,
    expires_at: new Date('2026-07-31T10:00:00.000Z'),
    attempt_count: 1,
    raw_secrets_returned: false,
    created_at: now,
    updated_at: now,
  };
}

describe('GHL signed webhook reconciliation evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.$transaction.mockImplementation(
      async (callback: (tx: typeof txMocks) => Promise<unknown>) => callback(txMocks),
    );
    txMocks.ghlWebhookEvent.createMany.mockResolvedValue({ count: 1 });
    txMocks.ghlOperationCommand.findFirst.mockResolvedValue(reconciledAppointment());
    txMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
    txMocks.ghlWebhookEvent.update.mockResolvedValue({ id: 'webhook-1' });
  });

  it('links a verified callback to an already reconciled command without re-executing it', async () => {
    const result = await reconcileFromWebhook({
      tenantKey: 'tenant-a',
      providerEventId: 'delivery-1',
      eventType: 'AppointmentUpdate',
      payloadHash: 'c'.repeat(64),
      providerObjectId: 'appointment-1',
      operationTypes: ['appointment_upsert'],
      providerField: 'provider_appointment_id',
      locationId: 'location-1',
      summary: {
        providerStatus: 'confirmed',
        signatureVerified: true,
        rawPayloadStored: false,
      },
    });

    expect(result).toMatchObject({
      duplicate: false,
      operation: {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'reconciled',
      },
    });
    expect(txMocks.ghlOperationCommand.update).not.toHaveBeenCalled();
    expect(txMocks.auditRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ghl_operation_webhook_confirmed',
          result: 'success',
        }),
      }),
    );
    expect(txMocks.ghlWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processing_status: 'processed',
          error_summary: null,
          summary: expect.objectContaining({
            matchedOperationId: '11111111-1111-4111-8111-111111111111',
            processingOutcome: 'provider_confirmation_recorded',
          }),
        }),
      }),
    );
  });

  it('deduplicates a repeated provider delivery', async () => {
    txMocks.ghlWebhookEvent.createMany.mockResolvedValue({ count: 0 });

    await expect(
      reconcileFromWebhook({
        tenantKey: 'tenant-a',
        providerEventId: 'delivery-1',
        eventType: 'AppointmentUpdate',
        payloadHash: 'c'.repeat(64),
        providerObjectId: 'appointment-1',
        operationTypes: ['appointment_upsert'],
        providerField: 'provider_appointment_id',
        locationId: 'location-1',
        summary: {},
      }),
    ).resolves.toEqual({ duplicate: true, operation: null });
    expect(txMocks.ghlOperationCommand.findFirst).not.toHaveBeenCalled();
  });
});
