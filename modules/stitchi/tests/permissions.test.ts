import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkStitchiPermission, canViewTenantConversations } from '../policy';

describe('Stitchi RBAC policy', () => {
  const allRoles = [
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
  ];

  for (const role of allRoles) {
    it(`${role} can read and create conversation messages`, () => {
      expect(() => checkStitchiPermission(role, 'stitchi:read')).not.toThrow();
      expect(() => checkStitchiPermission(role, 'stitchi:create_conversation')).not.toThrow();
      expect(() => checkStitchiPermission(role, 'stitchi:create_message')).not.toThrow();
    });
  }

  for (const role of ['admin', 'cco', 'department_head', 'marketing_manager']) {
    it(`${role} can approve and execute Stitchi actions`, () => {
      expect(() => checkStitchiPermission(role, 'stitchi:approve_action')).not.toThrow();
      expect(() => checkStitchiPermission(role, 'stitchi:execute_action')).not.toThrow();
    });
  }

  for (const role of ['social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer']) {
    it(`${role} cannot approve or execute Stitchi actions`, () => {
      expect(() => checkStitchiPermission(role, 'stitchi:approve_action')).toThrow(ForbiddenError);
      expect(() => checkStitchiPermission(role, 'stitchi:execute_action')).toThrow(ForbiddenError);
    });
  }

  it('limits tenant-wide conversation visibility to admin roles', () => {
    expect(canViewTenantConversations('admin')).toBe(true);
    expect(canViewTenantConversations('cco')).toBe(true);
    expect(canViewTenantConversations('department_head')).toBe(true);
    expect(canViewTenantConversations('marketing_manager')).toBe(false);
    expect(canViewTenantConversations('social_media_manager')).toBe(false);
  });
});
