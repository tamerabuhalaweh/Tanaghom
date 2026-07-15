import { ForbiddenError } from '@shared/errors';

export type BudgetPermission =
  | 'commercial-budget:read'
  | 'commercial-budget:manage'
  | 'commercial-budget:approve'
  | 'commercial-budget:verify-evidence'
  | 'commercial-budget:approve-exception';

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
const MANAGE_ROLES = ['admin', 'cco', 'department_head'];
const EXECUTIVE_ROLES = ['admin', 'cco'];

export function checkBudgetPermission(role: string, permission: BudgetPermission): void {
  const allowed =
    permission === 'commercial-budget:read'
      ? READ_ROLES
      : permission === 'commercial-budget:manage'
        ? MANAGE_ROLES
        : EXECUTIVE_ROLES;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canManageCommercialBudget(role: string): boolean {
  return MANAGE_ROLES.includes(role);
}

export function canApproveCommercialBudget(role: string): boolean {
  return EXECUTIVE_ROLES.includes(role);
}
