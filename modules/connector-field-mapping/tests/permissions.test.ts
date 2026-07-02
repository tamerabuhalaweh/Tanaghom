import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { FIELD_MAPPING_PERMISSIONS, checkFieldMappingPermission } from '../policy';

describe('Field Mapping RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkFieldMappingPermission('admin', 'mapping:read')).not.toThrow());
    it('can create', () => expect(() => checkFieldMappingPermission('admin', 'mapping:create')).not.toThrow());
    it('can update', () => expect(() => checkFieldMappingPermission('admin', 'mapping:update')).not.toThrow());
    it('can delete', () => expect(() => checkFieldMappingPermission('admin', 'mapping:delete')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkFieldMappingPermission('marketing_manager', 'mapping:read')).not.toThrow());
    it('can create', () => expect(() => checkFieldMappingPermission('marketing_manager', 'mapping:create')).not.toThrow());
    it('can update', () => expect(() => checkFieldMappingPermission('marketing_manager', 'mapping:update')).not.toThrow());
    it('cannot delete', () => expect(() => checkFieldMappingPermission('marketing_manager', 'mapping:delete')).toThrow(ForbiddenError));
  });

  describe('read-only roles', () => {
    const readOnlyRoles = ['social_media_manager', 'sales_manager', 'viewer'];
    for (const role of readOnlyRoles) {
      it(`${role} can read`, () => expect(() => checkFieldMappingPermission(role, 'mapping:read')).not.toThrow());
      it(`${role} cannot create`, () => expect(() => checkFieldMappingPermission(role, 'mapping:create')).toThrow(ForbiddenError));
    }
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(FIELD_MAPPING_PERMISSIONS)).toContain('admin');
      expect(Object.keys(FIELD_MAPPING_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(FIELD_MAPPING_PERMISSIONS)).toContain('social_media_manager');
    });
  });
});
