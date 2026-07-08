import { ForbiddenError } from '@shared/errors';

export const EXECUTIVE_REPORTING_PERMISSIONS: Record<string, string[]> = {
  admin: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  cco: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  department_head: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  marketing_manager: ['commercial:executive:read', 'commercial:executive:report', 'commercial:executive:schedule'],
  sales_manager: ['commercial:executive:read', 'commercial:executive:report'],
  lead_qualification_manager: ['commercial:executive:read', 'commercial:executive:report'],
  social_media_manager: ['commercial:executive:read', 'commercial:executive:report'],
  specialist: ['commercial:executive:read'],
  reviewer: ['commercial:executive:read'],
  viewer: ['commercial:executive:read'],
};

export function checkExecutiveReportingPermission(role: string, permission: string): void {
  const allowed = EXECUTIVE_REPORTING_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
