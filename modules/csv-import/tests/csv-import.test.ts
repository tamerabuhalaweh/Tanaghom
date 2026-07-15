import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  connectorFieldMapping: { findFirst: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  connectorImportJob: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditRecord: { create: vi.fn() },
  eventKpiRecord: { create: vi.fn(), findFirst: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import * as repo from '../repository';

function mockMapping() {
  return {
    id: 'mapping-1', tenant_key: 'tenant-a', connector_id: 'csv_manual',
    event_id: null,
    display_name: 'CSV KPI Import', target_type: 'event_kpi_record',
    field_mappings: [
      { sourceField: 'Date', targetField: 'metricDate' },
      { sourceField: 'Platform', targetField: 'channel' },
      { sourceField: 'Reach', targetField: 'reach' },
      { sourceField: 'Impressions', targetField: 'impressions' },
      { sourceField: 'Spend', targetField: 'spend' },
    ],
    validation_status: 'valid', validation_errors: null,
    created_by_user_id: 'user-1',
    created_at: new Date('2026-07-01T00:00:00Z'),
    updated_at: new Date('2026-07-01T00:00:00Z'),
  };
}

function dryRunResult(overrides: Record<string, unknown> = {}) {
  return {
    mappingId: 'mapping-1',
    eventId: 'event-1',
    mappingUpdatedAt: '2026-07-01T00:00:00.000Z',
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    kpiRows: [{
      metricDate: '2026-07-01T00:00:00Z',
      channel: 'instagram',
      reach: 1500, impressions: 3200, interactions: 0, clicks: 0,
      formCompletions: 0, leads: 0, meetingsBooked: 0, meetingsAttended: 0,
      purchases: 0, noShows: 0, spend: 250, notes: null,
    }],
    validationErrors: [],
    warnings: [],
    ...overrides,
  };
}

function validRow(overrides: Record<string, string> = {}) {
  return {
    Date: '2026-07-01T00:00:00Z',
    Platform: 'instagram',
    Reach: '1500',
    Impressions: '3200',
    Spend: '250',
    ...overrides,
  };
}

describe('CSV Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.tenant.findUnique.mockResolvedValue({ default_currency: 'AED' });
  });

  describe('Dry run', () => {
    it('rejects when mapping not found', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-x', 'event-1', [validRow()])).rejects.toThrow(NotFoundError);
    });

    it('rejects when event not found', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-x', [validRow()])).rejects.toThrow(NotFoundError);
    });

    it('maps CSV rows to KPI rows using field mapping', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()]);

      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.kpiRows).toHaveLength(1);
      expect(result.kpiRows[0].metricDate).toBe('2026-07-01T00:00:00Z');
      expect(result.kpiRows[0].channel).toBe('instagram');
      expect(result.kpiRows[0].reach).toBe(1500);
      expect(result.kpiRows[0].impressions).toBe(3200);
      expect(result.kpiRows[0].spend).toBe(250);
      expect(prismaMocks.connectorImportJob.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          connector_id: 'csv_manual',
          event_id: 'event-1',
          mapping_id: 'mapping-1',
          state: 'test_passed',
          last_dry_run_result: expect.objectContaining({ mappingId: 'mapping-1', eventId: 'event-1' }),
        }),
      }));
    });

    it('rejects rows with missing required fields', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [
        validRow({ Date: '' }),
      ]);

      expect(result.validRows).toBe(0);
      expect(result.invalidRows).toBe(1);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it('rejects rows with invalid dates', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [
        validRow({ Date: 'not-a-date' }),
      ]);

      expect(result.validRows).toBe(0);
      expect(result.validationErrors.some(e => e.field === 'metricDate')).toBe(true);
    });

    it('rejects all-zero KPI rows', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [
        validRow({ Reach: '0', Impressions: '0', Spend: '0' }),
      ]);

      expect(result.validRows).toBe(0);
      expect(result.validationErrors.some(e => e.error.includes('All-zero'))).toBe(true);
    });

    it('rejects negative numeric values', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [
        validRow({ Reach: '-100' }),
      ]);

      expect(result.validRows).toBe(0);
      expect(result.validationErrors.some(e => e.field === 'reach')).toBe(true);
    });

    it('creates audit record on dry run', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.connectorImportJob.create.mockResolvedValue({ id: 'job-1' });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()]);

      expect(prismaMocks.auditRecord.create).toHaveBeenCalled();
    });

    it('rejects using an event-scoped mapping for another event', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ ...mockMapping(), event_id: 'event-2' });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      const { ValidationError } = await import('@shared/errors');

      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()])).rejects.toThrow(ValidationError);
    });

    it('rejects invalid mappings before dry-run persistence', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ ...mockMapping(), validation_status: 'invalid' });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      const { ValidationError } = await import('@shared/errors');

      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()])).rejects.toThrow(ValidationError);
      expect(prismaMocks.connectorImportJob.create).not.toHaveBeenCalled();
    });

    it('rejects unsupported mapping targets before dry-run persistence', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ ...mockMapping(), target_type: 'lead_attribution' });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      const { ValidationError } = await import('@shared/errors');

      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()])).rejects.toThrow(ValidationError);
    });

    it('rejects mappings with unknown target fields even if stored status says valid', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({
        ...mockMapping(),
        field_mappings: [
          { sourceField: 'Date', targetField: 'metricDate' },
          { sourceField: 'Platform', targetField: 'channel' },
          { sourceField: 'Bad', targetField: 'unknownTarget' },
        ],
      });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      const { ValidationError } = await import('@shared/errors');

      await expect(repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()])).rejects.toThrow(ValidationError);
      expect(prismaMocks.connectorImportJob.create).not.toHaveBeenCalled();
    });
  });

  describe('Approve import', () => {
    it('rejects when no dry run performed', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('writes exact metrics from dry-run payload', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({
        id: 'job-1', state: 'test_passed', last_dry_run_result: dryRunResult(),
      });
      prismaMocks.connectorImportJob.update.mockResolvedValue({});
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1');

      expect(result.imported.kpiRecords).toBe(1);
      const call = prismaMocks.eventKpiRecord.create.mock.calls[0][0];
      expect(call.data.reach).toBe(1500);
      expect(call.data.impressions).toBe(3200);
      expect(call.data.spend).toBe(250);
      expect(call.data.channel).toBe('instagram');
      expect(call.data.metric_date).toEqual(new Date('2026-07-01T00:00:00Z'));
    });

    it('creates audit record for approved import', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', state: 'test_passed', last_dry_run_result: dryRunResult() });
      prismaMocks.connectorImportJob.update.mockResolvedValue({});
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1');
      expect(result.auditRecordId).toBe('audit-1');
    });

    it('rejects cross-tenant mapping', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-b', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(NotFoundError);
    });

    it('rejects when job state is not test_passed', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', state: 'blocked', last_dry_run_result: dryRunResult() });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
      expect(prismaMocks.eventKpiRecord.create).not.toHaveBeenCalled();
    });

    it('rejects stale dry-run payload for a different mapping', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', state: 'test_passed', last_dry_run_result: dryRunResult({ mappingId: 'mapping-2' }) });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects stale dry-run payload for a different event', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', state: 'test_passed', last_dry_run_result: dryRunResult({ eventId: 'event-2' }) });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects dry-run payload when mapping changed after dry-run', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ ...mockMapping(), updated_at: new Date('2026-07-02T00:00:00Z') });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', state: 'test_passed', last_dry_run_result: dryRunResult() });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects event-scoped mapping mismatch during approve', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ ...mockMapping(), event_id: 'event-2' });
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects malformed persisted KPI rows before writing', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({
        id: 'job-1',
        state: 'test_passed',
        last_dry_run_result: dryRunResult({
          kpiRows: [{ metricDate: 'not-a-date', channel: '', reach: -1 }],
        }),
      });
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveCsvImport('tenant-a', 'user-1', 'mapping-1', 'event-1')).rejects.toThrow(ValidationError);
      expect(prismaMocks.eventKpiRecord.create).not.toHaveBeenCalled();
    });
  });
});
