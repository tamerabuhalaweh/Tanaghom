import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkCsvPermission } from '../policy';

describe('CSV Import RBAC (real policy)', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkCsvPermission('admin', 'csv:read')).not.toThrow());
    it('can dry_run', () => expect(() => checkCsvPermission('admin', 'csv:dry_run')).not.toThrow());
    it('can import', () => expect(() => checkCsvPermission('admin', 'csv:import')).not.toThrow());
  });

  describe('marketing_manager', () => {
    it('can read', () => expect(() => checkCsvPermission('marketing_manager', 'csv:read')).not.toThrow());
    it('can dry_run', () => expect(() => checkCsvPermission('marketing_manager', 'csv:dry_run')).not.toThrow());
    it('can import', () => expect(() => checkCsvPermission('marketing_manager', 'csv:import')).not.toThrow());
  });

  describe('read-only roles', () => {
    const readOnlyRoles = ['social_media_manager', 'sales_manager', 'viewer'];
    for (const role of readOnlyRoles) {
      it(`${role} can read`, () => expect(() => checkCsvPermission(role, 'csv:read')).not.toThrow());
      it(`${role} cannot dry_run`, () => expect(() => checkCsvPermission(role, 'csv:dry_run')).toThrow(ForbiddenError));
      it(`${role} cannot import`, () => expect(() => checkCsvPermission(role, 'csv:import')).toThrow(ForbiddenError));
    }
  });
});
