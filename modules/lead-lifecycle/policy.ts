import { ForbiddenError } from '@shared/errors';

export const LEAD_LIFECYCLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard', 'leads:record_meeting', 'leads:record_purchase', 'leads:close_outcome', 'leads:set_temperature'],
  cco: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard', 'leads:record_meeting', 'leads:record_purchase', 'leads:close_outcome', 'leads:set_temperature'],
  department_head: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard', 'leads:record_meeting', 'leads:record_purchase', 'leads:close_outcome', 'leads:set_temperature'],
  marketing_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard', 'leads:record_meeting', 'leads:record_purchase', 'leads:close_outcome', 'leads:set_temperature'],
  social_media_manager: ['leads:read', 'leads:create', 'leads:update'],
  sales_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:dashboard', 'leads:record_meeting', 'leads:record_purchase', 'leads:close_outcome', 'leads:set_temperature'],
  lead_qualification_manager: ['leads:read', 'leads:create', 'leads:update', 'leads:transition', 'leads:record_meeting', 'leads:set_temperature'],
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

export function checkLeadTransitionPermission(role: string, toStatus: string): void {
  checkLeadPermission(role, 'leads:transition');
  if (['meeting_attended', 'no_show', 'purchased'].includes(toStatus)) {
    checkLeadPermission(role, 'leads:close_outcome');
  }
}
