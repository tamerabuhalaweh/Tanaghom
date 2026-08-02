import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@shared/errors';

const prismaMocks = vi.hoisted(() => ({
  commercialWeeklyWorkItem: {
    findFirst: vi.fn(),
  },
  commercialPlan: {
    findFirst: vi.fn(),
  },
  user: { findMany: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { getWeeklyWorkItem, getWeeklyWorkspace, normalizeWeekStart } from '../repository';

describe('weekly work repository boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always scopes item lookup by tenant and execution plan', async () => {
    prismaMocks.commercialWeeklyWorkItem.findFirst.mockResolvedValue(null);
    await expect(getWeeklyWorkItem('tenant-a', 'plan-a', 'item-a')).rejects.toThrow(NotFoundError);
    expect(prismaMocks.commercialWeeklyWorkItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-a', tenant_key: 'tenant-a', commercial_plan_id: 'plan-a' },
    }));
  });

  it('returns not found instead of leaking a cross-tenant execution plan', async () => {
    prismaMocks.commercialPlan.findFirst.mockResolvedValue(null);
    await expect(getWeeklyWorkspace('tenant-a', 'plan-from-tenant-b', {})).rejects.toThrow(NotFoundError);
    expect(prismaMocks.commercialPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan-from-tenant-b', tenant_key: 'tenant-a' },
    }));
  });

  it('normalizes any date to its Monday boundary', () => {
    expect(normalizeWeekStart('2026-08-09')).toBe('2026-08-03');
    expect(normalizeWeekStart('2026-08-03')).toBe('2026-08-03');
  });

  it('does not accept an invalid calendar date as a valid weekly boundary', () => {
    expect(() => normalizeWeekStart('not-a-date')).toThrow();
  });
});
