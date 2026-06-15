import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['approval:submit', 'approval:decide', 'approval:read', 'approval:manage'],
  cco: ['approval:submit', 'approval:decide', 'approval:read'],
  department_head: ['approval:submit', 'approval:decide', 'approval:read'],
  specialist: ['approval:submit', 'approval:read'],
  reviewer: ['approval:read'],
  viewer: ['approval:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

describe('Approval Workflow RBAC', () => {
  describe('admin', () => {
    it('can submit', () => expect(() => checkPermission('admin', 'approval:submit')).not.toThrow());
    it('can decide', () => expect(() => checkPermission('admin', 'approval:decide')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'approval:read')).not.toThrow());
    it('can manage', () => expect(() => checkPermission('admin', 'approval:manage')).not.toThrow());
  });

  describe('cco', () => {
    it('can submit', () => expect(() => checkPermission('cco', 'approval:submit')).not.toThrow());
    it('can decide', () => expect(() => checkPermission('cco', 'approval:decide')).not.toThrow());
    it('can read', () => expect(() => checkPermission('cco', 'approval:read')).not.toThrow());
    it('cannot manage', () => expect(() => checkPermission('cco', 'approval:manage')).toThrow(ForbiddenError));
  });

  describe('department_head', () => {
    it('can submit', () => expect(() => checkPermission('department_head', 'approval:submit')).not.toThrow());
    it('can decide', () => expect(() => checkPermission('department_head', 'approval:decide')).not.toThrow());
    it('can read', () => expect(() => checkPermission('department_head', 'approval:read')).not.toThrow());
    it('cannot manage', () => expect(() => checkPermission('department_head', 'approval:manage')).toThrow(ForbiddenError));
  });

  describe('specialist', () => {
    it('can submit', () => expect(() => checkPermission('specialist', 'approval:submit')).not.toThrow());
    it('cannot decide', () => expect(() => checkPermission('specialist', 'approval:decide')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('specialist', 'approval:read')).not.toThrow());
    it('cannot manage', () => expect(() => checkPermission('specialist', 'approval:manage')).toThrow(ForbiddenError));
  });

  describe('reviewer', () => {
    it('cannot submit', () => expect(() => checkPermission('reviewer', 'approval:submit')).toThrow(ForbiddenError));
    it('cannot decide', () => expect(() => checkPermission('reviewer', 'approval:decide')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('reviewer', 'approval:read')).not.toThrow());
    it('cannot manage', () => expect(() => checkPermission('reviewer', 'approval:manage')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('cannot submit', () => expect(() => checkPermission('viewer', 'approval:submit')).toThrow(ForbiddenError));
    it('cannot decide', () => expect(() => checkPermission('viewer', 'approval:decide')).toThrow(ForbiddenError));
    it('can read', () => expect(() => checkPermission('viewer', 'approval:read')).not.toThrow());
    it('cannot manage', () => expect(() => checkPermission('viewer', 'approval:manage')).toThrow(ForbiddenError));
  });
});
