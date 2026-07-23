import { ForbiddenError } from '@shared/errors';

export type KpiGovernancePermission =
  | 'commercial-kpi:read'
  | 'commercial-kpi:create'
  | 'commercial-kpi:update'
  | 'commercial-kpi:submit'
  | 'commercial-kpi:approve'
  | 'commercial-kpi:amend'
  | 'commercial-kpi:capacity';

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

// Customer decision, 2026-07-23: the CCO owns governed KPI creation,
// approval, amendment, and event-capacity policy.
const CCO_ONLY = ['cco'];

export function checkKpiGovernancePermission(
  role: string,
  permission: KpiGovernancePermission,
): void {
  const allowed = permission === 'commercial-kpi:read' ? READ_ROLES : CCO_ONLY;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function canManageGovernedKpis(role: string): boolean {
  return CCO_ONLY.includes(role);
}

