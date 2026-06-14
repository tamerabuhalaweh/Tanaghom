import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['algo:score', 'algo:rules:read', 'algo:rules:manage'],
  cco: ['algo:score', 'algo:rules:read'],
  department_head: ['algo:score', 'algo:rules:read'],
  specialist: ['algo:score', 'algo:rules:read'],
  reviewer: ['algo:score', 'algo:rules:read'],
  viewer: ['algo:rules:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

describe('Algorithm Intelligence RBAC', () => {
  describe('admin', () => {
    it('can score', () => expect(() => checkPermission('admin', 'algo:score')).not.toThrow());
    it('can read rules', () => expect(() => checkPermission('admin', 'algo:rules:read')).not.toThrow());
    it('can manage rules', () => expect(() => checkPermission('admin', 'algo:rules:manage')).not.toThrow());
  });

  describe('cco', () => {
    it('can score', () => expect(() => checkPermission('cco', 'algo:score')).not.toThrow());
    it('can read rules', () => expect(() => checkPermission('cco', 'algo:rules:read')).not.toThrow());
    it('cannot manage rules', () => expect(() => checkPermission('cco', 'algo:rules:manage')).toThrow(ForbiddenError));
  });

  describe('department_head', () => {
    it('can score', () => expect(() => checkPermission('department_head', 'algo:score')).not.toThrow());
    it('can read rules', () => expect(() => checkPermission('department_head', 'algo:rules:read')).not.toThrow());
    it('cannot manage rules', () => expect(() => checkPermission('department_head', 'algo:rules:manage')).toThrow(ForbiddenError));
  });

  describe('specialist', () => {
    it('can score', () => expect(() => checkPermission('specialist', 'algo:score')).not.toThrow());
    it('can read rules', () => expect(() => checkPermission('specialist', 'algo:rules:read')).not.toThrow());
    it('cannot manage rules', () => expect(() => checkPermission('specialist', 'algo:rules:manage')).toThrow(ForbiddenError));
  });

  describe('reviewer', () => {
    it('can score', () => expect(() => checkPermission('reviewer', 'algo:score')).not.toThrow());
    it('can read rules', () => expect(() => checkPermission('reviewer', 'algo:rules:read')).not.toThrow());
    it('cannot manage rules', () => expect(() => checkPermission('reviewer', 'algo:rules:manage')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('cannot score', () => expect(() => checkPermission('viewer', 'algo:score')).toThrow(ForbiddenError));
    it('can read rules', () => expect(() => checkPermission('viewer', 'algo:rules:read')).not.toThrow());
    it('cannot manage rules', () => expect(() => checkPermission('viewer', 'algo:rules:manage')).toThrow(ForbiddenError));
  });
});
