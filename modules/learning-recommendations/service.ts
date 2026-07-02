import { checkLearningRecommendationsPermission } from './policy';
import * as repo from './repository';
import type { LearningRecommendationsResponse } from './types';

export async function getLearningRecommendations(role: string, tenantKey: string, eventId: string): Promise<LearningRecommendationsResponse> {
  checkLearningRecommendationsPermission(role);
  return repo.generateRecommendations(tenantKey, eventId);
}
