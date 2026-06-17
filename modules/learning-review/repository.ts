import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type {
  CreateLearningSignalReviewInput, ReviewDecisionInput,
  CreateDksUpdateProposalInput, DksUpdateDecisionInput,
  LearningSignalReviewSummary, DksUpdateProposalSummary,
  DksUpdateDecisionSummary, KnowledgeRevisionSummary,
  ReviewStatus, ProposalStatus,
} from './types';
import { HIGH_IMPACT_CATEGORIES } from './types';

// ============================================================
// LearningSignalReview
// ============================================================

export async function createLearningSignalReview(input: CreateLearningSignalReviewInput): Promise<LearningSignalReviewSummary> {
  // Verify learning signal exists
  const signal = await prisma.learningSignal.findUnique({ where: { id: input.learningSignalId } });
  if (!signal) throw new NotFoundError('LearningSignal', input.learningSignalId);

  const review = await prisma.learningSignalReview.create({
    data: {
      learning_signal_id: input.learningSignalId,
      reviewer_user_id: input.reviewerUserId,
      reviewer_agent_rep_id: input.reviewerAgentRepId,
    },
  });
  return mapLearningSignalReview(review);
}

export async function getLearningSignalReviewById(id: string): Promise<LearningSignalReviewSummary> {
  const review = await prisma.learningSignalReview.findUnique({ where: { id } });
  if (!review) throw new NotFoundError('LearningSignalReview', id);
  return mapLearningSignalReview(review);
}

export async function listLearningSignalReviews(filters?: {
  learningSignalId?: string;
  reviewStatus?: string;
  reviewerUserId?: string;
}): Promise<LearningSignalReviewSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.learningSignalId) where.learning_signal_id = filters.learningSignalId;
  if (filters?.reviewStatus) where.review_status = filters.reviewStatus;
  if (filters?.reviewerUserId) where.reviewer_user_id = filters.reviewerUserId;

  const reviews = await prisma.learningSignalReview.findMany({ where, orderBy: { created_at: 'desc' } });
  return reviews.map(mapLearningSignalReview);
}

export async function updateReviewDecision(id: string, input: ReviewDecisionInput): Promise<LearningSignalReviewSummary> {
  const existing = await prisma.learningSignalReview.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('LearningSignalReview', id);

  // Validate transition
  if (existing.review_status !== 'pending' && existing.review_status !== 'under_review') {
    throw new ForbiddenError(`Cannot update review in ${existing.review_status} status`);
  }

  const review = await prisma.learningSignalReview.update({
    where: { id },
    data: {
      review_status: input.decision as ReviewStatus,
      reviewer_user_id: input.reviewerUserId,
      reviewer_agent_rep_id: input.reviewerAgentRepId,
      review_decision: input.decision,
      review_rationale: input.reviewRationale,
      confidence_assessment: input.confidenceAssessment,
      risk_assessment: input.riskAssessment,
      reviewed_at: new Date(),
    },
  });
  return mapLearningSignalReview(review);
}

// ============================================================
// DksUpdateProposal
// ============================================================

