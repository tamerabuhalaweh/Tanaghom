import { ForbiddenError } from '@shared/errors';

export const EVENT_PERMISSIONS: Record<string, string[]> = {
  admin: ['events:read', 'events:create', 'events:update', 'events:transition', 'events:link'],
  cco: ['events:read', 'events:create', 'events:update', 'events:transition', 'events:link'],
  department_head: ['events:read', 'events:create', 'events:update', 'events:transition', 'events:link'],
  marketing_manager: ['events:read', 'events:create', 'events:update', 'events:transition', 'events:link'],
  social_media_manager: ['events:read', 'events:create', 'events:update', 'events:link'],
  sales_manager: ['events:read', 'events:update', 'events:link'],
  lead_qualification_manager: ['events:read', 'events:update', 'events:link'],
  specialist: ['events:read', 'events:create', 'events:update', 'events:link'],
  reviewer: ['events:read'],
  viewer: ['events:read'],
};

export function checkEventPermission(role: string, permission: string): void {
  const allowed = EVENT_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
