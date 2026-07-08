import { ForbiddenError } from '@shared/errors';

export type StitchiPermission =
  | 'stitchi:read'
  | 'stitchi:create_conversation'
  | 'stitchi:create_message'
  | 'stitchi:create_action'
  | 'stitchi:approve_action'
  | 'stitchi:execute_action'
  | 'stitchi:cancel_action';

const ALL_USER_ROLES = [
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
] as const;

const APPROVER_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'] as const;

export const STITCHI_PERMISSIONS: Record<string, StitchiPermission[]> = Object.fromEntries(
  ALL_USER_ROLES.map(role => [
    role,
    [
      'stitchi:read',
      'stitchi:create_conversation',
      'stitchi:create_message',
      'stitchi:create_action',
      'stitchi:cancel_action',
      ...(APPROVER_ROLES.includes(role as (typeof APPROVER_ROLES)[number]) ? ['stitchi:approve_action' as const, 'stitchi:execute_action' as const] : []),
    ],
  ]),
);

export function checkStitchiPermission(role: string, permission: StitchiPermission): void {
  if (!STITCHI_PERMISSIONS[role]?.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' is not authorized for ${permission}`);
  }
}

export function canViewTenantConversations(role: string): boolean {
  return ['admin', 'cco', 'department_head'].includes(role);
}

export function canApproveStitchiActions(role: string): boolean {
  return APPROVER_ROLES.includes(role as (typeof APPROVER_ROLES)[number]);
}
