import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkReadinessPermission } from '../policy';

describe('Connector Readiness RBAC (real policy)', () => {
  const allRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];

  for (const role of allRoles) {
    it(`${role} can read readiness`, () => expect(() => checkReadinessPermission(role)).not.toThrow());
  }

  it('unknown role is rejected', () => expect(() => checkReadinessPermission('unknown')).toThrow(ForbiddenError));
});
