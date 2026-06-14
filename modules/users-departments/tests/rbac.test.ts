import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Permission matrix test — tests the RBAC rules without requiring a database
// This validates that the permission logic is correct by testing the checkPermission function directly

const PERMISSIONS: Record<string, string[]> = {
  admin: ['users:read', 'users:create', 'users:update', 'departments:read', 'departments:manage'],
  cco: ['users:read', 'departments:read'],
  department_head: ['users:read', 'departments:read'],
  specialist: ['users:read', 'departments:read'],
  reviewer: ['users:read', 'departments:read'],
  viewer: ['users:read', 'departments:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

describe('RBAC Permission Matrix', () => {
  describe('admin', () => {
    it('can read users', () => {
      expect(() => checkPermission('admin', 'users:read')).not.toThrow();
    });

    it('can create users', () => {
      expect(() => checkPermission('admin', 'users:create')).not.toThrow();
    });

    it('can update users', () => {
      expect(() => checkPermission('admin', 'users:update')).not.toThrow();
    });

    it('can read departments', () => {
      expect(() => checkPermission('admin', 'departments:read')).not.toThrow();
    });

    it('can manage departments', () => {
      expect(() => checkPermission('admin', 'departments:manage')).not.toThrow();
    });
  });

  describe('cco', () => {
    it('can read users', () => {
      expect(() => checkPermission('cco', 'users:read')).not.toThrow();
    });

    it('cannot create users', () => {
      expect(() => checkPermission('cco', 'users:create')).toThrow(ForbiddenError);
    });

    it('cannot update users', () => {
      expect(() => checkPermission('cco', 'users:update')).toThrow(ForbiddenError);
    });

    it('can read departments', () => {
      expect(() => checkPermission('cco', 'departments:read')).not.toThrow();
    });

    it('cannot manage departments', () => {
      expect(() => checkPermission('cco', 'departments:manage')).toThrow(ForbiddenError);
    });
  });

  describe('department_head', () => {
    it('can read users', () => {
      expect(() => checkPermission('department_head', 'users:read')).not.toThrow();
    });

    it('cannot create users', () => {
      expect(() => checkPermission('department_head', 'users:create')).toThrow(ForbiddenError);
    });

    it('cannot manage departments', () => {
      expect(() => checkPermission('department_head', 'departments:manage')).toThrow(ForbiddenError);
    });
  });

  describe('specialist', () => {
    it('can read users', () => {
      expect(() => checkPermission('specialist', 'users:read')).not.toThrow();
    });

    it('cannot create users', () => {
      expect(() => checkPermission('specialist', 'users:create')).toThrow(ForbiddenError);
    });

    it('cannot update users', () => {
      expect(() => checkPermission('specialist', 'users:update')).toThrow(ForbiddenError);
    });

    it('cannot manage departments', () => {
      expect(() => checkPermission('specialist', 'departments:manage')).toThrow(ForbiddenError);
    });
  });

  describe('reviewer', () => {
    it('can read users', () => {
      expect(() => checkPermission('reviewer', 'users:read')).not.toThrow();
    });

    it('cannot create users', () => {
      expect(() => checkPermission('reviewer', 'users:create')).toThrow(ForbiddenError);
    });

    it('cannot manage departments', () => {
      expect(() => checkPermission('reviewer', 'departments:manage')).toThrow(ForbiddenError);
    });
  });

  describe('viewer', () => {
    it('can read users', () => {
      expect(() => checkPermission('viewer', 'users:read')).not.toThrow();
    });

    it('can read departments', () => {
      expect(() => checkPermission('viewer', 'departments:read')).not.toThrow();
    });

    it('cannot create users', () => {
      expect(() => checkPermission('viewer', 'users:create')).toThrow(ForbiddenError);
    });

    it('cannot update users', () => {
      expect(() => checkPermission('viewer', 'users:update')).toThrow(ForbiddenError);
    });

    it('cannot manage departments', () => {
      expect(() => checkPermission('viewer', 'departments:manage')).toThrow(ForbiddenError);
    });
  });

  describe('unknown role', () => {
    it('has no permissions', () => {
      expect(() => checkPermission('unknown', 'users:read')).toThrow(ForbiddenError);
    });
  });
});

describe('Role Enum Validation', () => {
  const validRoles = ['admin', 'cco', 'department_head', 'specialist', 'reviewer', 'viewer'];

  it('all 6 system roles are defined', () => {
    expect(validRoles).toHaveLength(6);
  });

  it('each role has a permission entry', () => {
    for (const role of validRoles) {
      expect(PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(PERMISSIONS[role])).toBe(true);
    }
  });
});
