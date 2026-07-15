import { describe, expect, it } from 'vitest';
import {
  canApproveHierarchyException,
  canManageHierarchy,
  checkHierarchyPermission,
} from '../policy';

describe('commercial hierarchy policy', () => {
  it.each([
    'admin',
    'cco',
    'department_head',
    'marketing_manager',
    'social_media_manager',
    'sales_manager',
    'lead_qualification_manager',
    'specialist',
    'reviewer',
    'viewer',
  ])('%s can read hierarchy context', (role) => {
    expect(() => checkHierarchyPermission(role, 'commercial-hierarchy:read')).not.toThrow();
  });

  it.each(['admin', 'cco', 'department_head', 'marketing_manager'])('%s can manage links', (role) => {
    expect(canManageHierarchy(role)).toBe(true);
  });

  it.each(['social_media_manager', 'sales_manager', 'specialist', 'reviewer', 'viewer'])('%s cannot manage links', (role) => {
    expect(canManageHierarchy(role)).toBe(false);
    expect(() => checkHierarchyPermission(role, 'commercial-hierarchy:manage')).toThrow();
  });

  it('reserves period exceptions for executive authority', () => {
    expect(canApproveHierarchyException('admin')).toBe(true);
    expect(canApproveHierarchyException('cco')).toBe(true);
    expect(canApproveHierarchyException('department_head')).toBe(false);
    expect(() => checkHierarchyPermission('department_head', 'commercial-hierarchy:approve-exception')).toThrow();
  });
});
