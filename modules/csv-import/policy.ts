import { ForbiddenError } from '@shared/errors';

export const CSV_IMPORT_PERMISSIONS: Record<string, string[]> = {
  admin: ['csv:read', 'csv:dry_run', 'csv:import'],
  cco: ['csv:read', 'csv:dry_run', 'csv:import'],
  department_head: ['csv:read', 'csv:dry_run', 'csv:import'],
  marketing_manager: ['csv:read', 'csv:dry_run', 'csv:import'],
  social_media_manager: ['csv:read'],
  sales_manager: ['csv:read'],
  lead_qualification_manager: ['csv:read'],
  specialist: ['csv:read'],
  reviewer: ['csv:read'],
  viewer: ['csv:read'],
};

export function checkCsvPermission(role: string, permission: string): void {
  const allowed = CSV_IMPORT_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