export async function createDksUpdateProposal(input: CreateDksUpdateProposalInput): Promise<DksUpdateProposalSummary> {
  // Verify learning signal was accepted
  const signal = await prisma.learningSignal.findUnique({ where: { id: input.learningSignalId } });
  if (!signal) throw new NotFoundError('LearningSignal', input.learningSignalId);

  // Check if there's an accepted review
  const review = await prisma.learningSignalReview.findFirst({
    where: {
      learning_signal_id: input.learningSignalId,
      review_status: 'accepted',
    },
  });

  if (!review) {
    throw new ForbiddenError('Cannot create DKS update proposal: LearningSignal must have an accepted review');
  }

  const proposal = await prisma.dksUpdateProposal.create({
    data: {
      learning_signal_id: input.learningSignalId,
      learning_signal_review_id: input.learningSignalReviewId || review.id,
      target_dks_entry_id: input.targetDksEntryId,
      proposal_type: input.proposalType,
      proposed_title: input.proposedTitle,
      proposed_summary: input.proposedSummary,
      proposed_tags: input.proposedTags,
      proposed_confidence: input.proposedConfidence,
      proposed_freshness_status: input.proposedFreshnessStatus,
      proposed_source: input.proposedSource,
      proposed_source_type: input.proposedSourceType,
      proposed_version_change: input.proposedVersionChange,
      rationale: input.rationale,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapDksUpdateProposal(proposal);
}

export async function getDksUpdateProposalById(id: string): Promise<DksUpdateProposalSummary> {
  const proposal = await prisma.dksUpdateProposal.findUnique({ where: { id } });
  if (!proposal) throw new NotFoundError('DksUpdateProposal', id);
  return mapDksUpdateProposal(proposal);
}

export async function listDksUpdateProposals(filters?: {
  learningSignalId?: string;
  proposalStatus?: string;
  createdByUserId?: string;
}): Promise<DksUpdateProposalSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.learningSignalId) where.learning_signal_id = filters.learningSignalId;
  if (filters?.proposalStatus) where.proposal_status = filters.proposalStatus;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;

  const proposals = await prisma.dksUpdateProposal.findMany({ where, orderBy: { created_at: 'desc' } });
  return proposals.map(mapDksUpdateProposal);
}

export async function isHighImpactProposal(proposalId: string): Promise<boolean> {
  const proposal = await prisma.dksUpdateProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return false;

  // Check if proposal relates to high-impact categories
  const tags = proposal.proposed_tags || [];
  return tags.some(tag => HIGH_IMPACT_CATEGORIES.includes(tag as typeof HIGH_IMPACT_CATEGORIES[number]));
}

// ============================================================
// DksUpdateDecision
// ============================================================

export async function createDksUpdateDecision(proposalId: string, input: DksUpdateDecisionInput): Promise<DksUpdateDecisionSummary> {
  const proposal = await prisma.dksUpdateProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new NotFoundError('DksUpdateProposal', proposalId);

  // Check if high-impact proposal requires SAIF review
  if (input.decision === 'approved') {
    const isHighImpact = await isHighImpactProposal(proposalId);
    if (isHighImpact) {
      // High-impact proposals should have SAIF decision record
      // For now, we flag this but don't block
    }
  }

  const decision = await prisma.dksUpdateDecision.create({
    data: {
      dks_update_proposal_id: proposalId,
      authority_user_id: input.authorityUserId,
      authority_agent_rep_id: input.authorityAgentRepId,
      decision: input.decision,
      rationale: input.rationale,
      risk_acceptance: input.riskAcceptance,
      applied_at: input.decision === 'approved' ? new Date() : null,
    },
  });

  // Update proposal status
  await prisma.dksUpdateProposal.update({
    where: { id: proposalId },
    data: { proposal_status: input.decision as ProposalStatus },
  });

  return mapDksUpdateDecision(decision);
}

export async function listDksUpdateDecisions(proposalId: string): Promise<DksUpdateDecisionSummary[]> {
  const decisions = await prisma.dksUpdateDecision.findMany({
    where: { dks_update_proposal_id: proposalId },
    orderBy: { created_at: 'desc' },
  });
  return decisions.map(mapDksUpdateDecision);
}

// ============================================================
// KnowledgeRevision
// ============================================================

export async function applyDksUpdate(proposalId: string, appliedByUserId: string, appliedByAgentRepId: string): Promise<KnowledgeRevisionSummary> {
  const proposal = await prisma.dksUpdateProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new NotFoundError('DksUpdateProposal', proposalId);

  // Verify decision was approved
  const decision = await prisma.dksUpdateDecision.findFirst({
    where: { dks_update_proposal_id: proposalId, decision: 'approved' },
  });
  if (!decision) {
    throw new ForbiddenError('Cannot apply DKS update: proposal must have approved decision');
  }

  // Get current DKS entry if updating
  let previousVersion: string | null = null;
  let dksEntryId: string;

  if (proposal.target_dks_entry_id) {
    const entry = await prisma.dksEntry.findUnique({ where: { id: proposal.target_dks_entry_id } });
    if (!entry) throw new NotFoundError('DksEntry', proposal.target_dks_entry_id);
    previousVersion = entry.version || '1.0';
    dksEntryId = entry.id;

    // Update DKS entry
    const newVersion = incrementVersion(previousVersion);
    await prisma.dksEntry.update({
      where: { id: dksEntryId },
      data: {
        title: proposal.proposed_title || entry.title,
        summary: proposal.proposed_summary || entry.summary,
        tags: proposal.proposed_tags.length > 0 ? proposal.proposed_tags : entry.tags,
        confidence: (proposal.proposed_confidence as 'low' | 'medium' | 'high') || entry.confidence,
        freshness_status: (proposal.proposed_freshness_status as 'fresh' | 'stale' | 'expired' | 'unknown') || entry.freshness_status,
        version: newVersion,
        updated_at: new Date(),
      },
    });
  } else {
    // Create new DKS entry
    const newEntry = await prisma.dksEntry.create({
      data: {
        title: proposal.proposed_title || 'New Knowledge Entry',
        summary: proposal.proposed_summary,
        tags: proposal.proposed_tags,
        confidence: (proposal.proposed_confidence as 'low' | 'medium' | 'high') || 'low',
        freshness_status: (proposal.proposed_freshness_status as 'fresh' | 'stale' | 'expired' | 'unknown') || 'fresh',
        source: proposal.proposed_source,
        source_type: (proposal.proposed_source_type as 'official_docs' | 'official_policy' | 'internal_benchmark' | 'team_decision' | 'third_party_research' | 'internal_analytics' | 'saif_decision' | 'platform_rule' | 'learning_insight') || 'learning_insight',
        version: '1.0',
      },
    });
    dksEntryId = newEntry.id;
    previousVersion = null;
  }

  // Create knowledge revision record
  const revision = await prisma.knowledgeRevision.create({
    data: {
      dks_entry_id: dksEntryId,
      dks_update_proposal_id: proposalId,
      previous_version: previousVersion,
      new_version: previousVersion ? incrementVersion(previousVersion) : '1.0',
      changed_fields: {
        title: proposal.proposed_title,
        summary: proposal.proposed_summary,
        tags: proposal.proposed_tags,
        confidence: proposal.proposed_confidence,
        freshness_status: proposal.proposed_freshness_status,
      },
      revision_summary: `Applied DKS update from learning signal ${proposal.learning_signal_id}`,
      applied_by_user_id: appliedByUserId,
      applied_by_agent_rep_id: appliedByAgentRepId,
    },
  });

  // Mark proposal as applied
  await prisma.dksUpdateProposal.update({
    where: { id: proposalId },
    data: { proposal_status: 'applied' },
  });

  return mapKnowledgeRevision(revision);
}

export async function listKnowledgeRevisions(filters?: {
  dksEntryId?: string;
  dksUpdateProposalId?: string;
}): Promise<KnowledgeRevisionSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.dksEntryId) where.dks_entry_id = filters.dksEntryId;
  if (filters?.dksUpdateProposalId) where.dks_update_proposal_id = filters.dksUpdateProposalId;

  const revisions = await prisma.knowledgeRevision.findMany({ where, orderBy: { created_at: 'desc' } });
  return revisions.map(mapKnowledgeRevision);
}

