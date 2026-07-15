import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import {
  canApproveCommercialBudget,
  canManageCommercialBudget,
  checkBudgetPermission,
} from '../policy';

describe('commercial budget policy', () => {
  it('lets customer roles read governed budget state', () => {
    for (const role of ['marketing_manager', 'social_media_manager', 'sales_manager', 'viewer']) {
      expect(() => checkBudgetPermission(role, 'commercial-budget:read')).not.toThrow();
    }
  });

  it('limits allocation management to department leadership', () => {
    expect(canManageCommercialBudget('department_head')).toBe(true);
    expect(canManageCommercialBudget('marketing_manager')).toBe(false);
    expect(() => checkBudgetPermission('marketing_manager', 'commercial-budget:manage'))
      .toThrow(ForbiddenError);
  });

  it('limits approvals, evidence review, and exceptions to executives', () => {
    expect(canApproveCommercialBudget('cco')).toBe(true);
    expect(canApproveCommercialBudget('department_head')).toBe(false);
    for (const permission of [
      'commercial-budget:approve',
      'commercial-budget:verify-evidence',
      'commercial-budget:approve-exception',
    ] as const) {
      expect(() => checkBudgetPermission('department_head', permission)).toThrow(ForbiddenError);
      expect(() => checkBudgetPermission('cco', permission)).not.toThrow();
    }
  });
});
