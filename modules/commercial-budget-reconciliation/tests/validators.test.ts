import { describe, expect, it } from 'vitest';
import { ValidationError } from '@shared/errors';
import {
  validateBudgetTransition,
  validateCreateBudgetAllocation,
  validateReallocateBudget,
  validateVerifyKpiEvidence,
} from '../validators';

const monthId = '00000000-0000-0000-0000-000000000101';
const parentId = '00000000-0000-0000-0000-000000000102';
const planId = '00000000-0000-0000-0000-000000000103';

describe('commercial budget validation', () => {
  it('accepts a root monthly allocation with explicit currency and reason', () => {
    expect(validateCreateBudgetAllocation({
      level: 'monthly_item',
      monthlyPortfolioItemId: monthId,
      currency: 'AED',
      amount: '125000.50',
      reason: 'Approved January envelope.',
    })).toMatchObject({ amount: 125000.5, allowOverAllocation: false });
  });

  it('requires exactly one target matching the allocation level', () => {
    expect(() => validateCreateBudgetAllocation({
      level: 'commercial_plan',
      parentAllocationId: parentId,
      monthlyPortfolioItemId: monthId,
      commercialPlanId: planId,
      currency: 'AED',
      amount: 1000,
      reason: 'Invalid mixed target.',
    })).toThrow(ValidationError);
  });

  it('requires a parent below the monthly level', () => {
    expect(() => validateCreateBudgetAllocation({
      level: 'commercial_plan',
      commercialPlanId: planId,
      currency: 'AED',
      amount: 1000,
      reason: 'Missing governed parent.',
    })).toThrow(/parent allocation is required/i);
  });

  it('requires an explicit reason for an over-allocation exception', () => {
    expect(() => validateReallocateBudget({
      expectedRevision: 1,
      amount: 150000,
      reason: 'Increase requested.',
      allowOverAllocation: true,
    })).toThrow(ValidationError);
  });

  it('rejects negative money and stale revision shapes', () => {
    expect(() => validateReallocateBudget({
      expectedRevision: 0,
      amount: -1,
      reason: 'Invalid change.',
    })).toThrow(ValidationError);
  });

  it('accepts governed transition and evidence decisions', () => {
    expect(validateBudgetTransition({
      expectedRevision: 2,
      reason: 'Executive approval recorded.',
    }).expectedRevision).toBe(2);
    expect(validateVerifyKpiEvidence({
      expectedRevision: 4,
      decision: 'rejected',
      reason: 'Invoice does not match the imported row.',
    }).decision).toBe('rejected');
  });
});
