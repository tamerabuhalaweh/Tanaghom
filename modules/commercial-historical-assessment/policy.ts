import { ForbiddenError } from '@shared/errors';

export type HistoricalAssessmentPermission =
  | 'assessment:read'
  | 'assessment:create'
  | 'assessment:generate'
  | 'assessment:approve';

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

const CREATE_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];
// Customer policy #140 reserves final approval for executive authority.
const APPROVE_ROLES = ['admin', 'cco'];

export function checkHistoricalAssessmentPermission(role: string, permission: HistoricalAssessmentPermission): void {
  const allowed = permission === 'assessment:read'
    ? READ_ROLES
    : permission === 'assessment:approve'
      ? APPROVE_ROLES
      : CREATE_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canApproveHistoricalAssessment(role: string): boolean {
  return APPROVE_ROLES.includes(role);
}
