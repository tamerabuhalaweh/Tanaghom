import { ForbiddenError } from '@shared/errors';

export const LEARNING_RECOMMENDATIONS_PERMISSIONS: Record<string, string[]> = {
  admin: ['learning_recommendations:read'],
  cco: ['learning_recommendations:read'],
  department_head: ['learning_recommendations:read'],
  marketing_manager: ['learning_recommendations:read'],
  sales_manager: ['learning_recommendations:read'],
  social_media_manager: ['learning_recommendations:read'],
  lead_qualification_manager: ['learning_recommendations:read'],
  specialist: ['learning_recommendations:read'],
  reviewer: ['learning_recommendations:read'],
  viewer: ['learning_recommendations:read'],
};

export function checkLearningRecommendationsPermission(role: string): void {
  const allowed = LEARNING_RECOMMENDATIONS_PERMISSIONS[role];
  if (!allowed || !allowed.includes('learning_recommendations:read')) {
    throw new ForbiddenError(`Role '${role}' does not have permission 'learning_recommendations:read'`);
  }
}
