import { ForbiddenError } from '@shared/errors';

export type AnnualPlanningPermission =
  | 'annual-plan:read'
  | 'annual-plan:create'
  | 'annual-plan:update'
  | 'annual-plan:approve';

const READ_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'social_media_manager',
  'sales_manager',
  'lead_qualification_manager',
  'specialist',
  'reviewer',
  'viewer',
];
const CREATE_ROLES = ['admin', 'cco', 'department_head'];
// Customer decision, 2026-07-23: final strategy/KPI approval belongs to the CCO.
const APPROVE_ROLES = ['cco'];

export function checkAnnualPlanningPermission(
  role: string,
  permission: AnnualPlanningPermission,
): void {
  const allowed =
    permission === 'annual-plan:read'
      ? READ_ROLES
      : permission === 'annual-plan:approve'
        ? APPROVE_ROLES
        : CREATE_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canManageAnnualPlanning(role: string): boolean {
  return CREATE_ROLES.includes(role);
}

export function canApproveAnnualPlanning(role: string): boolean {
  return APPROVE_ROLES.includes(role);
}
