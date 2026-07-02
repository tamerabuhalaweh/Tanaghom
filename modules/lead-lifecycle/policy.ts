import { ForbiddenError } from '@shared/errors';

export const LEAD_LIFECYCLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard'],
  cco: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard'],
  department_head: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard'],
  marketing_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard'],
  social_media_manager: ['leads:read', 'leads:create', 'leads:update'],
  sales_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard'],
  lead_qualification_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition'],
  specialist: ['leads:read', 'leads:create', 'leads:update'],
  reviewer: ['leads:read'],
  viewer: ['leads:read'],
};

export function checkLeadPermission(role: string, permission: string): void {
  const allowed = LEAD_LIFECYCLE_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
