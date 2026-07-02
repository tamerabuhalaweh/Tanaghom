import { ForbiddenError } from '@shared/errors';

export const CONNECTOR_IMPORT_PERMISSIONS: Record<string, string[]> = {
  admin: ['connector:read', 'connector:create', 'connector:update', 'connector:disable', 'connector:dry_run', 'connector:import'],
  cco: ['connector:read', 'connector:create', 'connector:update', 'connector:disable', 'connector:dry_run', 'connector:import'],
  department_head: ['connector:read', 'connector:create', 'connector:update', 'connector:disable', 'connector:dry_run', 'connector:import'],
  marketing_manager: ['connector:read', 'connector:create', 'connector:update', 'connector:dry_run', 'connector:import'],
  social_media_manager: ['connector:read'],
  sales_manager: ['connector:read'],
  lead_qualification_manager: ['connector:read'],
  specialist: ['connector:read'],
  reviewer: ['connector:read'],
  viewer: ['connector:read'],
};

export function checkConnectorPermission(role: string, permission: string): void {
  const allowed = CONNECTOR_IMPORT_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
