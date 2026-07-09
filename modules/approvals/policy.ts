import { ForbiddenError } from '@shared/errors';

export const APPROVAL_PERMISSIONS: Record<string, string[]> = {
  admin: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
  cco: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
  department_head: ['approvals:create', 'approvals:read', 'approvals:escalate'],
  marketing_manager: ['approvals:create', 'approvals:read'],
  social_media_manager: ['approvals:create', 'approvals:read'],
  sales_manager: ['approvals:create', 'approvals:read'],
  lead_qualification_manager: ['approvals:create', 'approvals:read'],
  specialist: ['approvals:create', 'approvals:read'],
  reviewer: ['approvals:create', 'approvals:read'],
  viewer: ['approvals:read'],
};

export function checkApprovalPermission(role: string, permission: string): void {
  const allowed = APPROVAL_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
