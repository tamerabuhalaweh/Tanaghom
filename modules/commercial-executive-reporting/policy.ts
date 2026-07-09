import { ForbiddenError } from '@shared/errors';

export const EXECUTIVE_REPORTING_PERMISSIONS: Record<string, string[]> = {
  admin: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  cco: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  department_head: [],
  marketing_manager: [],
  sales_manager: [],
  lead_qualification_manager: [],
  social_media_manager: [],
  specialist: [],
  reviewer: [],
  viewer: [],
};

export function checkExecutiveReportingPermission(role: string, permission: string): void {
  const allowed = EXECUTIVE_REPORTING_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
