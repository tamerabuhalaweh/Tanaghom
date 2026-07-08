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
      revenueLineType: 'online_course',
      name: 'Online Courses',
      description: 'Evergreen and launch-based course revenue.',
    })).toMatchObject({
      revenueLineType: 'online_course',
      name: 'Online Courses',
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
      horizon: 'quarterly',
      stage: 'strategy_planning',
      title: 'Quarterly online course growth plan',
      budgetTarget: 5000,
      revenueTarget: 25000,
    })).toMatchObject({
      horizon: 'quarterly',
      stage: 'strategy_planning',
      title: 'Quarterly online course growth plan',
    });
  });

  it('validates partial commercial plan updates', () => {
    expect(validateUpdateCommercialPlan({
      stage: 'implementation_engagement',
      status: 'active',
      budgetTarget: 12000,
    })).toMatchObject({
      stage: 'implementation_engagement',
      status: 'active',
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
