import { ForbiddenError } from '@shared/errors';

export const PLANNER_PERMISSIONS: Record<string, string[]> = {
  admin: ['planner:read', 'planner:create', 'planner:update', 'planner:approve'],
  cco: ['planner:read', 'planner:create', 'planner:update', 'planner:approve'],
  department_head: ['planner:read', 'planner:create', 'planner:update', 'planner:approve'],
  marketing_manager: ['planner:read', 'planner:create', 'planner:update', 'planner:approve'],
  social_media_manager: ['planner:read', 'planner:create', 'planner:update'],
  sales_manager: ['planner:read', 'planner:create', 'planner:update'],
  lead_qualification_manager: ['planner:read', 'planner:update'],
  specialist: ['planner:read', 'planner:create', 'planner:update'],
  reviewer: ['planner:read'],
  viewer: ['planner:read'],
};

export function checkPlannerPermission(role: string, permission: string): void {
  const allowed = PLANNER_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
