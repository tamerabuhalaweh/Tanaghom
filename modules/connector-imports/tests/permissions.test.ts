import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { CONNECTOR_IMPORT_PERMISSIONS, checkConnectorPermission } from '../policy';

describe('Connector Import RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkConnectorPermission('admin', 'connector:read')).not.toThrow());
    it('can create', () => expect(() => checkConnectorPermission('admin', 'connector:create')).not.toThrow());
    it('can update', () => expect(() => checkConnectorPermission('admin', 'connector:update')).not.toThrow());
    it('can disable', () => expect(() => checkConnectorPermission('admin', 'connector:disable')).not.toThrow());
    it('can dry_run', () => expect(() => checkConnectorPermission('admin', 'connector:dry_run')).not.toThrow());
    it('can import', () => expect(() => checkConnectorPermission('admin', 'connector:import')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:read')).not.toThrow());
    it('can create', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:create')).not.toThrow());
    it('can update', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:update')).not.toThrow());
    it('can dry_run', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:dry_run')).not.toThrow());
    it('can import', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:import')).not.toThrow());
    it('cannot disable', () => expect(() => checkConnectorPermission('marketing_manager', 'connector:disable')).toThrow(ForbiddenError));
  });

  describe('read-only roles', () => {
    const readOnlyRoles = ['social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];

    for (const role of readOnlyRoles) {
      it(`${role} can read`, () => expect(() => checkConnectorPermission(role, 'connector:read')).not.toThrow());
      it(`${role} cannot create`, () => expect(() => checkConnectorPermission(role, 'connector:create')).toThrow(ForbiddenError));
      it(`${role} cannot update`, () => expect(() => checkConnectorPermission(role, 'connector:update')).toThrow(ForbiddenError));
      it(`${role} cannot disable`, () => expect(() => checkConnectorPermission(role, 'connector:disable')).toThrow(ForbiddenError));
      it(`${role} cannot dry_run`, () => expect(() => checkConnectorPermission(role, 'connector:dry_run')).toThrow(ForbiddenError));
      it(`${role} cannot import`, () => expect(() => checkConnectorPermission(role, 'connector:import')).toThrow(ForbiddenError));
    }
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('admin');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('social_media_manager');
      expect(Object.keys(CONNECTOR_IMPORT_PERMISSIONS)).toContain('sales_manager');
    });
  });
});
