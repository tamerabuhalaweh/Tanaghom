import { z } from 'zod';

export const PROBLEM_CATEGORIES = ['content', 'ads', 'audience', 'funnel', 'sales', 'budget', 'operations', 'integration', 'other'] as const;
export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export const PROBLEM_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export const PROBLEM_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const PROBLEM_SOURCES = ['manual', 'kpi_review', 'lead_review', 'sales_feedback', 'campaign_review', 'integration_check'] as const;
export type ProblemSource = (typeof PROBLEM_SOURCES)[number];

export const PROBLEM_TRANSITION_TABLE: Record<ProblemStatus, ProblemStatus[]> = {
  open: ['investigating', 'resolved', 'dismissed'],
  investigating: ['open', 'resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

export function isValidProblemTransition(from: ProblemStatus, to: ProblemStatus): boolean {
  return PROBLEM_TRANSITION_TABLE[from]?.includes(to) ?? false;
}

export function validateProblemTransition(from: ProblemStatus, to: ProblemStatus): void {
  if (!isValidProblemTransition(from, to)) {
    throw new ProblemTransitionError(from, to);
  }
}

export class ProblemTransitionError extends Error {
  constructor(public readonly from: ProblemStatus, public readonly to: ProblemStatus) {
    super(`Invalid problem transition: ${from} → ${to}`);
    this.name = 'ProblemTransitionError';
  }
}

export const createProblemSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  title: z.string().min(1, 'Title is required').max(1000),
  description: z.string().max(10000).optional(),
  category: z.enum(PROBLEM_CATEGORIES),
  severity: z.enum(PROBLEM_SEVERITIES).optional(),
  source: z.enum(PROBLEM_SOURCES).optional(),
  impactSummary: z.string().max(5000).optional(),
  recommendedAction: z.string().max(5000).optional(),
  ownerRole: z.string().max(200).optional(),
  relatedLeadId: z.string().uuid().optional(),
  relatedCampaignId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateProblemSchema = z.object({
  title: z.string().min(1).max(1000).optional(),
  description: z.string().max(10000).nullable().optional(),
  category: z.enum(PROBLEM_CATEGORIES).optional(),
  severity: z.enum(PROBLEM_SEVERITIES).optional(),
  source: z.enum(PROBLEM_SOURCES).optional(),
  impactSummary: z.string().max(5000).nullable().optional(),
  recommendedAction: z.string().max(5000).nullable().optional(),
  ownerRole: z.string().max(200).nullable().optional(),
  relatedLeadId: z.string().uuid().nullable().optional(),
  relatedCampaignId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const transitionProblemSchema = z.object({
  toStatus: z.enum(PROBLEM_STATUSES),
  resolutionNotes: z.string().max(10000).optional(),
});

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
export type TransitionProblemInput = z.infer<typeof transitionProblemSchema>;

export interface ProblemSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  title: string;
  description: string | null;
  category: ProblemCategory;
  severity: ProblemSeverity;
  status: ProblemStatus;
  source: ProblemSource;
  impactSummary: string | null;
  recommendedAction: string | null;
  ownerRole: string | null;
  relatedLeadId: string | null;
  relatedCampaignId: string | null;
  dueDate: Date | null;
  resolutionNotes: string | null;
  createdByUserId: string;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemDashboardSummary {
  eventId: string;
  totalProblems: number;
  openProblems: number;
  criticalOpen: number;
  bySeverity: Record<ProblemSeverity, number>;
  byStatus: Record<ProblemStatus, number>;
  byCategory: Record<ProblemCategory, number>;
  topBlockers: Array<{ id: string; title: string; severity: ProblemSeverity; category: ProblemCategory; ownerRole: string | null }>;
}
