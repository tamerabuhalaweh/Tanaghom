import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Permission matrix test for campaigns module
const PERMISSIONS: Record<string, string[]> = {
  admin: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  cco: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  department_head: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  specialist: ['campaigns:read', 'campaigns:create', 'campaigns:update'],
  reviewer: ['campaigns:read'],
  viewer: ['campaigns:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

describe('Campaigns RBAC', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkPermission('admin', 'campaigns:read')).not.toThrow());
    it('can create', () => expect(() => checkPermission('admin', 'campaigns:create')).not.toThrow());
    it('can update', () => expect(() => checkPermission('admin', 'campaigns:update')).not.toThrow());
    it('can transition', () => expect(() => checkPermission('admin', 'campaigns:transition')).not.toThrow());
  });

  describe('cco', () => {
    it('can read', () => expect(() => checkPermission('cco', 'campaigns:read')).not.toThrow());
    it('can create', () => expect(() => checkPermission('cco', 'campaigns:create')).not.toThrow());
    it('can update', () => expect(() => checkPermission('cco', 'campaigns:update')).not.toThrow());
    it('can transition', () => expect(() => checkPermission('cco', 'campaigns:transition')).not.toThrow());
  });

  describe('department_head', () => {
    it('can read', () => expect(() => checkPermission('department_head', 'campaigns:read')).not.toThrow());
    it('can create', () => expect(() => checkPermission('department_head', 'campaigns:create')).not.toThrow());
    it('can update', () => expect(() => checkPermission('department_head', 'campaigns:update')).not.toThrow());
    it('can transition', () => expect(() => checkPermission('department_head', 'campaigns:transition')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkPermission('specialist', 'campaigns:read')).not.toThrow());
    it('can create', () => expect(() => checkPermission('specialist', 'campaigns:create')).not.toThrow());
    it('can update', () => expect(() => checkPermission('specialist', 'campaigns:update')).not.toThrow());
    it('cannot transition', () => expect(() => checkPermission('specialist', 'campaigns:transition')).toThrow(ForbiddenError));
  });

  describe('reviewer', () => {
    it('can read', () => expect(() => checkPermission('reviewer', 'campaigns:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('reviewer', 'campaigns:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkPermission('reviewer', 'campaigns:update')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkPermission('reviewer', 'campaigns:transition')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPermission('viewer', 'campaigns:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('viewer', 'campaigns:create')).toThrow(ForbiddenError));
    it('cannot update', () => expect(() => checkPermission('viewer', 'campaigns:update')).toThrow(ForbiddenError));
    it('cannot transition', () => expect(() => checkPermission('viewer', 'campaigns:transition')).toThrow(ForbiddenError));
  });
});
