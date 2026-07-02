import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { PLANNER_PERMISSIONS, checkPlannerPermission } from '../policy';

describe('Event Campaign Planner RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkPlannerPermission('admin', 'planner:read')).not.toThrow());
    it('can create', () => expect(() => checkPlannerPermission('admin', 'planner:create')).not.toThrow());
    it('can update', () => expect(() => checkPlannerPermission('admin', 'planner:update')).not.toThrow());
    it('can approve', () => expect(() => checkPlannerPermission('admin', 'planner:approve')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkPlannerPermission('marketing_manager', 'planner:read')).not.toThrow());
    it('can create', () => expect(() => checkPlannerPermission('marketing_manager', 'planner:create')).not.toThrow());
    it('can update', () => expect(() => checkPlannerPermission('marketing_manager', 'planner:update')).not.toThrow());
    it('can approve', () => expect(() => checkPlannerPermission('marketing_manager', 'planner:approve')).not.toThrow());
  });

  describe('social_media_manager', () => {
    it('can read', () => expect(() => checkPlannerPermission('social_media_manager', 'planner:read')).not.toThrow());
    it('can create', () => expect(() => checkPlannerPermission('social_media_manager', 'planner:create')).not.toThrow());
    it('can update', () => expect(() => checkPlannerPermission('social_media_manager', 'planner:update')).not.toThrow());
    it('cannot approve', () => expect(() => checkPlannerPermission('social_media_manager', 'planner:approve')).toThrow(ForbiddenError));
  });

  describe('sales_manager', () => {
    it('can read', () => expect(() => checkPlannerPermission('sales_manager', 'planner:read')).not.toThrow());
    it('can create', () => expect(() => checkPlannerPermission('sales_manager', 'planner:create')).not.toThrow());
    it('can update', () => expect(() => checkPlannerPermission('sales_manager', 'planner:update')).not.toThrow());
    it('cannot approve', () => expect(() => checkPlannerPermission('sales_manager', 'planner:approve')).toThrow(ForbiddenError));
  });

  describe('lead_qualification_manager', () => {
    it('can read', () => expect(() => checkPlannerPermission('lead_qualification_manager', 'planner:read')).not.toThrow());
    it('can update', () => expect(() => checkPlannerPermission('lead_qualification_manager', 'planner:update')).not.toThrow());
    it('cannot create', () => expect(() => checkPlannerPermission('lead_qualification_manager', 'planner:create')).toThrow(ForbiddenError));
    it('cannot approve', () => expect(() => checkPlannerPermission('lead_qualification_manager', 'planner:approve')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPlannerPermission('viewer', 'planner:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPlannerPermission('viewer', 'planner:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkPlannerPermission('viewer', 'planner:update')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles defined', () => {
      expect(Object.keys(PLANNER_PERMISSIONS)).toContain('admin');
      expect(Object.keys(PLANNER_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(PLANNER_PERMISSIONS)).toContain('social_media_manager');
      expect(Object.keys(PLANNER_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(PLANNER_PERMISSIONS)).toContain('lead_qualification_manager');
    });
  });
});
