import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  connectorImportJob: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  commercialEvent: { findFirst: vi.fn() },
  integrationCredential: { findFirst: vi.fn() },
  auditRecord: { create: vi.fn() },
  eventKpiRecord: { create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import * as repo from '../repository';
import { VALID_TRANSITIONS, SUPPORTED_CONNECTORS } from '../types';

function mockJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1', tenant_key: 'tenant-a', event_id: 'event-1', connector_id: 'postiz',
    display_name: 'Postiz Import', state: 'draft', credential_state: 'customer_credential_missing',
    notes: null, last_dry_run_at: null, last_dry_run_result: null,
    last_import_at: null, last_import_result: null,
    approved_by_user_id: null, approved_at: null,
    disabled_at: null, disabled_reason: null,
    created_by_user_id: 'user-1', created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

function sampleDryRunResult(overrides: Record<string, unknown> = {}) {
  return {
    connectorId: 'postiz',
    eventId: 'event-1',
    kpiRows: [
      {
        metricDate: '2026-07-01T00:00:00Z',
        channel: 'postiz',
        reach: 1500, impressions: 3200, interactions: 180, clicks: 45,
        formCompletions: 12, leads: 8, meetingsBooked: 3, meetingsAttended: 2,
        purchases: 1, noShows: 1, spend: 250, notes: 'Sample row 1',
      },
      {
        metricDate: '2026-06-30T00:00:00Z',
        channel: 'postiz',
        reach: 1200, impressions: 2800, interactions: 150, clicks: 38,
        formCompletions: 9, leads: 6, meetingsBooked: 2, meetingsAttended: 2,
        purchases: 0, noShows: 0, spend: 200, notes: 'Sample row 2',
      },
    ],
    leadAttributions: 0,
    warnings: ['Sample warning'],
    ...overrides,
  };
}

describe('Connector Imports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
  });

  describe('Readiness', () => {
    it('returns all supported connectors', async () => {
      const result = await repo.getReadiness('tenant-a');
      expect(result.connectors).toHaveLength(SUPPORTED_CONNECTORS.length);
    });

    it('reports customer_credential_missing when no credentials', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
      const result = await repo.getReadiness('tenant-a');
      for (const c of result.connectors) expect(c.credentialState).toBe('customer_credential_missing');
    });

    it('reports configured when credential exists but not validated', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: null });
      const result = await repo.getReadiness('tenant-a');
      expect(result.connectors.find(c => c.connectorId === 'postiz')?.credentialState).toBe('configured');
    });

    it('reports test_passed when credential validated', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: new Date() });
      const result = await repo.getReadiness('tenant-a');
      expect(result.connectors.find(c => c.connectorId === 'postiz')?.credentialState).toBe('test_passed');
    });
  });

  describe('Job creation', () => {
    it('rejects unsupported connector', async () => {
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.createJob('tenant-a', 'user-1', { connectorId: 'unsupported' as string, displayName: 'Test' })).rejects.toThrow(ValidationError);
    });

    it('validates event belongs to tenant', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test', eventId: 'event-x' })).rejects.toThrow(NotFoundError);
    });

    it('creates audit record on job creation', async () => {
      prismaMocks.connectorImportJob.create.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      await repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz' });
      expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'import_job_created' }),
      }));
    });
  });

  describe('Dry run', () => {
    it('rejects when credentials missing', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'requires_credentials' }));
      prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('persists last_dry_run_at and last_dry_run_result', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: new Date() });
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(prismaMocks.connectorImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          last_dry_run_at: expect.any(Date),
          last_dry_run_result: expect.objectContaining({ kpiRows: expect.any(Array) }),
        }),
      }));
    });

    it('produces sample KPI rows with real metrics', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: null });
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(result.kpiRows.length).toBeGreaterThan(0);
      expect(result.kpiRows[0].channel).toBe('postiz');
      expect(typeof result.kpiRows[0].reach).toBe('number');
      expect(typeof result.kpiRows[0].spend).toBe('number');
    });

    it('has no writes to EventKpiRecord', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: new Date() });
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(prismaMocks.eventKpiRecord.create).not.toHaveBeenCalled();
    });

    it('creates audit record', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: new Date() });
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(prismaMocks.auditRecord.create).toHaveBeenCalled();
    });
  });

  describe('Approve and import', () => {
    it('rejects when job not in test_passed state', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'draft' }));
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects when no dry run performed', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed', last_dry_run_result: null }));
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects when dry run has empty kpiRows', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed', last_dry_run_result: sampleDryRunResult({ kpiRows: [] }) }));
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('writes exact metrics from dry-run payload', async () => {
      const dryRun = sampleDryRunResult();
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed', last_dry_run_result: dryRun }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(result.imported.kpiRecords).toBe(2);
      // Verify first call uses exact metrics from dry-run
      const firstCall = prismaMocks.eventKpiRecord.create.mock.calls[0][0];
      expect(firstCall.data.reach).toBe(1500);
      expect(firstCall.data.impressions).toBe(3200);
      expect(firstCall.data.interactions).toBe(180);
      expect(firstCall.data.spend).toBe(250);
      expect(firstCall.data.channel).toBe('postiz');
      expect(firstCall.data.metric_date).toEqual(new Date('2026-07-01T00:00:00Z'));

      // Verify second call uses exact metrics
      const secondCall = prismaMocks.eventKpiRecord.create.mock.calls[1][0];
      expect(secondCall.data.reach).toBe(1200);
      expect(secondCall.data.spend).toBe(200);
    });

    it('creates audit record for approved import', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed', last_dry_run_result: sampleDryRunResult() }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(result.auditRecordId).toBe('audit-1');
    });

    it('rejects cross-tenant event', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-x')).rejects.toThrow(NotFoundError);
    });
  });

  describe('State transitions', () => {
    it('enforces valid transitions', () => {
      expect(VALID_TRANSITIONS.draft).toContain('requires_credentials');
      expect(VALID_TRANSITIONS.draft).toContain('disabled');
      expect(VALID_TRANSITIONS.requires_credentials).toContain('ready_for_test');
      expect(VALID_TRANSITIONS.ready_for_test).toContain('test_passed');
      expect(VALID_TRANSITIONS.test_passed).toContain('blocked');
      expect(VALID_TRANSITIONS.disabled).toContain('draft');
    });

    it('blocks invalid transitions', () => {
      expect(VALID_TRANSITIONS.draft).not.toContain('test_passed');
      expect(VALID_TRANSITIONS.test_passed).not.toContain('draft');
    });
  });
});
