import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { EVENT_PERMISSIONS, checkEventPermission } from '../policy';

describe('Commercial Events RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkEventPermission('admin', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('admin', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('admin', 'events:update')).not.toThrow());
    it('can transition', () => expect(() => checkEventPermission('admin', 'events:transition')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('admin', 'events:link')).not.toThrow());
  });

  describe('cco', () => {
    it('can read', () => expect(() => checkEventPermission('cco', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('cco', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('cco', 'events:update')).not.toThrow());
    it('can transition', () => expect(() => checkEventPermission('cco', 'events:transition')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('cco', 'events:link')).not.toThrow());
  });

  describe('department_head', () => {
    it('can read', () => expect(() => checkEventPermission('department_head', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('department_head', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('department_head', 'events:update')).not.toThrow());
    it('can transition', () => expect(() => checkEventPermission('department_head', 'events:transition')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('department_head', 'events:link')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkEventPermission('marketing_manager', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('marketing_manager', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('marketing_manager', 'events:update')).not.toThrow());
    it('can transition', () => expect(() => checkEventPermission('marketing_manager', 'events:transition')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('marketing_manager', 'events:link')).not.toThrow());
  });

  describe('social_media_manager', () => {
    it('can read', () => expect(() => checkEventPermission('social_media_manager', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('social_media_manager', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('social_media_manager', 'events:update')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('social_media_manager', 'events:link')).not.toThrow());
    it('cannot transition', () => expect(() => checkEventPermission('social_media_manager', 'events:transition')).toThrow(ForbiddenError));
  });

  describe('sales_manager', () => {
    it('can read', () => expect(() => checkEventPermission('sales_manager', 'events:read')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('sales_manager', 'events:update')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('sales_manager', 'events:link')).not.toThrow());
    it('cannot create', () => expect(() => checkEventPermission('sales_manager', 'events:create')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkEventPermission('sales_manager', 'events:transition')).toThrow(ForbiddenError));
  });

  describe('lead_qualification_manager', () => {
    it('can read', () => expect(() => checkEventPermission('lead_qualification_manager', 'events:read')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('lead_qualification_manager', 'events:update')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('lead_qualification_manager', 'events:link')).not.toThrow());
    it('cannot create', () => expect(() => checkEventPermission('lead_qualification_manager', 'events:create')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkEventPermission('lead_qualification_manager', 'events:transition')).toThrow(ForbiddenError));
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkEventPermission('specialist', 'events:read')).not.toThrow());
    it('can create', () => expect(() => checkEventPermission('specialist', 'events:create')).not.toThrow());
    it('can update', () => expect(() => checkEventPermission('specialist', 'events:update')).not.toThrow());
    it('can link', () => expect(() => checkEventPermission('specialist', 'events:link')).not.toThrow());
    it('cannot transition', () => expect(() => checkEventPermission('specialist', 'events:transition')).toThrow(ForbiddenError));
  });

  describe('reviewer', () => {
    it('can read', () => expect(() => checkEventPermission('reviewer', 'events:read')).not.toThrow());
    it('cannot create', () => expect(() => checkEventPermission('reviewer', 'events:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkEventPermission('reviewer', 'events:update')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkEventPermission('reviewer', 'events:transition')).toThrow(ForbiddenError));
    it('cannot link', () => expect(() => checkEventPermission('reviewer', 'events:link')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkEventPermission('viewer', 'events:read')).not.toThrow());
    it('cannot create', () => expect(() => checkEventPermission('viewer', 'events:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkEventPermission('viewer', 'events:update')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkEventPermission('viewer', 'events:transition')).toThrow(ForbiddenError));
    it('cannot link', () => expect(() => checkEventPermission('viewer', 'events:link')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles defined', () => {
      expect(Object.keys(EVENT_PERMISSIONS)).toContain('admin');
      expect(Object.keys(EVENT_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(EVENT_PERMISSIONS)).toContain('social_media_manager');
      expect(Object.keys(EVENT_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(EVENT_PERMISSIONS)).toContain('lead_qualification_manager');
    });
  });
});
