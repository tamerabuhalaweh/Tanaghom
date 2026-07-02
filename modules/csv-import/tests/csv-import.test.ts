import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  connectorFieldMapping: { findFirst: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  connectorImportJob: { findFirst: vi.fn(), update: vi.fn() },
  auditRecord: { create: vi.fn() },
  eventKpiRecord: { create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import * as repo from '../repository';

function mockMapping() {
  return {
    id: 'mapping-1', tenant_key: 'tenant-a', connector_id: 'csv_manual',
    display_name: 'CSV KPI Import', target_type: 'event_kpi_record',
    field_mappings: [
      { sourceField: 'Date', targetField: 'metricDate' },
      { sourceField: 'Platform', targetField: 'channel' },
      { sourceField: 'Reach', targetField: 'reach' },
      { sourceField: 'Impressions', targetField: 'impressions' },
      { sourceField: 'Spend', targetField: 'spend' },
    ],
    validation_status: 'valid', validation_errors: null,
    created_by_user_id: 'user-1', created_at: new Date(), updated_at: new Date(),
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
    });

    it('rejects rows with missing required fields', async () => {
      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
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
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRunCsv('tenant-a', 'user-1', 'mapping-1', 'event-1', [validRow()]);

      expect(prismaMocks.auditRecord.create).toHaveBeenCalled();
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
      const dryRunResult = {
        mappingId: 'mapping-1',
        eventId: 'event-1',
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
      };

      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({
        id: 'job-1', last_dry_run_result: dryRunResult,
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
      const dryRunResult = {
        mappingId: 'mapping-1', eventId: 'event-1', totalRows: 1, validRows: 1, invalidRows: 0,
        kpiRows: [{ metricDate: '2026-07-01T00:00:00Z', channel: 'ig', reach: 100, impressions: 200, interactions: 0, clicks: 0, formCompletions: 0, leads: 0, meetingsBooked: 0, meetingsAttended: 0, purchases: 0, noShows: 0, spend: 50, notes: null }],
        validationErrors: [], warnings: [],
      };

      prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(mockMapping());
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'job-1', last_dry_run_result: dryRunResult });
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
  });
});
