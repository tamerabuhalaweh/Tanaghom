import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn() },
  connectorFieldMapping: { findMany: vi.fn() },
  ghlLeadSyncRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  leadCaptureRecord: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  leadLifecycleEvent: { create: vi.fn() },
}));

const credentialMocks = vi.hoisted(() => ({
  getActiveIntegrationCredential: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('../../integration-credentials/service', () => credentialMocks);

import * as repo from '../repository';
import * as service from '../service';
import type { GhlClient } from '../client';

function mockRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    tenant_key: 'tenant-a',
    event_id: 'event-1',
    mode: 'pull_preview',
    status: 'previewed',
    contacts_pulled: 0,
    opportunities_pulled: 0,
    appointments_pulled: 0,
    leads_upserted: 0,
    tags_mapped: 0,
    stages_mapped: 0,
    write_backs_prepared: 0,
    errors: [],
    warnings: [],
    raw_payload_returned: false,
    started_at: new Date('2026-07-04T00:00:00Z'),
    completed_at: new Date('2026-07-04T00:00:01Z'),
    ...overrides,
  };
}

const mockClient: GhlClient = {
  pull: vi.fn(),
  upsertContact: vi.fn(),
};

describe('GHL Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GHL_READ_SYNC_ENABLED = 'true';
    process.env.GHL_WRITE_BACK_ENABLED = 'false';
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      id: 'cred-1',
      secrets: { apiKey: 'tenant-key', locationId: 'loc-1', baseUrl: 'https://services.leadconnectorhq.com' },
    });
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([
      {
        validation_status: 'valid',
        field_mappings: { mappingType: 'tag', ghlTagId: 'hot-tag', ghlTagName: 'Hot', internalTag: 'hot', direction: 'bidirectional' },
      },
      {
        validation_status: 'valid',
        field_mappings: { mappingType: 'pipeline', ghlStageId: 'stage-booked', ghlStageName: 'Booked', internalStage: 'meeting_booked' },
      },
    ]);
    prismaMocks.ghlLeadSyncRun.findFirst.mockResolvedValue(null);
    prismaMocks.ghlLeadSyncRun.create.mockImplementation(async ({ data }) => mockRun({
      ...data,
      id: 'run-1',
      started_at: new Date('2026-07-04T00:00:00Z'),
    }));
    prismaMocks.ghlLeadSyncRun.update.mockImplementation(async ({ data }) => mockRun({
      ...data,
      id: 'run-1',
      tenant_key: 'tenant-a',
      event_id: 'event-1',
      mode: 'pull_sync',
      started_at: new Date('2026-07-04T00:00:00Z'),
    }));
    prismaMocks.leadCaptureRecord.count.mockResolvedValue(0);
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    prismaMocks.leadCaptureRecord.create.mockResolvedValue({
      id: 'lead-1',
      lead_status: 'meeting_booked',
      lead_temperature: 'hot',
    });
    prismaMocks.leadCaptureRecord.update.mockResolvedValue({});
    prismaMocks.leadLifecycleEvent.create.mockResolvedValue({});
    vi.mocked(mockClient.pull).mockResolvedValue({
      contacts: [{
        id: 'contact-1',
        name: 'GHL Buyer',
        email: 'buyer@example.com',
        phone: '+971500000000',
        source: 'GHL Form',
        tags: ['Hot'],
      }],
      opportunities: [{
        id: 'opp-1',
        contactId: 'contact-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-booked',
        status: 'open',
        monetaryValue: 1000,
      }],
      appointments: [{
        id: 'appt-1',
        contactId: 'contact-1',
        status: 'confirmed',
        title: 'Strategy Call',
        startTime: '2026-08-01T11:00:00.000Z',
      }],
      warnings: [],
      rawReturned: false,
    });
    vi.mocked(mockClient.upsertContact).mockResolvedValue({ ok: true, status: 200, body: { id: 'contact-1' } });
  });

  it('reports GHL as source of truth and Tanaghum as operating/reporting layer', async () => {
    const status = await repo.getGhlSyncStatus('tenant-a', 'event-1');

    expect(status.sourceOfTruth).toBe('gohighlevel');
    expect(status.tanaghumRole).toBe('operating_reporting_layer');
    expect(status.credentialStatus).toBe('configured');
    expect(status.mappingStatus).toBe('ready');
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'event-1', tenant_key: 'tenant-a' },
    }));
  });

  it('blocks pull preview when tenant-owned GHL credentials are missing', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValueOnce(null);
    const result = await repo.previewPull('tenant-a', 'user-1', 'event-1', 25, () => mockClient);

    expect(result.run.status).toBe('requires_credentials');
    expect(mockClient.pull).not.toHaveBeenCalled();
    expect(prismaMocks.ghlLeadSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'requires_credentials',
        raw_payload_returned: false,
      }),
    }));
  });

  it('syncs GHL contacts into Tanaghum as GHL-owned lead mirrors', async () => {
    const result = await repo.syncPull('tenant-a', 'user-1', 'agent-1', 'event-1', 50, () => mockClient);

    expect(result.run.status).toBe('synced');
    expect(result.upserted).toHaveLength(1);
    expect(prismaMocks.leadCaptureRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_key: 'tenant-a',
        event_id: 'event-1',
        source_of_truth: 'gohighlevel',
        external_source_provider: 'gohighlevel',
        external_source_id: 'contact-1',
        external_opportunity_id: 'opp-1',
        lead_status: 'meeting_booked',
        lead_temperature: 'hot',
        meeting_date: new Date('2026-08-01T11:00:00.000Z'),
        meeting_type: 'Strategy Call',
        created_by_agent_rep_id: 'agent-1',
      }),
    }));
    expect(prismaMocks.ghlLeadSyncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'synced',
        leads_upserted: 1,
      }),
    }));
  });

  it('records appointment pull evidence and mirrors no-show meeting outcomes from GHL', async () => {
    vi.mocked(mockClient.pull).mockResolvedValueOnce({
      contacts: [{
        id: 'contact-2',
        name: 'No Show Buyer',
        email: 'noshow@example.com',
        phone: '+971511111111',
        source: 'GHL Calendar',
        tags: [],
      }],
      opportunities: [],
      appointments: [{
        id: 'appt-2',
        contactId: 'contact-2',
        status: 'no_show',
        title: 'Enrollment Call',
        startTime: '2026-08-03T14:00:00.000Z',
      }],
      warnings: [],
      rawReturned: false,
    });

    const result = await repo.syncPull('tenant-a', 'user-1', 'agent-1', 'event-1', 50, () => mockClient);

    expect(result.run.appointmentsPulled).toBe(1);
    expect(result.upserted[0]?.leadStatus).toBe('no_show');
    expect(prismaMocks.leadCaptureRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lead_status: 'no_show',
        meeting_date: new Date('2026-08-03T14:00:00.000Z'),
        meeting_type: 'Enrollment Call',
        meeting_outcome: 'no_show',
      }),
    }));
  });

  it('prepares write-back only for authorized roles', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValueOnce({
      id: 'lead-1',
      tenant_key: 'tenant-a',
      event_id: 'event-1',
      lead_status: 'purchased',
      lead_temperature: 'hot',
      external_source_id: 'contact-1',
      external_opportunity_id: 'opp-1',
      next_action: 'Send buyer onboarding',
    });

    await expect(service.writeBackPreview('sales_manager', 'tenant-a', 'user-1', { leadId: 'lead-1' })).rejects.toThrow(/permission/);
    const result = await service.writeBackPreview('admin', 'tenant-a', 'user-1', { leadId: 'lead-1' });

    expect(result.preview.execution).toBe('blocked');
    expect(result.preview.payload.tags).toContain('Hot');
  });

  it('executes write-back only when explicitly enabled and never returns raw GHL payload', async () => {
    process.env.GHL_WRITE_BACK_ENABLED = 'true';
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue({
      id: 'lead-1',
      tenant_key: 'tenant-a',
      event_id: 'event-1',
      lead_status: 'purchased',
      lead_temperature: 'hot',
      external_source_id: 'contact-1',
      external_opportunity_id: 'opp-1',
      next_action: 'Send buyer onboarding',
    });

    const result = await repo.executeWriteBack('tenant-a', 'user-1', 'lead-1', () => mockClient);

    expect(result.execution).toBe('executed');
    expect(result.reasons).toEqual([]);
    expect(result).not.toHaveProperty('body');
    expect(mockClient.upsertContact).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc-1',
      contactId: 'contact-1',
      tags: ['Hot'],
    }));
    expect(prismaMocks.ghlLeadSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'write_back',
        status: 'synced',
        raw_payload_returned: false,
      }),
    }));
  });

  it('does not call GHL write-back when the execution flag is disabled', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue({
      id: 'lead-1',
      tenant_key: 'tenant-a',
      event_id: 'event-1',
      lead_status: 'purchased',
      lead_temperature: 'hot',
      external_source_id: 'contact-1',
      external_opportunity_id: 'opp-1',
      next_action: 'Send buyer onboarding',
    });

    const result = await repo.executeWriteBack('tenant-a', 'user-1', 'lead-1', () => mockClient);

    expect(result.execution).toBe('blocked');
    expect(result.reasons).toContain('GHL_WRITE_BACK_ENABLED is not true.');
    expect(mockClient.upsertContact).not.toHaveBeenCalled();
  });
});
