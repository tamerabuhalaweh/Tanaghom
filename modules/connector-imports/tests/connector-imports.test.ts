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

describe('Connector Imports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
  });

  describe('Readiness', () => {
    it('returns all supported connectors in readiness', async () => {
      const result = await repo.getReadiness('tenant-a');
      expect(result.connectors).toHaveLength(SUPPORTED_CONNECTORS.length);
      expect(result.connectors.map(c => c.connectorId)).toEqual(expect.arrayContaining(SUPPORTED_CONNECTORS));
    });

    it('reports customer_credential_missing when no credentials exist', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
      const result = await repo.getReadiness('tenant-a');
      for (const c of result.connectors) {
        expect(c.credentialState).toBe('customer_credential_missing');
      }
    });

    it('reports configured when credential exists but not validated', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: null });
      const result = await repo.getReadiness('tenant-a');
      const postiz = result.connectors.find(c => c.connectorId === 'postiz');
      expect(postiz?.credentialState).toBe('configured');
    });

    it('reports test_passed when credential exists and validated', async () => {
      prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'cred-1', last_validated_at: new Date() });
      const result = await repo.getReadiness('tenant-a');
      const postiz = result.connectors.find(c => c.connectorId === 'postiz');
      expect(postiz?.credentialState).toBe('test_passed');
    });
  });

  describe('Job creation', () => {
    it('rejects unsupported connector', async () => {
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.createJob('tenant-a', 'user-1', {
        connectorId: 'unsupported' as string,
        displayName: 'Test',
      })).rejects.toThrow(ValidationError);
    });

    it('validates event belongs to tenant', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.createJob('tenant-a', 'user-1', {
        connectorId: 'postiz',
        displayName: 'Test',
        eventId: 'event-x',
      })).rejects.toThrow(NotFoundError);
    });

    it('creates audit record on job creation', async () => {
      prismaMocks.connectorImportJob.create.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.createJob('tenant-a', 'user-1', {
        connectorId: 'postiz',
        displayName: 'Postiz Import',
      });

      expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          audit_type: 'connector_import',
          action: 'import_job_created',
        }),
      }));
    });
  });

  describe('Dry run', () => {
    it('persists last_dry_run_at and last_dry_run_result', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(prismaMocks.connectorImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          last_dry_run_at: expect.any(Date),
          last_dry_run_result: expect.any(Object),
        }),
      }));
    });

    it('creates audit record on dry run', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          audit_type: 'connector_import',
          action: 'import_dry_run',
        }),
      }));
    });

    it('has no writes to EventKpiRecord or leads', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(prismaMocks.eventKpiRecord.create).not.toHaveBeenCalled();
    });

    it('rejects if job not found', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(NotFoundError);
    });

    it('rejects unsupported connector', async () => {
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.dryRun('tenant-a', 'user-1', 'invalid')).rejects.toThrow(ValidationError);
    });

    it('no secrets in warnings', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'ready_for_test' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.dryRun('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(JSON.stringify(result)).not.toContain('apiKey');
      expect(JSON.stringify(result)).not.toContain('accessToken');
    });
  });

  describe('Approve and import', () => {
    it('rejects if job is not in test_passed state', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'draft' }));
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('rejects cross-tenant event', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-x')).rejects.toThrow(NotFoundError);
    });

    it('writes EventKpiRecord on approved import', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(result.imported.kpiRecords).toBe(1);
      expect(prismaMocks.eventKpiRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          tenant_key: 'tenant-a',
          event_id: 'event-1',
          source_type: 'connector',
          source_name: 'postiz',
        }),
      }));
    });

    it('creates audit record on approved import', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
      prismaMocks.eventKpiRecord.create.mockResolvedValue({ id: 'kpi-1' });

      const result = await repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1');

      expect(result.auditRecordId).toBe('audit-1');
      expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          audit_type: 'connector_import',
          action: 'import_approved_and_executed',
        }),
      }));
    });

    it('rejects cross-tenant job', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
      const { NotFoundError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-b', 'user-1', 'postiz', 'event-1')).rejects.toThrow(NotFoundError);
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
