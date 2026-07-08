import { ForbiddenError } from '@shared/errors';

export const GHL_SYNC_PERMISSIONS: Record<string, string[]> = {
  admin: ['ghl_sync:read', 'ghl_sync:pull', 'ghl_sync:write_back'],
  cco: ['ghl_sync:read', 'ghl_sync:pull', 'ghl_sync:write_back'],
  department_head: ['ghl_sync:read', 'ghl_sync:pull', 'ghl_sync:write_back'],
  marketing_manager: ['ghl_sync:read', 'ghl_sync:pull'],
  sales_manager: ['ghl_sync:read', 'ghl_sync:pull'],
  lead_qualification_manager: ['ghl_sync:read', 'ghl_sync:pull'],
  social_media_manager: ['ghl_sync:read'],
  specialist: ['ghl_sync:read'],
  reviewer: ['ghl_sync:read'],
  viewer: ['ghl_sync:read'],
};

export function checkGhlSyncPermission(role: string, permission: string): void {
  const allowed = GHL_SYNC_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
