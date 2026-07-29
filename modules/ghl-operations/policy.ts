import { ForbiddenError } from '@shared/errors';

export type GhlOperationPermission =
  | 'ghl-operations:read'
  | 'ghl-operations:prepare'
  | 'ghl-operations:approve'
  | 'ghl-operations:execute'
  | 'ghl-operations:send-whatsapp';

const READ_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'sales_manager',
  'lead_qualification_manager',
  'social_media_manager',
  'specialist',
  'reviewer',
  'viewer',
];
const PREPARE_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'sales_manager',
  'lead_qualification_manager',
];
const APPROVE_ROLES = ['admin', 'cco', 'department_head'];

export function hasGhlOperationPermission(
  role: string,
  permission: GhlOperationPermission,
): boolean {
  const allowed =
    permission === 'ghl-operations:read'
      ? READ_ROLES
      : permission === 'ghl-operations:prepare' || permission === 'ghl-operations:send-whatsapp'
        ? PREPARE_ROLES
        : APPROVE_ROLES;
  return allowed.includes(role);
}

export function checkGhlOperationPermission(
  role: string,
  permission: GhlOperationPermission,
): void {
  if (!hasGhlOperationPermission(role, permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
