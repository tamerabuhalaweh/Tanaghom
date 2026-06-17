import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateLearningSignalReviewInput, ReviewDecisionInput,
  CreateDksUpdateProposalInput, DksUpdateDecisionInput,
  LearningSignalReviewSummary, DksUpdateProposalSummary,
  DksUpdateDecisionSummary, KnowledgeRevisionSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['learning:create', 'learning:read', 'learning:review', 'learning:propose', 'learning:decide', 'learning:apply'],
  cco: ['learning:create', 'learning:read', 'learning:review', 'learning:propose', 'learning:decide', 'learning:apply'],
  department_head: ['learning:create', 'learning:read', 'learning:review', 'learning:propose'],
  specialist: ['learning:read', 'learning:propose'],
  reviewer: ['learning:read', 'learning:review'],
  viewer: ['learning:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

function validateSessionContextLock(
  sessionUserId: string,
  sessionAgentRepId: string,
  actionUserId: string,
  actionAgentRepId: string,
): void {
  if (sessionUserId !== actionUserId) {
    throw new ForbiddenError('Session Context Lock: Cannot act on behalf of another user');
  }
  if (sessionAgentRepId !== actionAgentRepId) {
    throw new ForbiddenError('Session Context Lock: Cannot use another user\'s AgentRep');
  }
}

// ============================================================
// LearningSignalReview Service
// ============================================================

export async function createLearningSignalReview(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateLearningSignalReviewInput,
): Promise<LearningSignalReviewSummary> {
  checkPermission(requesterRole, 'learning:create');

  const review = await repo.createLearningSignalReview(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'learning_signal_submitted_for_review', object_type: 'learning_signal_review', object_id: review.id, result: 'success' },
    `Learning signal ${review.learningSignalId} submitted for review`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'submit_learning_signal_for_review',
    'learning_signal_review',
    review.id,
    'success',
    { learningSignalId: review.learningSignalId },
  );

  return review;
}

export async function getLearningSignalReview(requesterRole: string, id: string): Promise<LearningSignalReviewSummary> {
  checkPermission(requesterRole, 'learning:read');
  return repo.getLearningSignalReviewById(id);
}

export async function listLearningSignalReviews(requesterRole: string, filters?: {
  learningSignalId?: string;
  reviewStatus?: string;
  reviewerUserId?: string;
}): Promise<LearningSignalReviewSummary[]> {
  checkPermission(requesterRole, 'learning:read');
  return repo.listLearningSignalReviews(filters);
}

export async function acceptReview(
  requesterRole: string,
  reviewId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: ReviewDecisionInput,
): Promise<LearningSignalReviewSummary> {
  checkPermission(requesterRole, 'learning:review');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.reviewerUserId, input.reviewerAgentRepId);

  const review = await repo.updateReviewDecision(reviewId, { ...input, decision: 'accepted' });

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'learning_signal_accepted', object_type: 'learning_signal_review', object_id: reviewId, result: 'success' },
    `Learning signal review accepted: ${reviewId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'accept_learning_signal',
    'learning_signal_review',
    reviewId,
    'success',
    { learningSignalId: review.learningSignalId, decision: 'accepted' },
  );

  return review;
}

export async function rejectReview(
  requesterRole: string,
  reviewId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: ReviewDecisionInput,
): Promise<LearningSignalReviewSummary> {
  checkPermission(requesterRole, 'learning:review');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.reviewerUserId, input.reviewerAgentRepId);

  const review = await repo.updateReviewDecision(reviewId, { ...input, decision: 'rejected' });

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'learning_signal_rejected', object_type: 'learning_signal_review', object_id: reviewId, result: 'success' },
    `Learning signal review rejected: ${reviewId}`,
  );

  return review;
}

export async function requestMoreEvidence(
  requesterRole: string,
  reviewId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: ReviewDecisionInput,
): Promise<LearningSignalReviewSummary> {
  checkPermission(requesterRole, 'learning:review');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.reviewerUserId, input.reviewerAgentRepId);

  const review = await repo.updateReviewDecision(reviewId, { ...input, decision: 'needs_more_evidence' });

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'learning_signal_needs_more_evidence', object_type: 'learning_signal_review', object_id: reviewId, result: 'success' },
    `Learning signal review needs more evidence: ${reviewId}`,
  );

  return review;
}

// ============================================================
// DksUpdateProposal Service
// ============================================================

export async function createDksUpdateProposal(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateDksUpdateProposalInput,
): Promise<DksUpdateProposalSummary> {
  checkPermission(requesterRole, 'learning:propose');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // LearningSignal cannot directly update DKS
  // Must go through proposal workflow
  const proposal = await repo.createDksUpdateProposal(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'dks_update_proposal_created', object_type: 'dks_update_proposal', object_id: proposal.id, result: 'success' },
    `DKS update proposal created: ${proposal.proposalType} for signal ${proposal.learningSignalId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_dks_update_proposal',
    'dks_update_proposal',
    proposal.id,
    'success',
    { proposalType: proposal.proposalType, learningSignalId: proposal.learningSignalId },
  );

  return proposal;
}

