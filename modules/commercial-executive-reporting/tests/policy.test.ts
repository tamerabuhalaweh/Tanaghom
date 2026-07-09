import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkExecutiveReportingPermission } from '../policy';

describe('commercial executive reporting policy', () => {
  for (const role of ['admin', 'cco']) {
    it(`${role} can read, preview, and schedule executive reports`, () => {
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:read')).not.toThrow();
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:report')).not.toThrow();
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:schedule')).not.toThrow();
    });
  }

  for (const role of ['department_head', 'marketing_manager', 'sales_manager', 'lead_qualification_manager', 'social_media_manager', 'specialist', 'reviewer', 'viewer']) {
    it(`${role} cannot access executive reporting`, () => {
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:read')).toThrow(ForbiddenError);
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:report')).toThrow(ForbiddenError);
      expect(() => checkExecutiveReportingPermission(role, 'commercial:executive:schedule')).toThrow(ForbiddenError);
    });
  }
});
