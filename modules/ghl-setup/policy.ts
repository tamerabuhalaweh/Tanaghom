import { ForbiddenError } from '@shared/errors';

export const GHL_SETUP_PERMISSIONS: Record<string, string[]> = {
  admin: ['ghl_setup:read', 'ghl_setup:write'],
  cco: ['ghl_setup:read', 'ghl_setup:write'],
  department_head: ['ghl_setup:read'],
  marketing_manager: ['ghl_setup:read'],
  social_media_manager: ['ghl_setup:read'],
  sales_manager: ['ghl_setup:read'],
  lead_qualification_manager: ['ghl_setup:read'],
  specialist: ['ghl_setup:read'],
  reviewer: ['ghl_setup:read'],
  viewer: ['ghl_setup:read'],
};

export function checkGhlSetupReadPermission(role: string): void {
  const allowed = GHL_SETUP_PERMISSIONS[role];
  if (!allowed || !allowed.includes('ghl_setup:read')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'ghl_setup:read'`);
  }
}

export function checkGhlSetupWritePermission(role: string): void {
  const allowed = GHL_SETUP_PERMISSIONS[role];
  if (!allowed || !allowed.includes('ghl_setup:write')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'ghl_setup:write'`);
  }
}
