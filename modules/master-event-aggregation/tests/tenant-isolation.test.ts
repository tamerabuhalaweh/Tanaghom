import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Master Event Aggregation tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only tenant-a events', async () => {
    await repo.getMasterDashboard('tenant-a', {});
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_key: 'tenant-a' }),
      }),
    );
  });

  it('queries only tenant-b events', async () => {
    await repo.getMasterDashboard('tenant-b', {});
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_key: 'tenant-b' }),
      }),
    );
  });

  it('never mixes tenant data in aggregation', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Tenant A Event',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: new Date('2026-08-15'),
        status: 'active',
        geography: 'Riyadh',
        revenue_target: null,
        planned_budget: null,
        owner: null,
        leads: [],
        kpi_records: [],
      },
    ]);

    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.filteredEvents).toBe(1);
    expect(result.events[0].eventName).toBe('Tenant A Event');

    const findManyCall = prismaMocks.commercialEvent.findMany.mock.calls[0][0];
    expect(findManyCall.where.tenant_key).toBe('tenant-a');
  });

  it('applies owner filter within tenant scope', async () => {
    await repo.getMasterDashboard('tenant-a', { ownerUserId: 'user-1' });
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_key: 'tenant-a',
          owner_user_id: 'user-1',
        }),
      }),
    );
  });
});
