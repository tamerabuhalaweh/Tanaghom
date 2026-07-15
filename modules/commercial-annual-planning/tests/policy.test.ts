import { describe, expect, it } from 'vitest';
import {
  canApproveAnnualPlanning,
  canManageAnnualPlanning,
  checkAnnualPlanningPermission,
} from '../policy';

describe('annual commercial planning policy', () => {
  it.each([
    'admin',
    'cco',
    'department_head',
    'marketing_manager',
    'social_media_manager',
    'sales_manager',
    'specialist',
    'viewer',
  ])('%s can read annual plans', (role) => {
    expect(() => checkAnnualPlanningPermission(role, 'annual-plan:read')).not.toThrow();
  });

  it.each(['admin', 'cco', 'department_head'])('%s can create and update annual plans', (role) => {
    expect(canManageAnnualPlanning(role)).toBe(true);
    expect(() => checkAnnualPlanningPermission(role, 'annual-plan:update')).not.toThrow();
  });

  it.each(['marketing_manager', 'social_media_manager', 'sales_manager', 'specialist', 'viewer'])(
    '%s cannot mutate annual plans',
    (role) => {
      expect(canManageAnnualPlanning(role)).toBe(false);
      expect(() => checkAnnualPlanningPermission(role, 'annual-plan:update')).toThrow();
    },
  );

  it('reserves approval for current executive authority roles', () => {
    expect(canApproveAnnualPlanning('admin')).toBe(true);
    expect(canApproveAnnualPlanning('cco')).toBe(true);
    expect(canApproveAnnualPlanning('department_head')).toBe(false);
    expect(() => checkAnnualPlanningPermission('department_head', 'annual-plan:approve')).toThrow();
  });
});
