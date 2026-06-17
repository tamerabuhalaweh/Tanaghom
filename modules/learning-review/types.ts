import { z } from 'zod';

export const REVIEW_STATUSES = ['pending', 'under_review', 'accepted', 'rejected', 'needs_more_evidence', 'superseded'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PROPOSAL_TYPES = [
  'create_new_entry', 'update_existing_entry', 'mark_stale',
  'increase_confidence', 'decrease_confidence', 'add_relationship', 'deprecate_entry'
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'deferred', 'requires_saif_review', 'applied'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const DKX_DECISION_TYPES = ['approved', 'rejected', 'deferred', 'requires_saif_review'] as const;
export type DksDecisionType = (typeof DKX_DECISION_TYPES)[number];

export const HIGH_IMPACT_CATEGORIES = [
  'compliance', 'medical_health_claim', 'platform_policy', 'approval_policy',
  'm5_execution', 'security'
] as const;

export const createLearningSignalReviewSchema = z.object({
  learningSignalId: z.string().uuid(),
  reviewerUserId: z.string().uuid().optional(),
  reviewerAgentRepId: z.string().uuid().optional(),
});

export const reviewDecisionSchema = z.object({
  reviewerUserId: z.string().uuid(),
  reviewerAgentRepId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected', 'needs_more_evidence']),
  reviewRationale: z.string().max(5000).optional(),
  confidenceAssessment: z.string().max(200).optional(),
  riskAssessment: z.string().max(5000).optional(),
});

export const createDksUpdateProposalSchema = z.object({
  learningSignalId: z.string().uuid(),
  learningSignalReviewId: z.string().uuid().optional(),
  targetDksEntryId: z.string().uuid().optional(),
  proposalType: z.enum(PROPOSAL_TYPES),
  proposedTitle: z.string().max(500).optional(),
  proposedSummary: z.string().max(5000).optional(),
  proposedTags: z.array(z.string()).default([]),
  proposedConfidence: z.enum(['low', 'medium', 'high']).optional(),
  proposedFreshnessStatus: z.enum(['fresh', 'stale', 'expired', 'unknown']).optional(),
  proposedSource: z.string().max(500).optional(),
  proposedSourceType: z.string().max(200).optional(),
  proposedVersionChange: z.string().max(100).optional(),
  rationale: z.string().max(5000).optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const dksUpdateDecisionSchema = z.object({
  authorityUserId: z.string().uuid(),
  authorityAgentRepId: z.string().uuid(),
  decision: z.enum(DKX_DECISION_TYPES),
  rationale: z.string().max(5000).optional(),
  riskAcceptance: z.string().max(5000).optional(),
});

export type CreateLearningSignalReviewInput = z.infer<typeof createLearningSignalReviewSchema>;
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type CreateDksUpdateProposalInput = z.infer<typeof createDksUpdateProposalSchema>;
export type DksUpdateDecisionInput = z.infer<typeof dksUpdateDecisionSchema>;

export interface LearningSignalReviewSummary {
  id: string;
  learningSignalId: string;
  reviewStatus: ReviewStatus;
  reviewerUserId: string | null;
  reviewerAgentRepId: string | null;
  reviewDecision: string | null;
  reviewRationale: string | null;
  confidenceAssessment: string | null;
  riskAssessment: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  updatedAt: Date;
}

export interface DksUpdateProposalSummary {
  id: string;
  learningSignalId: string;
  learningSignalReviewId: string | null;
  targetDksEntryId: string | null;
  proposalType: ProposalType;
  proposedTitle: string | null;
  proposedSummary: string | null;
  proposedTags: string[];
  proposedConfidence: string | null;
  proposedFreshnessStatus: string | null;
  proposedSource: string | null;
  proposedSourceType: string | null;
  proposedVersionChange: string | null;
  rationale: string | null;
  proposalStatus: ProposalStatus;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DksUpdateDecisionSummary {
  id: string;
  dksUpdateProposalId: string;
  authorityUserId: string;
  authorityAgentRepId: string;
  decision: DksDecisionType;
  rationale: string | null;
  riskAcceptance: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeRevisionSummary {
  id: string;
  dksEntryId: string;
  dksUpdateProposalId: string | null;
  previousVersion: string | null;
  newVersion: string;
  changedFields: Record<string, unknown> | null;
  revisionSummary: string | null;
  appliedByUserId: string;
  appliedByAgentRepId: string;
  createdAt: Date;
}
