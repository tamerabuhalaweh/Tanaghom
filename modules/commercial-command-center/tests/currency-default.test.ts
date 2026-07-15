import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlan } from '../repository';

const prismaMocks = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  commercialRevenueLine: { findFirst: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  commercialPlan: { create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

const baseInput = {
  revenueLineId: '11111111-1111-4111-8111-111111111111',
  horizon: 'quarterly' as const,
  title: 'Q3 course plan',
};

describe('commercial plan tenant currency default', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialRevenueLine.findFirst.mockResolvedValue({ id: baseInput.revenueLineId });
    prismaMocks.tenant.findUnique.mockResolvedValue({ default_currency: 'AED' });
    prismaMocks.commercialPlan.create.mockImplementation(async ({ data }) => ({
      id: 'plan-1',
      ...data,
      revenue_line: { revenue_line_type: 'online_course', name: 'Online Courses' },
      linked_event: null,
      created_at: new Date('2026-07-15'),
      updated_at: new Date('2026-07-15'),
    }));
  });

  it('inherits AED when the caller does not declare a currency', async () => {
    const plan = await createPlan('tenant-a', 'user-1', baseInput);
    expect(prismaMocks.tenant.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tenant_key: 'tenant-a' } }));
    expect(plan.currency).toBe('AED');
  });

  it('preserves an intentional USD override without reading or converting tenant currency', async () => {
    const plan = await createPlan('tenant-a', 'user-1', { ...baseInput, currency: 'USD' });
    expect(prismaMocks.tenant.findUnique).not.toHaveBeenCalled();
    expect(plan.currency).toBe('USD');
  });
});
