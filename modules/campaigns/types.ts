import { z } from 'zod';

// ============================================================
// Content State Machine
// ============================================================

export const CONTENT_STATES = [
  'idea',
  'drafting',
  'pending_review',
  'needs_edits',
  'approved',
  'scheduled',
  'published',
  'analytics_pending',
  'analyzed',
  'archived',
  'recycle_candidate',
  'failed',
  'expired',
  'rejected',
  'cancelled',
] as const;

export type ContentState = (typeof CONTENT_STATES)[number];

// Strict transition table — only these transitions are allowed
export const TRANSITION_TABLE: Record<ContentState, ContentState[]> = {
  idea: ['drafting', 'rejected'],
  drafting: ['pending_review', 'failed'],
  pending_review: ['approved', 'needs_edits', 'rejected', 'expired'],
  needs_edits: ['drafting', 'rejected'],
  approved: ['scheduled', 'archived'],
  scheduled: ['published', 'failed', 'cancelled'],
  published: ['analytics_pending'],
  analytics_pending: ['analyzed'],
  analyzed: ['archived', 'recycle_candidate'],
  recycle_candidate: ['idea', 'archived'],
  failed: ['scheduled', 'cancelled'],
  expired: ['drafting', 'rejected'],
  rejected: [],
  cancelled: ['archived'],
  archived: [],
};

export function isValidTransition(from: ContentState, to: ContentState): boolean {
  return TRANSITION_TABLE[from]?.includes(to) ?? false;
}

export function validateTransition(from: ContentState, to: ContentState): void {
  if (!isValidTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
}

export class StateTransitionError extends Error {
  constructor(
    public readonly from: ContentState,
    public readonly to: ContentState,
  ) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = 'StateTransitionError';
  }
}

// ============================================================
// Enums
// ============================================================

export const CONTENT_TYPES = [
  'campaign',
  'announcement',
  'thought_leadership',
  'product_update',
  'hiring',
  'event',
  'evergreen',
  'reactive',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const RISK_CATEGORIES = ['low', 'medium', 'high'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

// ============================================================
// Schemas
// ============================================================

export const createCampaignSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500),
  objective: z.string().min(1, 'Objective is required').max(2000),
  audience: z.string().min(1, 'Target audience is required').max(1000),
  targetPlatforms: z.array(z.string()).min(1, 'At least one platform required'),
  deadline: z.string().datetime().optional(),
  cta: z.string().max(500).optional(),
  mediaRequirements: z.string().max(2000).optional(),
  ownerDepartmentId: z.string().uuid('Invalid department ID'),
  contentType: z.enum(CONTENT_TYPES),
  riskCategory: z.enum(RISK_CATEGORIES),
});

export const updateCampaignSchema = z.object({
  topic: z.string().min(1).max(500).optional(),
  objective: z.string().min(1).max(2000).optional(),
  audience: z.string().min(1).max(1000).optional(),
  targetPlatforms: z.array(z.string()).min(1).optional(),
  deadline: z.string().datetime().nullable().optional(),
  cta: z.string().max(500).nullable().optional(),
  mediaRequirements: z.string().max(2000).nullable().optional(),
  ownerDepartmentId: z.string().uuid().optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
  riskCategory: z.enum(RISK_CATEGORIES).optional(),
});

export const transitionSchema = z.object({
  toState: z.enum(CONTENT_STATES),
  reason: z.string().max(1000).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;

// ============================================================
// Response Types
// ============================================================

export interface CampaignSummary {
  id: string;
  requesterId: string;
  requesterName: string | null;
  channel: string;
  topic: string;
  objective: string;
  audience: string;
  targetPlatforms: string[];
  deadline: Date | null;
  cta: string | null;
  mediaRequirements: string | null;
  ownerDepartmentId: string;
  ownerDepartmentName: string | null;
  contentType: ContentType;
  riskCategory: RiskCategory;
  status: ContentState;
  createdAt: Date;
  updatedAt: Date;
}
