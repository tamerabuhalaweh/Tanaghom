import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  connectorImportJob: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  commercialEvent: { findFirst: vi.fn() },
  auditRecord: { create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Connector Import tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readiness scopes to tenant', async () => {
    await repo.getReadiness('tenant-a');
    expect(prismaMocks.connectorImportJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('listJobs scopes to tenant', async () => {
    await repo.listJobs('tenant-a');
    expect(prismaMocks.connectorImportJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('listJobs scopes to tenant and event', async () => {
    await repo.listJobs('tenant-a', 'event-1');
    expect(prismaMocks.connectorImportJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }),
    }));
  });

  it('getJobById scopes to tenant', async () => {
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);
    const { NotFoundError } = await import('@shared/errors');
    await expect(repo.getJobById('tenant-a', 'job-1')).rejects.toThrow(NotFoundError);
  });

  it('dryRun validates connector exists', async () => {
    const { ValidationError } = await import('@shared/errors');
    await expect(repo.dryRun('tenant-a', 'invalid_connector')).rejects.toThrow(ValidationError);
  });

  it('approveAndImport validates event belongs to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    const { NotFoundError } = await import('@shared/errors');
    await expect(repo.approveAndImport('tenant-a', 'user-1', 'postiz', 'event-x')).rejects.toThrow(NotFoundError);
  });

  it('no secrets returned in job summary', async () => {
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue({
      id: 'job-1', tenant_key: 'tenant-a', connector_id: 'postiz', display_name: 'Postiz',
      state: 'draft', credential_state: 'customer_credential_missing',
      notes: null, last_dry_run_at: null, last_dry_run_result: null,
      last_import_at: null, last_import_result: null,
      approved_by_user_id: null, approved_at: null,
      disabled_at: null, disabled_reason: null,
      created_by_user_id: 'user-1', created_at: new Date(), updated_at: new Date(),
    });
    const job = await repo.getJobById('tenant-a', 'job-1');
    expect(JSON.stringify(job)).not.toContain('apiKey');
    expect(JSON.stringify(job)).not.toContain('accessToken');
    expect(JSON.stringify(job)).not.toContain('botToken');
  });
});
