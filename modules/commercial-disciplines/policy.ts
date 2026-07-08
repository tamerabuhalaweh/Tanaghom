import { ForbiddenError } from '@shared/errors';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['commercial:disciplines:read', 'commercial:disciplines:create', 'commercial:disciplines:update'],
  cco: ['commercial:disciplines:read', 'commercial:disciplines:create', 'commercial:disciplines:update'],
  department_head: ['commercial:disciplines:read', 'commercial:disciplines:create', 'commercial:disciplines:update'],
  marketing_manager: ['commercial:disciplines:read', 'commercial:disciplines:create', 'commercial:disciplines:update'],
  social_media_manager: ['commercial:disciplines:read', 'commercial:disciplines:create'],
  sales_manager: ['commercial:disciplines:read', 'commercial:disciplines:create'],
  lead_qualification_manager: ['commercial:disciplines:read', 'commercial:disciplines:create'],
  specialist: ['commercial:disciplines:read', 'commercial:disciplines:create'],
  reviewer: ['commercial:disciplines:read'],
  viewer: ['commercial:disciplines:read'],
};

export function checkCommercialDisciplinePermission(role: string, permission: string): void {
  const permissions = PERMISSIONS[role] || [];
  if (!permissions.includes(permission)) {
    throw new ForbiddenError(`Role ${role} cannot perform ${permission}`);
  }
}
