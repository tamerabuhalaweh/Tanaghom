import { ForbiddenError } from '@shared/errors';

export const FIELD_MAPPING_PERMISSIONS: Record<string, string[]> = {
  admin: ['mapping:read', 'mapping:create', 'mapping:update', 'mapping:delete'],
  cco: ['mapping:read', 'mapping:create', 'mapping:update', 'mapping:delete'],
  department_head: ['mapping:read', 'mapping:create', 'mapping:update', 'mapping:delete'],
  marketing_manager: ['mapping:read', 'mapping:create', 'mapping:update'],
  social_media_manager: ['mapping:read'],
  sales_manager: ['mapping:read'],
  lead_qualification_manager: ['mapping:read'],
  specialist: ['mapping:read'],
  reviewer: ['mapping:read'],
  viewer: ['mapping:read'],
};

export function checkFieldMappingPermission(role: string, permission: string): void {
  const allowed = FIELD_MAPPING_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
