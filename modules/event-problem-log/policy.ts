import { ForbiddenError } from '@shared/errors';
import type { ProblemCategory } from './types';

const FULL_ACCESS_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];

const CONTENT_SOCIAL_AD_CATEGORIES: ProblemCategory[] = ['content', 'ads', 'audience', 'other'];
const SALES_LEAD_FUNNEL_CATEGORIES: ProblemCategory[] = ['sales', 'funnel', 'budget', 'operations', 'integration'];

export const EVENT_PROBLEM_PERMISSIONS: Record<string, string[]> = {
  admin: ['problems:read', 'problems:create', 'problems:update', 'problems:transition', 'problems:dashboard'],
  cco: ['problems:read', 'problems:create', 'problems:update', 'problems:transition', 'problems:dashboard'],
  department_head: ['problems:read', 'problems:create', 'problems:update', 'problems:transition', 'problems:dashboard'],
  marketing_manager: ['problems:read', 'problems:create', 'problems:update', 'problems:transition', 'problems:dashboard'],
  social_media_manager: ['problems:read', 'problems:create', 'problems:update', 'problems:dashboard'],
  sales_manager: ['problems:read', 'problems:create', 'problems:update', 'problems:dashboard'],
  lead_qualification_manager: ['problems:read', 'problems:create', 'problems:update'],
  specialist: ['problems:read'],
  reviewer: ['problems:read'],
  viewer: ['problems:read'],
};

export function checkProblemPermission(role: string, permission: string): void {
  const allowed = EVENT_PROBLEM_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function checkProblemCategoryPermission(role: string, category: ProblemCategory): void {
  if (FULL_ACCESS_ROLES.includes(role)) return;

  if (role === 'social_media_manager') {
    if (!CONTENT_SOCIAL_AD_CATEGORIES.includes(category)) {
      throw new ForbiddenError(`Role '${role}' cannot manage '${category}' problems`);
    }
    return;
  }

  if (role === 'sales_manager' || role === 'lead_qualification_manager') {
    if (!SALES_LEAD_FUNNEL_CATEGORIES.includes(category)) {
      throw new ForbiddenError(`Role '${role}' cannot manage '${category}' problems`);
    }
    return;
  }

  throw new ForbiddenError(`Role '${role}' cannot create or update problems`);
}
