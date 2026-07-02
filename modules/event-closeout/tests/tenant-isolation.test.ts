import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn() },
  eventKpiRecord: { findMany: vi.fn().mockResolvedValue([]) },
  leadCaptureRecord: { findMany: vi.fn().mockResolvedValue([]) },
  eventProblem: { findMany: vi.fn().mockResolvedValue([]) },
  contentRequest: { findMany: vi.fn().mockResolvedValue([]) },
  publishingPackage: { findMany: vi.fn().mockResolvedValue([]) },
  eventEmailPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventWhatsappPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventUpsellPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventContentRequirement: { findMany: vi.fn().mockResolvedValue([]) },
  eventSalesTask: { findMany: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Closeout Report tenant isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects cross-tenant event access', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.generateCloseoutReport('tenant-a', 'event-from-tenant-b')).rejects.toThrow();
  });

  it('scopes event query to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'event-1' }),
    }));
  });

  it('scopes all sub-queries to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(prismaMocks.eventKpiRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }) }));
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }) }));
    expect(prismaMocks.eventProblem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }) }));
  });
});
