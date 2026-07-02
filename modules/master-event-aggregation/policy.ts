import { ForbiddenError } from '@shared/errors';

export const MASTER_AGGREGATION_PERMISSIONS: Record<string, string[]> = {
  admin: ['master_dashboard:read'],
  cco: ['master_dashboard:read'],
  department_head: ['master_dashboard:read'],
  marketing_manager: ['master_dashboard:read'],
  sales_manager: ['master_dashboard:read'],
  social_media_manager: [],
  lead_qualification_manager: [],
  specialist: [],
  reviewer: ['master_dashboard:read'],
  viewer: ['master_dashboard:read'],
};

export function checkMasterAggregationPermission(role: string): void {
  const allowed = MASTER_AGGREGATION_PERMISSIONS[role];
  if (!allowed || !allowed.includes('master_dashboard:read')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'master_dashboard:read'`);
  }
}
