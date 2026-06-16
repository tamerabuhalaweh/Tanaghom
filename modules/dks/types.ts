import { z } from 'zod';

export const DKSSOURCE_TYPES = [
  'official_docs', 'official_policy', 'internal_benchmark', 'team_decision',
  'third_party_research', 'internal_analytics', 'saif_decision', 'platform_rule', 'learning_insight'
] as const;
export type DksSourceType = (typeof DKSSOURCE_TYPES)[number];

export const FRESHNESS_STATUSES = ['fresh', 'stale', 'expired', 'unknown'] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const createDksEntrySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  source: z.string().max(500).optional(),
  sourceType: z.enum(DKSSOURCE_TYPES).default('team_decision'),
  version: z.string().default('1.0'),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  owner: z.string().max(200).optional(),
  tags: z.array(z.string()).default([]),
  summary: z.string().max(5000).optional(),
  content: z.record(z.unknown()).optional(),
});

export const updateDksEntrySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  source: z.string().max(500).optional(),
  sourceType: z.enum(DKSSOURCE_TYPES).optional(),
  version: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  freshnessStatus: z.enum(FRESHNESS_STATUSES).optional(),
  owner: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().max(5000).optional(),
  content: z.record(z.unknown()).optional(),
});

export const linkDecisionToDksSchema = z.object({
  decisionId: z.string().uuid(),
  dksEntryId: z.string().uuid(),
  linkContext: z.string().default('evaluation'),
});

export type CreateDksEntryInput = z.infer<typeof createDksEntrySchema>;
export type UpdateDksEntryInput = z.infer<typeof updateDksEntrySchema>;
export type LinkDecisionToDksInput = z.infer<typeof linkDecisionToDksSchema>;

export interface DksEntrySummary {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  sourceType: DksSourceType;
  version: string | null;
  confidence: string;
  lastReviewedAt: Date | null;
  freshnessStatus: FreshnessStatus;
  owner: string | null;
  tags: string[];
  summary: string | null;
  content: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecisionDksLinkSummary {
  id: string;
  decisionId: string;
  dksEntryId: string;
  linkContext: string;
  createdAt: Date;
}
