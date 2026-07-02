import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  connectorImportJob: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  commercialEvent: { findFirst: vi.fn() },
  auditRecord: { create: vi.fn() },
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
  });

  describe('Readiness', () => {
    it('returns all supported connectors in readiness', async () => {
      const result = await repo.getReadiness('tenant-a');
      expect(result.connectors).toHaveLength(SUPPORTED_CONNECTORS.length);
      expect(result.connectors.map(c => c.connectorId)).toEqual(expect.arrayContaining(SUPPORTED_CONNECTORS));
    });

    it('reports customer_credential_missing as default state', async () => {
      const result = await repo.getReadiness('tenant-a');
      for (const c of result.connectors) {
        expect(c.credentialState).toBe('customer_credential_missing');
      }
    });

    it('returns totalMissing count', async () => {
      const result = await repo.getReadiness('tenant-a');
      expect(result.totalMissing).toBe(SUPPORTED_CONNECTORS.length);
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

    it('creates job with correct initial state', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.create.mockResolvedValue(mockJob());
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const job = await repo.createJob('tenant-a', 'user-1', {
        connectorId: 'postiz',
        displayName: 'Postiz Import',
        eventId: 'event-1',
      });

      expect(job.connectorId).toBe('postiz');
      expect(job.state).toBeDefined();
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

    it('markReady rejects invalid transition', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'draft' }));
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.markReady('tenant-a', 'user-1', 'job-1', true)).rejects.toThrow(ValidationError);
    });

    it('disableJob rejects invalid transition', async () => {
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'disabled' }));
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.disableJob('tenant-a', 'user-1', 'job-1', 'reason')).rejects.toThrow(ValidationError);
    });
  });

  describe('Dry run', () => {
    it('returns stub result with warnings', async () => {
      const result = await repo.dryRun('tenant-a', 'postiz');
      expect(result.connectorId).toBe('postiz');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('stub');
    });

    it('rejects unsupported connector', async () => {
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.dryRun('tenant-a', 'invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('Approve and import', () => {
    it('rejects if job is not in test_passed state', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'draft' }));
      const { ValidationError } = await import('@shared/errors');
      await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1')).rejects.toThrow(ValidationError);
    });

    it('creates audit record on import', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
      prismaMocks.connectorImportJob.findFirst.mockResolvedValue(mockJob({ state: 'test_passed' }));
      prismaMocks.connectorImportJob.update.mockResolvedValue(mockJob({ state: 'test_passed' }));
      prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });

      const result = await repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-1');
      expect(result.auditRecordId).toBe('audit-1');
      expect(prismaMocks.auditRecord.create).toHaveBeenCalled();
    });
  });
});
