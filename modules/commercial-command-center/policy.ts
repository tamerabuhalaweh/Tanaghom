import { ForbiddenError } from '@shared/errors';

export const COMMERCIAL_CENTER_PERMISSIONS: Record<string, string[]> = {
  admin: ['commercial:center:read', 'commercial:center:create', 'commercial:center:update'],
  cco: ['commercial:center:read', 'commercial:center:create', 'commercial:center:update'],
  department_head: ['commercial:center:read', 'commercial:center:create', 'commercial:center:update'],
  marketing_manager: ['commercial:center:read', 'commercial:center:create', 'commercial:center:update'],
  social_media_manager: ['commercial:center:read', 'commercial:center:create'],
  sales_manager: ['commercial:center:read', 'commercial:center:create'],
  lead_qualification_manager: ['commercial:center:read', 'commercial:center:create'],
  specialist: ['commercial:center:read', 'commercial:center:create'],
  reviewer: ['commercial:center:read'],
  viewer: ['commercial:center:read'],
};

export function checkCommercialCenterPermission(role: string, permission: string): void {
  const allowed = COMMERCIAL_CENTER_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
