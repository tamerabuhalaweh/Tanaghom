import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkGhlSetupReadPermission, checkGhlSetupWritePermission } from '../policy';

describe('GHL Setup RBAC (real policy)', () => {
  const readRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];
  const writeRoles = ['admin', 'cco', 'department_head', 'marketing_manager'];

  for (const role of readRoles) {
    it(`${role} can read GHL setup`, () => {
      expect(() => checkGhlSetupReadPermission(role)).not.toThrow();
    });
  }

  for (const role of writeRoles) {
    it(`${role} can write GHL setup mappings`, () => {
      expect(() => checkGhlSetupWritePermission(role)).not.toThrow();
    });
  }

  it('unknown role is rejected for read', () => {
    expect(() => checkGhlSetupReadPermission('unknown')).toThrow(ForbiddenError);
  });

  it('unknown role is rejected for write', () => {
    expect(() => checkGhlSetupWritePermission('unknown')).toThrow(ForbiddenError);
  });

  const readOnlyRoles = ['social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];

  for (const role of readOnlyRoles) {
    it(`${role} cannot write GHL setup mappings`, () => {
      expect(() => checkGhlSetupWritePermission(role)).toThrow(ForbiddenError);
    });
  }
});
