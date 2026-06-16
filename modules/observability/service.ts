import { ForbiddenError } from '@shared/errors';
import * as repo from './repository';
import type {
  CreateObservabilityEventInput, CreateAuditRecordInput, CreateLearningSignalInput,
  EvidenceTrailQuery,
  ObservabilityEventSummary, AuditRecordSummary, LearningSignalSummary, EvidenceTrail,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['observability:create', 'observability:read', 'observability:review'],
  cco: ['observability:create', 'observability:read', 'observability:review'],
  department_head: ['observability:create', 'observability:read'],
  specialist: ['observability:create', 'observability:read'],
  reviewer: ['observability:read'],
  viewer: ['observability:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

// ============================================================
// ObservabilityEvent Service
// ============================================================

export async function createEvent(requesterRole: string, input: CreateObservabilityEventInput): Promise<ObservabilityEventSummary> {
  checkPermission(requesterRole, 'observability:create');
  return repo.createEvent(input);
}

export async function getEvent(requesterRole: string, id: string): Promise<ObservabilityEventSummary> {
  checkPermission(requesterRole, 'observability:read');
  return repo.getEventById(id);
}

export async function listEvents(requesterRole: string, filters?: {
  eventType?: string;
  eventCategory?: string;
  severity?: string;
  humanUserId?: string;
  agentRepId?: string;
  targetObjectType?: string;
  targetObjectId?: string;
}): Promise<ObservabilityEventSummary[]> {
  checkPermission(requesterRole, 'observability:read');
  return repo.listEvents(filters);
}

// ============================================================
// AuditRecord Service
// ============================================================

export async function createAuditRecord(requesterRole: string, input: CreateAuditRecordInput): Promise<AuditRecordSummary> {
  checkPermission(requesterRole, 'observability:create');
  return repo.createAuditRecord(input);
}

export async function getAuditRecord(requesterRole: string, id: string): Promise<AuditRecordSummary> {
  checkPermission(requesterRole, 'observability:read');
  return repo.getAuditRecordById(id);
}

export async function listAuditRecords(requesterRole: string, filters?: {
  auditType?: string;
  action?: string;
  result?: string;
  humanUserId?: string;
  agentRepId?: string;
  targetObjectType?: string;
  targetObjectId?: string;
}): Promise<AuditRecordSummary[]> {
  checkPermission(requesterRole, 'observability:read');
  return repo.listAuditRecords(filters);
}

// ============================================================
// LearningSignal Service
// ============================================================

export async function createLearningSignal(requesterRole: string, input: CreateLearningSignalInput): Promise<LearningSignalSummary> {
  checkPermission(requesterRole, 'observability:create');

  // LearningSignal cannot authorize, approve, publish, or execute
  if (input.signalType === 'performance' && input.recommendation?.toLowerCase().includes('approve')) {
    throw new ForbiddenError('LearningSignal cannot authorize or approve actions');
  }

  return repo.createLearningSignal(input);
}

export async function getLearningSignal(requesterRole: string, id: string): Promise<LearningSignalSummary> {
  checkPermission(requesterRole, 'observability:read');
  return repo.getLearningSignalById(id);
}

export async function listLearningSignals(requesterRole: string, filters?: {
  signalType?: string;
  status?: string;
  saifDecisionRecordId?: string;
  dksEntryId?: string;
}): Promise<LearningSignalSummary[]> {
  checkPermission(requesterRole, 'observability:read');
  return repo.listLearningSignals(filters);
}

export async function markLearningSignalUnderReview(
  requesterRole: string,
  signalId: string,
  reviewedByUserId?: string,
  reviewedByAgentRepId?: string,
): Promise<LearningSignalSummary> {
  checkPermission(requesterRole, 'observability:review');
  return repo.updateLearningSignalStatus(signalId, 'under_review', reviewedByUserId, reviewedByAgentRepId);
}

export async function acceptLearningSignal(
  requesterRole: string,
  signalId: string,
  reviewedByUserId?: string,
  reviewedByAgentRepId?: string,
): Promise<LearningSignalSummary> {
  checkPermission(requesterRole, 'observability:review');
  return repo.updateLearningSignalStatus(signalId, 'accepted', reviewedByUserId, reviewedByAgentRepId);
}

export async function rejectLearningSignal(
  requesterRole: string,
  signalId: string,
  reviewedByUserId?: string,
  reviewedByAgentRepId?: string,
): Promise<LearningSignalSummary> {
  checkPermission(requesterRole, 'observability:review');
  return repo.updateLearningSignalStatus(signalId, 'rejected', reviewedByUserId, reviewedByAgentRepId);
}

// ============================================================
// Evidence Trail
// ============================================================

export async function getEvidenceTrail(requesterRole: string, query: EvidenceTrailQuery): Promise<EvidenceTrail> {
  checkPermission(requesterRole, 'observability:read');
  return repo.getEvidenceTrail(query);
}
