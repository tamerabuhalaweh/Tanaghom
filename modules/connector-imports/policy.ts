import { ForbiddenError } from '@shared/errors';

export const CONNECTOR_IMPORT_PERMISSIONS: Record<string, string[]> = {
  admin: ['connector_imports:read', 'connector_imports:create', 'connector_imports:update'],
  cco: ['connector_imports:read', 'connector_imports:create', 'connector_imports:update'],
  department_head: ['connector_imports:read', 'connector_imports:create', 'connector_imports:update'],
  marketing_manager: ['connector_imports:read'],
  sales_manager: ['connector_imports:read'],
  social_media_manager: ['connector_imports:read'],
  lead_qualification_manager: ['connector_imports:read'],
  specialist: ['connector_imports:read'],
  reviewer: ['connector_imports:read'],
  viewer: ['connector_imports:read'],
};

export function checkConnectorImportPermission(role: string, permission: string): void {
  const allowed = CONNECTOR_IMPORT_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
