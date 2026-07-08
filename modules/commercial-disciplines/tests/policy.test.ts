import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkCommercialDisciplinePermission } from '../policy';

describe('Commercial discipline permissions', () => {
  it('allows commercial leaders to read, create, and update discipline records', () => {
    for (const role of ['admin', 'cco', 'department_head', 'marketing_manager']) {
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:read')).not.toThrow();
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:create')).not.toThrow();
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:update')).not.toThrow();
    }
  });

  it('allows specialist operating roles to create records but not update approved workspace records', () => {
    for (const role of ['specialist', 'sales_manager', 'social_media_manager', 'lead_qualification_manager']) {
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:read')).not.toThrow();
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:create')).not.toThrow();
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:update')).toThrow(ForbiddenError);
    }
  });

  it('keeps reviewer and viewer read-only', () => {
    for (const role of ['reviewer', 'viewer']) {
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:read')).not.toThrow();
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:create')).toThrow(ForbiddenError);
      expect(() => checkCommercialDisciplinePermission(role, 'commercial:disciplines:update')).toThrow(ForbiddenError);
    }
  });
});
