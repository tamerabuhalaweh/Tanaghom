import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { MASTER_AGGREGATION_PERMISSIONS, checkMasterAggregationPermission } from '../policy';

describe('Master Event Aggregation RBAC', () => {
  describe('roles that CAN access master dashboard', () => {
    const allowedRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'sales_manager', 'reviewer', 'viewer'];

    for (const role of allowedRoles) {
      it(`${role} can access master dashboard`, () => {
        expect(() => checkMasterAggregationPermission(role)).not.toThrow();
      });
    }
  });

  describe('roles that CANNOT access master dashboard', () => {
    const deniedRoles = ['social_media_manager', 'lead_qualification_manager', 'specialist'];

    for (const role of deniedRoles) {
      it(`${role} cannot access master dashboard`, () => {
        expect(() => checkMasterAggregationPermission(role)).toThrow(ForbiddenError);
      });
    }
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles defined', () => {
      expect(Object.keys(MASTER_AGGREGATION_PERMISSIONS)).toContain('admin');
      expect(Object.keys(MASTER_AGGREGATION_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(MASTER_AGGREGATION_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(MASTER_AGGREGATION_PERMISSIONS)).toContain('social_media_manager');
    });
  });
});
