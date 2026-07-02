import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { LEAD_LIFECYCLE_PERMISSIONS, checkLeadPermission } from '../policy';

describe('Lead Lifecycle RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkLeadPermission('admin', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('admin', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('admin', 'leads:update')).not.toThrow());
    it('can transition', () => expect(() => checkLeadPermission('admin', 'leads:transition')).not.toThrow());
    it('can view dashboard', () => expect(() => checkLeadPermission('admin', 'leads:dashboard')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkLeadPermission('marketing_manager', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('marketing_manager', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('marketing_manager', 'leads:update')).not.toThrow());
    it('can transition', () => expect(() => checkLeadPermission('marketing_manager', 'leads:transition')).not.toThrow());
    it('can view dashboard', () => expect(() => checkLeadPermission('marketing_manager', 'leads:dashboard')).not.toThrow());
  });

  describe('sales_manager', () => {
    it('can read', () => expect(() => checkLeadPermission('sales_manager', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('sales_manager', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('sales_manager', 'leads:update')).not.toThrow());
    it('can transition', () => expect(() => checkLeadPermission('sales_manager', 'leads:transition')).not.toThrow());
    it('can view dashboard', () => expect(() => checkLeadPermission('sales_manager', 'leads:dashboard')).not.toThrow());
  });

  describe('lead_qualification_manager', () => {
    it('can read', () => expect(() => checkLeadPermission('lead_qualification_manager', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('lead_qualification_manager', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('lead_qualification_manager', 'leads:update')).not.toThrow());
    it('can transition', () => expect(() => checkLeadPermission('lead_qualification_manager', 'leads:transition')).not.toThrow());
    it('cannot view dashboard', () => expect(() => checkLeadPermission('lead_qualification_manager', 'leads:dashboard')).toThrow(ForbiddenError));
  });

  describe('social_media_manager', () => {
    it('can read', () => expect(() => checkLeadPermission('social_media_manager', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('social_media_manager', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('social_media_manager', 'leads:update')).not.toThrow());
    it('cannot transition', () => expect(() => checkLeadPermission('social_media_manager', 'leads:transition')).toThrow(ForbiddenError));
    it('cannot view dashboard', () => expect(() => checkLeadPermission('social_media_manager', 'leads:dashboard')).toThrow(ForbiddenError));
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkLeadPermission('specialist', 'leads:read')).not.toThrow());
    it('can create', () => expect(() => checkLeadPermission('specialist', 'leads:create')).not.toThrow());
    it('can update', () => expect(() => checkLeadPermission('specialist', 'leads:update')).not.toThrow());
    it('cannot transition', () => expect(() => checkLeadPermission('specialist', 'leads:transition')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkLeadPermission('viewer', 'leads:read')).not.toThrow());
    it('cannot create', () => expect(() => checkLeadPermission('viewer', 'leads:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkLeadPermission('viewer', 'leads:update')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(LEAD_LIFECYCLE_PERMISSIONS)).toContain('admin');
      expect(Object.keys(LEAD_LIFECYCLE_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(LEAD_LIFECYCLE_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(LEAD_LIFECYCLE_PERMISSIONS)).toContain('lead_qualification_manager');
      expect(Object.keys(LEAD_LIFECYCLE_PERMISSIONS)).toContain('social_media_manager');
    });
  });
});
