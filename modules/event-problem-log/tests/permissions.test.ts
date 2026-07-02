import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { EVENT_PROBLEM_PERMISSIONS, checkProblemPermission, checkProblemCategoryPermission } from '../policy';

describe('Event Problem Log RBAC (real policy)', () => {
  describe('full access roles', () => {
    const fullRoles = ['admin', 'cco', 'department_head', 'marketing_manager'];

    for (const role of fullRoles) {
      it(`${role} can read`, () => expect(() => checkProblemPermission(role, 'problems:read')).not.toThrow());
      it(`${role} can create`, () => expect(() => checkProblemPermission(role, 'problems:create')).not.toThrow());
      it(`${role} can update`, () => expect(() => checkProblemPermission(role, 'problems:update')).not.toThrow());
      it(`${role} can transition`, () => expect(() => checkProblemPermission(role, 'problems:transition')).not.toThrow());
      it(`${role} can view dashboard`, () => expect(() => checkProblemPermission(role, 'problems:dashboard')).not.toThrow());
      it(`${role} can manage any category`, () => {
        expect(() => checkProblemCategoryPermission(role, 'content')).not.toThrow();
        expect(() => checkProblemCategoryPermission(role, 'sales')).not.toThrow();
        expect(() => checkProblemCategoryPermission(role, 'integration')).not.toThrow();
      });
    }
  });

  describe('social_media_manager', () => {
    it('can read', () => expect(() => checkProblemPermission('social_media_manager', 'problems:read')).not.toThrow());
    it('can create', () => expect(() => checkProblemPermission('social_media_manager', 'problems:create')).not.toThrow());
    it('can update', () => expect(() => checkProblemPermission('social_media_manager', 'problems:update')).not.toThrow());
    it('can view dashboard', () => expect(() => checkProblemPermission('social_media_manager', 'problems:dashboard')).not.toThrow());
    it('cannot transition', () => expect(() => checkProblemPermission('social_media_manager', 'problems:transition')).toThrow(ForbiddenError));
    it('can manage content problems', () => expect(() => checkProblemCategoryPermission('social_media_manager', 'content')).not.toThrow());
    it('can manage ads problems', () => expect(() => checkProblemCategoryPermission('social_media_manager', 'ads')).not.toThrow());
    it('can manage audience problems', () => expect(() => checkProblemCategoryPermission('social_media_manager', 'audience')).not.toThrow());
    it('cannot manage sales problems', () => expect(() => checkProblemCategoryPermission('social_media_manager', 'sales')).toThrow(ForbiddenError));
    it('cannot manage integration problems', () => expect(() => checkProblemCategoryPermission('social_media_manager', 'integration')).toThrow(ForbiddenError));
  });

  describe('sales_manager', () => {
    it('can read', () => expect(() => checkProblemPermission('sales_manager', 'problems:read')).not.toThrow());
    it('can create', () => expect(() => checkProblemPermission('sales_manager', 'problems:create')).not.toThrow());
    it('can update', () => expect(() => checkProblemPermission('sales_manager', 'problems:update')).not.toThrow());
    it('can view dashboard', () => expect(() => checkProblemPermission('sales_manager', 'problems:dashboard')).not.toThrow());
    it('cannot transition', () => expect(() => checkProblemPermission('sales_manager', 'problems:transition')).toThrow(ForbiddenError));
    it('can manage sales problems', () => expect(() => checkProblemCategoryPermission('sales_manager', 'sales')).not.toThrow());
    it('can manage funnel problems', () => expect(() => checkProblemCategoryPermission('sales_manager', 'funnel')).not.toThrow());
    it('can manage operations problems', () => expect(() => checkProblemCategoryPermission('sales_manager', 'operations')).not.toThrow());
    it('cannot manage content problems', () => expect(() => checkProblemCategoryPermission('sales_manager', 'content')).toThrow(ForbiddenError));
    it('cannot manage ads problems', () => expect(() => checkProblemCategoryPermission('sales_manager', 'ads')).toThrow(ForbiddenError));
  });

  describe('lead_qualification_manager', () => {
    it('can read', () => expect(() => checkProblemPermission('lead_qualification_manager', 'problems:read')).not.toThrow());
    it('can create', () => expect(() => checkProblemPermission('lead_qualification_manager', 'problems:create')).not.toThrow());
    it('can update', () => expect(() => checkProblemPermission('lead_qualification_manager', 'problems:update')).not.toThrow());
    it('cannot view dashboard', () => expect(() => checkProblemPermission('lead_qualification_manager', 'problems:dashboard')).toThrow(ForbiddenError));
    it('can manage sales problems', () => expect(() => checkProblemCategoryPermission('lead_qualification_manager', 'sales')).not.toThrow());
    it('cannot manage content problems', () => expect(() => checkProblemCategoryPermission('lead_qualification_manager', 'content')).toThrow(ForbiddenError));
  });

  describe('read-only roles', () => {
    const readOnlyRoles = ['specialist', 'reviewer', 'viewer'];

    for (const role of readOnlyRoles) {
      it(`${role} can read`, () => expect(() => checkProblemPermission(role, 'problems:read')).not.toThrow());
      it(`${role} cannot create`, () => expect(() => checkProblemPermission(role, 'problems:create')).toThrow(ForbiddenError));
      it(`${role} cannot update`, () => expect(() => checkProblemPermission(role, 'problems:update')).toThrow(ForbiddenError));
      it(`${role} cannot manage any category`, () => {
        expect(() => checkProblemCategoryPermission(role, 'content')).toThrow(ForbiddenError);
        expect(() => checkProblemCategoryPermission(role, 'sales')).toThrow(ForbiddenError);
      });
    }
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(EVENT_PROBLEM_PERMISSIONS)).toContain('admin');
      expect(Object.keys(EVENT_PROBLEM_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(EVENT_PROBLEM_PERMISSIONS)).toContain('social_media_manager');
      expect(Object.keys(EVENT_PROBLEM_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(EVENT_PROBLEM_PERMISSIONS)).toContain('lead_qualification_manager');
    });
  });
});
