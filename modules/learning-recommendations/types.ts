export const RECOMMENDATION_CATEGORIES = [
  'audience', 'channel', 'content', 'budget', 'sales', 'follow_up', 'no_show', 'offer', 'operations',
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export const RECOMMENDATION_PRIORITIES = ['high', 'medium', 'low'] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface LearningRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  recommendation: string;
  rationale: string;
  evidenceSummary: string;
  sourceMetrics: Record<string, number | string>;
  sourceSections: string[];
  confidence: ConfidenceLevel;
  missingDataWarnings: string[];
  suggestedOwnerRole: string | null;
  nextAction: string;
}

export interface LearningRecommendationsResponse {
  eventId: string;
  eventName: string;
  generatedAt: string;
  recommendations: LearningRecommendation[];
  dataCompletenessWarnings: string[];
}
