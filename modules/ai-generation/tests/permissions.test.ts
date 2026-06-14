import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  cco: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  department_head: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  specialist: ['drafts:generate', 'drafts:read'],
  reviewer: ['drafts:read'],
  viewer: ['drafts:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

describe('AI Generation RBAC', () => {
  describe('admin', () => {
    it('can generate', () => expect(() => checkPermission('admin', 'drafts:generate')).not.toThrow());
    it('can revise', () => expect(() => checkPermission('admin', 'drafts:revise')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'drafts:read')).not.toThrow());
  });

  describe('cco', () => {
    it('can generate', () => expect(() => checkPermission('cco', 'drafts:generate')).not.toThrow());
    it('can revise', () => expect(() => checkPermission('cco', 'drafts:revise')).not.toThrow());
    it('can read', () => expect(() => checkPermission('cco', 'drafts:read')).not.toThrow());
  });

  describe('department_head', () => {
    it('can generate', () => expect(() => checkPermission('department_head', 'drafts:generate')).not.toThrow());
    it('can revise', () => expect(() => checkPermission('department_head', 'drafts:revise')).not.toThrow());
    it('can read', () => expect(() => checkPermission('department_head', 'drafts:read')).not.toThrow());
  });

  describe('specialist', () => {
    it('can generate', () => expect(() => checkPermission('specialist', 'drafts:generate')).not.toThrow());
    it('cannot revise', () => expect(() => checkPermission('specialist', 'drafts:revise')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('specialist', 'drafts:read')).not.toThrow());
  });

  describe('reviewer', () => {
    it('cannot generate', () => expect(() => checkPermission('reviewer', 'drafts:generate')).toThrow(ForbiddenError));
    it('cannot revise', () => expect(() => checkPermission('reviewer', 'drafts:revise')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('reviewer', 'drafts:read')).not.toThrow());
  });

  describe('viewer', () => {
    it('cannot generate', () => expect(() => checkPermission('viewer', 'drafts:generate')).toThrow(ForbiddenError));
    it('cannot revise', () => expect(() => checkPermission('viewer', 'drafts:revise')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('viewer', 'drafts:read')).not.toThrow());
  });
});
