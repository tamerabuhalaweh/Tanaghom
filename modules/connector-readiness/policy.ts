import { ForbiddenError } from '@shared/errors';

export const CONNECTOR_READINESS_PERMISSIONS: Record<string, string[]> = {
  admin: ['readiness:read'],
  cco: ['readiness:read'],
  department_head: ['readiness:read'],
  marketing_manager: ['readiness:read'],
  social_media_manager: ['readiness:read'],
  sales_manager: ['readiness:read'],
  lead_qualification_manager: ['readiness:read'],
  specialist: ['readiness:read'],
  reviewer: ['readiness:read'],
  viewer: ['readiness:read'],
};

export function checkReadinessPermission(role: string): void {
  const allowed = CONNECTOR_READINESS_PERMISSIONS[role];
  if (!allowed || !allowed.includes('readiness:read')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'readiness:read'`);
  }
}
