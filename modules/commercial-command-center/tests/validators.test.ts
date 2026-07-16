import { describe, expect, it } from 'vitest';
import { ValidationError } from '@shared/errors';
import {
  validateCreateAssessmentSignal,
  validateCreateCommercialPlan,
  validateCreateRevenueLine,
  validateUpdateCommercialPlan,
} from '../validators';

describe('Commercial Command Center validators', () => {
  it('validates revenue line creation using SRD revenue line vocabulary', () => {
    expect(validateCreateRevenueLine({
      revenueLineType: 'book',
      name: 'Books',
      description: 'Book launches and reader-to-program revenue.',
    })).toMatchObject({
      revenueLineType: 'book',
      name: 'Books',
    });
  });

  it('rejects unknown revenue line types', () => {
    expect(() => validateCreateRevenueLine({
      revenueLineType: 'random_product',
      name: 'Random',
    })).toThrow(ValidationError);
  });

  it('validates commercial plan creation with stage and horizon', () => {
    expect(validateCreateCommercialPlan({
      revenueLineId: '00000000-0000-0000-0000-000000000001',
      standaloneReason: 'Urgent unplanned partner launch outside the approved annual calendar.',
      horizon: 'quarterly',
      stage: 'strategy_planning',
      title: 'Quarterly online course growth plan',
      currency: 'AED',
      budgetTarget: 5000,
      revenueTarget: 25000,
    })).toMatchObject({
      horizon: 'quarterly',
      stage: 'strategy_planning',
      title: 'Quarterly online course growth plan',
      currency: 'AED',
    });
  });

  it('rejects unsupported commercial plan currencies', () => {
    expect(() => validateCreateCommercialPlan({
      revenueLineId: '00000000-0000-0000-0000-000000000001',
      standaloneReason: 'Urgent unplanned partner launch outside the approved annual calendar.',
      horizon: 'quarterly',
      title: 'Unsupported currency plan',
      currency: 'SAR',
    })).toThrow(ValidationError);
  });

  it('validates partial commercial plan updates', () => {
    expect(validateUpdateCommercialPlan({
      stage: 'implementation_engagement',
      status: 'active',
      currency: 'USD',
      budgetTarget: 12000,
    })).toMatchObject({
      stage: 'implementation_engagement',
      status: 'active',
      currency: 'USD',
      budgetTarget: 12000,
    });
  });

  it('rejects empty commercial plan updates', () => {
    expect(() => validateUpdateCommercialPlan({})).toThrow(ValidationError);
  });

  it('validates commercial assessment signal creation', () => {
    expect(validateCreateAssessmentSignal({
      title: 'Lead quality needs review',
      severity: 'risk',
      finding: 'Form completions are high but meeting bookings are low.',
    })).toMatchObject({
      title: 'Lead quality needs review',
      severity: 'risk',
    });
  });
});
