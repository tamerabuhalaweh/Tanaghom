import { z } from 'zod';

// ============================================================
// Scoring Components
// ============================================================

export const SCORING_COMPONENTS = {
  hookStrength: { weight: 15, maxScore: 100 },
  formatFit: { weight: 15, maxScore: 100 },
  hashtagHygiene: { weight: 10, maxScore: 100 },
  timingPlaceholder: { weight: 5, maxScore: 100 },
  ctaClarity: { weight: 10, maxScore: 100 },
  complianceRisk: { weight: 15, maxScore: 100 },
  audienceRelevance: { weight: 10, maxScore: 100 },
  originality: { weight: 10, maxScore: 100 },
  platformFit: { weight: 10, maxScore: 100 },
} as const;

export type ScoringComponent = keyof typeof SCORING_COMPONENTS;

// ============================================================
// Scoring Bands
// ============================================================

export const SCORING_BANDS = {
  approve: { min: 90, max: 100, label: 'Ready to approve', action: 'approve' },
  optimize: { min: 75, max: 89, label: 'Good, optimization recommended', action: 'optimize' },
  revise: { min: 60, max: 74, label: 'Requires revision before approval', action: 'revise' },
  block: { min: 0, max: 59, label: 'Do not schedule unless manually overridden', action: 'block' },
} as const;

export type ScoringBandAction = 'approve' | 'optimize' | 'revise' | 'block';

// ============================================================
// Rule Freshness
// ============================================================

export const RULE_FRESHNESS = {
  fresh: { maxAgeDays: 30, label: 'Fresh', severity: 'none' },
  aging: { maxAgeDays: 60, label: 'Aging', severity: 'warning' },
  stale: { maxAgeDays: 90, label: 'Stale', severity: 'warning' },
  expired: { maxAgeDays: Infinity, label: 'Expired', severity: 'block' },
} as const;

export type RuleFreshnessSeverity = 'none' | 'warning' | 'block';

// ============================================================
// Spam/Black-hat Tactics
// ============================================================

export const SPAM_TACTICS = [
  'engagement_bait',
  'misleading_claims',
  'irrelevant_tagging',
  'hashtag_stuffing',
  'duplicated_content',
  'artificial_engagement',
  'clickbait_without_substance',
  'fake_urgency',
] as const;

export type SpamTactic = (typeof SPAM_TACTICS)[number];

// ============================================================
// Schemas
// ============================================================

export const scoreDraftSchema = z.object({
  contentItemId: z.string().uuid('Invalid content item ID'),
  platform: z.string().min(1, 'Platform is required'),
  draftText: z.string().min(1, 'Draft text is required'),
  objective: z.string().optional(),
  audience: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  contentType: z.string().optional(),
  riskCategory: z.enum(['low', 'medium', 'high']).optional(),
});

export type ScoreDraftInput = {
  contentItemId: string;
  platform: string;
  draftText: string;
  objective?: string;
  audience?: string;
  cta?: string;
  hashtags?: string[];
  contentType?: string;
  riskCategory?: 'low' | 'medium' | 'high';
};

export const addRuleSchema = z.object({
  platform: z.string().min(1),
  ruleType: z.string().min(1),
  ruleValue: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(['official_docs', 'third_party_research', 'internal_analytics']).default('official_docs'),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  owner: z.string().optional(),
});

export type AddRuleInput = {
  platform: string;
  ruleType: string;
  ruleValue: string;
  sourceUrl?: string;
  sourceType?: 'official_docs' | 'third_party_research' | 'internal_analytics';
  confidence?: 'low' | 'medium' | 'high';
  owner?: string;
};

// ============================================================
// Response Types
// ============================================================

export interface ReachReadinessScore {
  contentItemId: string;
  totalScore: number;
  band: ScoringBandAction;
  bandLabel: string;
  components: ScoreComponentResult[];
  optimizationSuggestions: OptimizationSuggestion[];
  staleWarnings: StaleWarning[];
  spamFlags: SpamFlag[];
  canSchedule: boolean;
  blockReasons: string[];
}

export interface ScoreComponentResult {
  component: ScoringComponent;
  score: number;
  weight: number;
  weightedScore: number;
  maxWeightedScore: number;
  explanation: string;
}

export interface OptimizationSuggestion {
  component: ScoringComponent;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  expectedImprovement: number;
}

export interface StaleWarning {
  platform: string;
  ruleType: string;
  lastReviewed: Date | null;
  daysSinceReview: number;
  severity: RuleFreshnessSeverity;
  message: string;
}

export interface SpamFlag {
  tactic: SpamTactic;
  severity: 'warning' | 'block';
  evidence: string;
  suggestion: string;
}

export interface PlatformRuleRecord {
  id: string;
  platform: string;
  ruleType: string;
  ruleValue: string;
  sourceUrl: string | null;
  sourceType: string;
  confidence: string;
  owner: string | null;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
