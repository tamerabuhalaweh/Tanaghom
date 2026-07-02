import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { CLOSEOUT_PERMISSIONS, checkCloseoutPermission } from '../policy';

describe('Event Closeout RBAC (real policy)', () => {
  describe('all product roles can read closeout', () => {
    const allowedRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'sales_manager', 'social_media_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];
    for (const role of allowedRoles) {
      it(`${role} can read closeout report`, () => expect(() => checkCloseoutPermission(role)).not.toThrow());
    }
  });

  describe('unknown roles are rejected', () => {
    it('unknown role is rejected', () => expect(() => checkCloseoutPermission('unknown_role')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(CLOSEOUT_PERMISSIONS)).toContain('admin');
      expect(Object.keys(CLOSEOUT_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(CLOSEOUT_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(CLOSEOUT_PERMISSIONS)).toContain('viewer');
    });
  });
});
