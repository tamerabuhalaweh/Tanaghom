import { ForbiddenError } from '@shared/errors';

export const CLOSEOUT_PERMISSIONS: Record<string, string[]> = {
  admin: ['closeout:read'],
  cco: ['closeout:read'],
  department_head: ['closeout:read'],
  marketing_manager: ['closeout:read'],
  sales_manager: ['closeout:read'],
  social_media_manager: ['closeout:read'],
  lead_qualification_manager: ['closeout:read'],
  specialist: ['closeout:read'],
  reviewer: ['closeout:read'],
  viewer: ['closeout:read'],
};

export function checkCloseoutPermission(role: string): void {
  const allowed = CLOSEOUT_PERMISSIONS[role];
  if (!allowed || !allowed.includes('closeout:read')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'closeout:read'`);
  }
}
