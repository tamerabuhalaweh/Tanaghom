import { describe, expect, it } from 'vitest';
import { assertAnnualPlanTransition, buildAnnualPlanRollup } from '../repository';

describe('annual planning state and rollups', () => {
  it('accepts the governed lifecycle and rejects shortcuts', () => {
    expect(() => assertAnnualPlanTransition('draft', 'pending_approval')).not.toThrow();
    expect(() => assertAnnualPlanTransition('pending_approval', 'approved')).not.toThrow();
    expect(() => assertAnnualPlanTransition('approved', 'active')).not.toThrow();
    expect(() => assertAnnualPlanTransition('active', 'closed')).not.toThrow();
    expect(() => assertAnnualPlanTransition('closed', 'archived')).not.toThrow();
    expect(() => assertAnnualPlanTransition('draft', 'active')).toThrow();
    expect(() => assertAnnualPlanTransition('active', 'archived')).toThrow();
  });

  it('keeps AED and USD allocations separate and returns all twelve months', () => {
    const rollup = buildAnnualPlanRollup(
      [
        {
          month: 1,
          currency: 'AED',
          budgetAllocation: 20_000,
          revenueTarget: 100_000,
          readiness: 'ready',
        },
        {
          month: 2,
          currency: 'AED',
          budgetAllocation: 15_000,
          revenueTarget: 60_000,
          readiness: 'needs_brief',
        },
        {
          month: 2,
          currency: 'USD',
          budgetAllocation: 1_000,
          revenueTarget: 5_000,
          readiness: 'planned',
        },
      ],
      'AED',
      100_000,
      400_000,
    );

    expect(rollup.months).toHaveLength(12);
    expect(rollup).toMatchObject({
      allocatedBudget: 35_000,
      unallocatedBudget: 65_000,
      overAllocated: false,
    });
    expect(rollup.currencies).toEqual([
      { currency: 'AED', budgetAllocation: 35_000, revenueTarget: 160_000, itemCount: 2 },
      { currency: 'USD', budgetAllocation: 1_000, revenueTarget: 5_000, itemCount: 1 },
    ]);
    expect(rollup.months[1]).toMatchObject({
      month: 2,
      itemCount: 2,
      readiness: { planned: 1, needs_brief: 1 },
    });
  });

  it('reports over-allocation honestly', () => {
    const rollup = buildAnnualPlanRollup(
      [
        {
          month: 4,
          currency: 'AED',
          budgetAllocation: 120,
          revenueTarget: 500,
          readiness: 'blocked',
        },
      ],
      'AED',
      100,
      500,
    );
    expect(rollup.unallocatedBudget).toBe(-20);
    expect(rollup.overAllocated).toBe(true);
  });
});
