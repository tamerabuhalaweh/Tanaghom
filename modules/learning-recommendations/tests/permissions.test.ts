import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { LEARNING_RECOMMENDATIONS_PERMISSIONS, checkLearningRecommendationsPermission } from '../policy';

describe('Learning Recommendations RBAC (real policy)', () => {
  describe('all product roles can read recommendations', () => {
    const allowedRoles = ['admin', 'cco', 'department_head', 'marketing_manager', 'sales_manager', 'social_media_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'];
    for (const role of allowedRoles) {
      it(`${role} can read learning recommendations`, () => expect(() => checkLearningRecommendationsPermission(role)).not.toThrow());
    }
  });

  describe('unknown roles are rejected', () => {
    it('unknown role is rejected', () => expect(() => checkLearningRecommendationsPermission('unknown_role')).toThrow(ForbiddenError));
    it('empty role is rejected', () => expect(() => checkLearningRecommendationsPermission('')).toThrow(ForbiddenError));
  });

  describe('permission matrix completeness', () => {
    it('has all expected roles', () => {
      expect(Object.keys(LEARNING_RECOMMENDATIONS_PERMISSIONS)).toContain('admin');
      expect(Object.keys(LEARNING_RECOMMENDATIONS_PERMISSIONS)).toContain('marketing_manager');
      expect(Object.keys(LEARNING_RECOMMENDATIONS_PERMISSIONS)).toContain('sales_manager');
      expect(Object.keys(LEARNING_RECOMMENDATIONS_PERMISSIONS)).toContain('viewer');
    });

    it('every role has learning_recommendations:read', () => {
      for (const [, perms] of Object.entries(LEARNING_RECOMMENDATIONS_PERMISSIONS)) {
        expect(perms).toContain('learning_recommendations:read');
      }
    });
  });
});
