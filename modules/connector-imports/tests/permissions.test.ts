import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { CONNECTOR_IMPORT_PERMISSIONS, checkConnectorImportPermission } from '../policy';

describe('Connector Imports RBAC (real policy)', () => {
  describe('all product roles can read', () => {
    const allowedRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'sales_manager', 'social_media_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];
    for (const role of allowedRoles) {
      it(`${role} can read connector imports`, () => expect(() => checkConnectorImportPermission(role, 'connector_imports:read')).not.toThrow());
    }
  });

  describe('admin/cco/dept_head can create and update', () => {
    const writeRoles = ['admin', 'cco', 'department_head'];
    for (const role of writeRoles) {
      it(`${role} can create import jobs`, () => expect(() => checkConnectorImportPermission(role, 'connector_imports:create')).not.toThrow());
      it(`${role} can update import jobs`, () => expect(() => checkConnectorImportPermission(role, 'connector_imports:update')).not.toThrow());
    }
  });

  describe('read-only roles cannot create or update', () => {
    const readOnlyRoles = ['marketing_manager', 'sales_manager', 'social_media_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];
    for (const role of readOnlyRoles) {
      it(`${role} cannot create import jobs`, () => expect(() => checkConnectorImportPermission(role, 'connector_imports:create')).toThrow(ForbiddenError));
      it(`${role} cannot update import jobs`, () => expect(() => checkConnectorImportPermission(role, 'connector_imports:update')).toThrow(ForbiddenError));
    }
  });

  describe('unknown roles are rejected', () => {
    it('unknown role is rejected for read', () => expect(() => checkConnectorImportPermission('unknown_role', 'connector_imports:read')).toThrow(ForbiddenError));
    it('unknown role is rejected for create', () => expect(() => checkConnectorImportPermission('unknown_role', 'connector_imports:create')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('admin');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('cco');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('department_head');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('viewer');
    });
  });
});
