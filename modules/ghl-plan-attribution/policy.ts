import { ForbiddenError } from '@shared/errors';

export type GhlAttributionPermission =
  | 'ghl-attribution:read'
  | 'ghl-attribution:create'
  | 'ghl-attribution:update'
  | 'ghl-attribution:approve';

const READ_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'sales_manager',
  'lead_qualification_manager',
  'specialist',
  'reviewer',
  'viewer',
];
const DRAFT_ROLES = ['cco', 'department_head', 'marketing_manager'];
const APPROVE_ROLES = ['cco'];

export function checkGhlAttributionPermission(
  role: string,
  permission: GhlAttributionPermission,
): void {
  const allowed =
    permission === 'ghl-attribution:read'
      ? READ_ROLES
      : permission === 'ghl-attribution:approve'
        ? APPROVE_ROLES
        : DRAFT_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

