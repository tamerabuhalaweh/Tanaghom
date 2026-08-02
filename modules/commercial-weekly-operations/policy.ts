import { ForbiddenError } from '@shared/errors';
import type { WeeklyWorkPermission } from './types';

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
const MANAGE_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];
const CONTRIBUTOR_ROLES = [
  ...MANAGE_ROLES,
  'social_media_manager',
  'sales_manager',
  'lead_qualification_manager',
  'specialist',
];
// Final business approval follows the customer-confirmed commercial governance model.
const APPROVER_ROLES = ['cco'];

export function checkWeeklyWorkPermission(role: string, permission: WeeklyWorkPermission): void {
  const allowed = permission === 'weekly-work:read'
    ? READ_ROLES
    : permission === 'weekly-work:approve'
      ? APPROVER_ROLES
      : permission === 'weekly-work:update'
        ? CONTRIBUTOR_ROLES
        : MANAGE_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canManageWeeklyWork(role: string): boolean {
  return MANAGE_ROLES.includes(role);
}

export function canContributeToWeeklyWork(role: string): boolean {
  return CONTRIBUTOR_ROLES.includes(role);
}

export function canApproveWeeklyWork(role: string): boolean {
  return APPROVER_ROLES.includes(role);
}