export async function getDksUpdateProposal(requesterRole: string, id: string): Promise<DksUpdateProposalSummary> {
  checkPermission(requesterRole, 'learning:read');
  return repo.getDksUpdateProposalById(id);
}

export async function listDksUpdateProposals(requesterRole: string, filters?: {
  learningSignalId?: string;
  proposalStatus?: string;
  createdByUserId?: string;
}): Promise<DksUpdateProposalSummary[]> {
  checkPermission(requesterRole, 'learning:read');
  return repo.listDksUpdateProposals(filters);
}

// ============================================================
// DksUpdateDecision Service
// ============================================================

export async function approveProposal(
  requesterRole: string,
  proposalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: DksUpdateDecisionInput,
): Promise<DksUpdateDecisionSummary> {
  checkPermission(requesterRole, 'learning:decide');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.authorityUserId, input.authorityAgentRepId);

  const decision = await repo.createDksUpdateDecision(proposalId, { ...input, decision: 'approved' });

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'dks_update_approved', object_type: 'dks_update_decision', object_id: decision.id, result: 'success' },
    `DKS update proposal approved: ${proposalId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'approve_dks_update',
    'dks_update_decision',
    decision.id,
    'success',
    { proposalId, decision: 'approved' },
  );

  return decision;
}

export async function rejectProposal(
  requesterRole: string,
  proposalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: DksUpdateDecisionInput,
): Promise<DksUpdateDecisionSummary> {
  checkPermission(requesterRole, 'learning:decide');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.authorityUserId, input.authorityAgentRepId);

  const decision = await repo.createDksUpdateDecision(proposalId, { ...input, decision: 'rejected' });

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'dks_update_rejected', object_type: 'dks_update_decision', object_id: decision.id, result: 'success' },
    `DKS update proposal rejected: ${proposalId}`,
  );

  return decision;
}

export async function listDksUpdateDecisions(requesterRole: string, proposalId: string): Promise<DksUpdateDecisionSummary[]> {
  checkPermission(requesterRole, 'learning:read');
  return repo.listDksUpdateDecisions(proposalId);
}

// ============================================================
// KnowledgeRevision Service
// ============================================================

export async function applyDksUpdate(
  requesterRole: string,
  proposalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
): Promise<KnowledgeRevisionSummary> {
  checkPermission(requesterRole, 'learning:apply');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, sessionUserId, sessionAgentRepId);

  const revision = await repo.applyDksUpdate(proposalId, sessionUserId, sessionAgentRepId);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'dks_revision_applied', object_type: 'knowledge_revision', object_id: revision.id, result: 'success' },
    `DKS revision applied: ${revision.revisionSummary}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'apply_dks_update',
    'knowledge_revision',
    revision.id,
    'success',
    { dksEntryId: revision.dksEntryId, newVersion: revision.newVersion },
  );

  return revision;
}

export async function listKnowledgeRevisions(requesterRole: string, filters?: {
  dksEntryId?: string;
  dksUpdateProposalId?: string;
}): Promise<KnowledgeRevisionSummary[]> {
  checkPermission(requesterRole, 'learning:read');
  return repo.listKnowledgeRevisions(filters);
}