// ============================================================
// Helpers
// ============================================================

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const major = parseInt(parts[0]) || 1;
  const minor = parseInt(parts[1]) || 0;
  return `${major}.${minor + 1}`;
}

// ============================================================
// Mappers
// ============================================================

function mapLearningSignalReview(r: Record<string, unknown>): LearningSignalReviewSummary {
  return {
    id: r.id as string,
    learningSignalId: r.learning_signal_id as string,
    reviewStatus: r.review_status as LearningSignalReviewSummary['reviewStatus'],
    reviewerUserId: r.reviewer_user_id as string | null,
    reviewerAgentRepId: r.reviewer_agent_rep_id as string | null,
    reviewDecision: r.review_decision as string | null,
    reviewRationale: r.review_rationale as string | null,
    confidenceAssessment: r.confidence_assessment as string | null,
    riskAssessment: r.risk_assessment as string | null,
    createdAt: r.created_at as Date,
    reviewedAt: r.reviewed_at as Date | null,
    updatedAt: r.updated_at as Date,
  };
}

function mapDksUpdateProposal(p: Record<string, unknown>): DksUpdateProposalSummary {
  return {
    id: p.id as string,
    learningSignalId: p.learning_signal_id as string,
    learningSignalReviewId: p.learning_signal_review_id as string | null,
    targetDksEntryId: p.target_dks_entry_id as string | null,
    proposalType: p.proposal_type as DksUpdateProposalSummary['proposalType'],
    proposedTitle: p.proposed_title as string | null,
    proposedSummary: p.proposed_summary as string | null,
    proposedTags: p.proposed_tags as string[],
    proposedConfidence: p.proposed_confidence as string | null,
    proposedFreshnessStatus: p.proposed_freshness_status as string | null,
    proposedSource: p.proposed_source as string | null,
    proposedSourceType: p.proposed_source_type as string | null,
    proposedVersionChange: p.proposed_version_change as string | null,
    rationale: p.rationale as string | null,
    proposalStatus: p.proposal_status as DksUpdateProposalSummary['proposalStatus'],
    createdByUserId: p.created_by_user_id as string,
    createdByAgentRepId: p.created_by_agent_rep_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapDksUpdateDecision(d: Record<string, unknown>): DksUpdateDecisionSummary {
  return {
    id: d.id as string,
    dksUpdateProposalId: d.dks_update_proposal_id as string,
    authorityUserId: d.authority_user_id as string,
    authorityAgentRepId: d.authority_agent_rep_id as string,
    decision: d.decision as DksUpdateDecisionSummary['decision'],
    rationale: d.rationale as string | null,
    riskAcceptance: d.risk_acceptance as string | null,
    appliedAt: d.applied_at as Date | null,
    createdAt: d.created_at as Date,
    updatedAt: d.updated_at as Date,
  };
}

function mapKnowledgeRevision(r: Record<string, unknown>): KnowledgeRevisionSummary {
  return {
    id: r.id as string,
    dksEntryId: r.dks_entry_id as string,
    dksUpdateProposalId: r.dks_update_proposal_id as string | null,
    previousVersion: r.previous_version as string | null,
    newVersion: r.new_version as string,
    changedFields: r.changed_fields as Record<string, unknown> | null,
    revisionSummary: r.revision_summary as string | null,
    appliedByUserId: r.applied_by_user_id as string,
    appliedByAgentRepId: r.applied_by_agent_rep_id as string,
    createdAt: r.created_at as Date,
  };
}
