import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repoMocks = vi.hoisted(() => ({
  listOperations: vi.fn(),
  getOperation: vi.fn(),
  prepareOperation: vi.fn(),
  submitOperation: vi.fn(),
  decideOperation: vi.fn(),
  executeOperation: vi.fn(),
  reconcileOperation: vi.fn(),
  reconcileFromWebhook: vi.fn(),
  getWebhookReadiness: vi.fn(),
  recoverStaleExecutions: vi.fn(),
  listApprovedOperationIds: vi.fn(),
}));

const syncMocks = vi.hoisted(() => ({
  resolveGhlSyncRuntimeConfig: vi.fn(),
}));

vi.mock('../repository', () => repoMocks);
vi.mock('../../ghl-sync/repository', () => ({
  resolveGhlSyncRuntimeConfig: syncMocks.resolveGhlSyncRuntimeConfig,
}));

import type { SessionContext } from '@shared/auth';
import * as service from '../service';

function session(role: string, userId = 'user-1'): SessionContext {
  return {
    role,
    humanUserId: userId,
    agentRepId: 'agent-1',
    tenantKey: 'tenant-a',
  };
}

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'operation-1',
    tenantKey: 'tenant-a',
    eventId: 'event-1',
    commercialPlanId: null,
    leadId: 'lead-1',
    stitchiActionRunId: null,
    operationType: 'contact_upsert',
    status: 'previewed',
    reconciliationStatus: 'pending',
    idempotencyKey: 'server-derived',
    previewHash: 'a'.repeat(64),
    version: 1,
    preview: {
      operationType: 'contact_upsert',
      summary: {
        title: 'Create customer in GHL',
        customer: 'Customer One',
      },
      blockers: [],
    },
    providerObjectId: null,
    requestedByUserId: 'user-1',
    approvedByUserId: null,
    ...overrides,
  };
}

describe('GHL operations service boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.recoverStaleExecutions.mockResolvedValue(0);
    repoMocks.listApprovedOperationIds.mockResolvedValue([]);
    repoMocks.getWebhookReadiness.mockResolvedValue({
      verifiedEventCount: 0,
      lastVerifiedAt: null,
    });
    syncMocks.resolveGhlSyncRuntimeConfig.mockResolvedValue({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: null,
      locationId: null,
      source: 'not_configured',
    });
  });

  afterEach(() => {
    delete process.env.GHL_BREAK_GLASS_EXECUTION_ENABLED;
    delete process.env.GHL_WEBHOOK_ENABLED;
  });

  it('returns read-only capability data without making provider calls or throwing 403', async () => {
    const result = await service.referenceData(session('viewer'));

    expect(result).toMatchObject({
      status: 'read_only',
      capabilities: {
        read: true,
        prepare: false,
        approve: false,
        execute: false,
        sendWhatsApp: false,
      },
      executionReadiness: {
        workerEnabled: false,
        webhook: {
          enabled: false,
          liveVerified: false,
          state: 'setup_required',
        },
      },
      tags: [],
      pipelines: [],
      calendars: [],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    });
  });

  it('restricts consequential operation details for unrelated read-only users', async () => {
    repoMocks.listOperations.mockResolvedValue([operation({ requestedByUserId: 'another-user' })]);

    const [viewerResult] = await service.list(session('viewer'), {});
    expect(viewerResult.preview).toEqual({
      operationType: 'contact_upsert',
      status: 'previewed',
      summary: { title: 'Governed CRM operation' },
      detailsRestricted: true,
    });

    repoMocks.listOperations.mockResolvedValue([operation()]);
    const [requesterResult] = await service.list(session('sales_manager'), {});
    expect(requesterResult.preview).toMatchObject({
      summary: { customer: 'Customer One' },
    });
  });

  it('blocks manual browser-style execution unless break-glass is explicitly enabled', async () => {
    await expect(
      service.execute(session('cco'), 'operation-1', {
        previewHash: 'a'.repeat(64),
        expectedVersion: 1,
      }),
    ).rejects.toThrow(
      'Manual CRM execution is disabled. Approved work is executed by the governed server worker.',
    );
    expect(repoMocks.executeOperation).not.toHaveBeenCalled();
  });

  it('denies operation preparation to read-only roles before any repository write', async () => {
    await expect(
      service.prepare(session('viewer'), {
        action: {
          type: 'contact_upsert',
          leadId: '11111111-1111-4111-8111-111111111111',
        },
      }),
    ).rejects.toThrow("does not have permission 'ghl-operations:prepare'");
    expect(repoMocks.prepareOperation).not.toHaveBeenCalled();
  });

  it('recovers stale leases and processes approved work through the server queue', async () => {
    repoMocks.recoverStaleExecutions.mockResolvedValue(2);
    repoMocks.listApprovedOperationIds.mockResolvedValue([
      {
        tenantKey: 'tenant-a',
        requestedByUserId: 'user-1',
        id: 'operation-1',
        previewHash: 'a'.repeat(64),
        version: 3,
      },
    ]);
    repoMocks.executeOperation.mockResolvedValue(
      operation({
        status: 'provider_accepted',
        operationType: 'contact_upsert',
        version: 4,
      }),
    );
    repoMocks.reconcileOperation.mockResolvedValue(operation({ status: 'reconciled', version: 5 }));

    await expect(service.processApprovedQueue()).resolves.toEqual({
      recovered: 2,
      attempted: 1,
      completed: 1,
    });
    expect(repoMocks.executeOperation).toHaveBeenCalledOnce();
    expect(repoMocks.reconcileOperation).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'operation-1',
      { expectedVersion: 4 },
      expect.any(Function),
    );
  });

  it('classifies a signed appointment callback for tenant-scoped reconciliation', async () => {
    syncMocks.resolveGhlSyncRuntimeConfig.mockResolvedValue({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-secret',
      locationId: 'location-1',
      source: 'tenant_vault',
    });
    repoMocks.reconcileFromWebhook.mockResolvedValue({
      duplicate: false,
      operation: operation({
        operationType: 'appointment_upsert',
        status: 'reconciled',
      }),
    });
    const rawBody = Buffer.from(
      JSON.stringify({
        type: 'AppointmentUpdate',
        locationId: 'location-1',
        webhookId: 'delivery-1',
        appointment: {
          id: 'appointment-1',
          appointmentStatus: 'confirmed',
          dateUpdated: new Date().toISOString(),
        },
      }),
    );

    await expect(
      service.processWebhook({ tenantKey: 'tenant-a', rawBody }),
    ).resolves.toMatchObject({
      duplicate: false,
      operation: { operationType: 'appointment_upsert' },
    });
    expect(repoMocks.reconcileFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantKey: 'tenant-a',
        providerEventId: 'delivery-1',
        eventType: 'AppointmentUpdate',
        providerObjectId: 'appointment-1',
        operationTypes: ['appointment_upsert'],
        providerField: 'provider_appointment_id',
        locationId: 'location-1',
        summary: expect.objectContaining({
          signatureVerified: true,
          rawPayloadStored: false,
        }),
      }),
    );
  });
});
