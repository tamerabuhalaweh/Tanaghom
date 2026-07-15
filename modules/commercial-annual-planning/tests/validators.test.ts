import { describe, expect, it } from 'vitest';
import {
  validateCreateAnnualPlan,
  validateCreatePortfolioItem,
  validateUpdateAnnualPlan,
  validateUpdatePortfolioItem,
} from '../validators';

const revenueLineId = '11111111-1111-4111-8111-111111111111';

describe('annual planning validators', () => {
  it('applies safe money and learning defaults to a new annual plan', () => {
    const parsed = validateCreateAnnualPlan({ year: 2027, title: '2027 Commercial Strategy' });
    expect(parsed).toMatchObject({
      year: 2027,
      budgetTarget: 0,
      revenueTarget: 0,
      learningSetIds: [],
    });
  });

  it('rejects unsupported years and negative targets', () => {
    expect(() => validateCreateAnnualPlan({ year: 1999, title: 'Old plan' })).toThrow();
    expect(() =>
      validateCreateAnnualPlan({ year: 2027, title: 'Plan', budgetTarget: -1 }),
    ).toThrow();
  });

  it('validates a complete monthly initiative and defaults readiness', () => {
    const parsed = validateCreatePortfolioItem({
      expectedRevision: 1,
      month: 3,
      revenueLineId,
      title: 'Ramadan virtual course',
      plannedStartDate: '2027-03-05',
      plannedEndDate: '2027-03-25',
    });
    expect(parsed).toMatchObject({
      priority: 'medium',
      readiness: 'planned',
      budgetAllocation: 0,
      revenueTarget: 0,
    });
  });

  it('rejects reversed dates and all empty updates', () => {
    expect(() =>
      validateCreatePortfolioItem({
        expectedRevision: 1,
        month: 3,
        revenueLineId,
        title: 'Ramadan virtual course',
        plannedStartDate: '2027-03-25',
        plannedEndDate: '2027-03-05',
      }),
    ).toThrow();
    expect(() => validateUpdateAnnualPlan({ expectedRevision: 1 })).toThrow();
    expect(() => validateUpdatePortfolioItem({ expectedRevision: 1 })).toThrow();
  });
});
