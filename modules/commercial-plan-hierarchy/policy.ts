import { ForbiddenError } from '@shared/errors';
import type { HierarchyPermission } from './types';

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
const EXCEPTION_ROLES = ['admin', 'cco'];

export function checkHierarchyPermission(role: string, permission: HierarchyPermission): void {
  const allowed =
    permission === 'commercial-hierarchy:read'
      ? READ_ROLES
      : permission === 'commercial-hierarchy:approve-exception'
        ? EXCEPTION_ROLES
        : MANAGE_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canManageHierarchy(role: string): boolean {
  return MANAGE_ROLES.includes(role);
}

export function canApproveHierarchyException(role: string): boolean {
  return EXCEPTION_ROLES.includes(role);
}
