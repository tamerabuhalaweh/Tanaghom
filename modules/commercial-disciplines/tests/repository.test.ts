import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@shared/errors';

const prismaMocks = vi.hoisted(() => ({
  commercialDisciplineRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  commercialRevenueLine: { findFirst: vi.fn() },
  commercialPlan: { findFirst: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { createRecord, listRecords, updateRecord } from '../repository';

const baseRecord = {
  id: 'record-1',
  tenant_key: 'tenant-a',
  discipline: 'conversion_closing',
  category: 'objection_handling',
  title: 'Price objection response',
  summary: null,
  details: null,
  status: 'active',
  priority: 'medium',
  source_type: 'manual',
  revenue_line_id: null,
  commercial_plan_id: null,
  event_id: null,
  owner_user_id: null,
  created_by_user_id: 'user-1',
  created_at: new Date('2026-07-08T00:00:00Z'),
  updated_at: new Date('2026-07-08T00:00:00Z'),
  revenue_line: null,
  commercial_plan: null,
  event: null,
  owner: null,
};

describe('Commercial discipline repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialDisciplineRecord.findMany.mockResolvedValue([baseRecord]);
    prismaMocks.commercialDisciplineRecord.create.mockResolvedValue(baseRecord);
    prismaMocks.commercialDisciplineRecord.findFirst.mockResolvedValue({
      id: 'record-1',
      discipline: 'conversion_closing',
      category: 'objection_handling',
    });
    prismaMocks.commercialDisciplineRecord.update.mockResolvedValue(baseRecord);
    prismaMocks.commercialRevenueLine.findFirst.mockResolvedValue({ id: 'line-1' });
    prismaMocks.commercialPlan.findFirst.mockResolvedValue({ id: 'plan-1', revenue_line_id: 'line-1' });
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMocks.user.findFirst.mockResolvedValue({ id: 'owner-1' });
  });

  it('lists records scoped to the caller tenant', async () => {
    await listRecords('tenant-a', { discipline: 'conversion_closing' });

    expect(prismaMocks.commercialDisciplineRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenant_key: 'tenant-a',
        discipline: 'conversion_closing',
      }),
    }));
  });

  it('rejects cross-tenant revenue line references before create', async () => {
    prismaMocks.commercialRevenueLine.findFirst.mockResolvedValueOnce(null);

    await expect(createRecord('tenant-a', 'user-1', {
      discipline: 'conversion_closing',
      category: 'objection_handling',
      title: 'Handle price objection',
      revenueLineId: '00000000-0000-0000-0000-000000000010',
    })).rejects.toThrow(NotFoundError);

    expect(prismaMocks.commercialRevenueLine.findFirst).toHaveBeenCalledWith({
      where: { id: '00000000-0000-0000-0000-000000000010', tenant_key: 'tenant-a' },
      select: { id: true },
    });
    expect(prismaMocks.commercialDisciplineRecord.create).not.toHaveBeenCalled();
  });

  it('rejects commercial plan and revenue line mismatch', async () => {
    prismaMocks.commercialPlan.findFirst.mockResolvedValueOnce({ id: 'plan-1', revenue_line_id: 'line-b' });

    await expect(createRecord('tenant-a', 'user-1', {
      discipline: 'growth_retention',
      category: 'upsell_ascension',
      title: 'VIP upgrade path',
      revenueLineId: 'line-a',
      commercialPlanId: '00000000-0000-0000-0000-000000000020',
    })).rejects.toThrow(ValidationError);
  });

  it('validates effective category on update when only category changes', async () => {
    await expect(updateRecord('tenant-a', 'record-1', {
      category: 'brand_voice',
    })).rejects.toThrow(ValidationError);

    expect(prismaMocks.commercialDisciplineRecord.update).not.toHaveBeenCalled();
  });
});
