import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateObservabilityEventInput, CreateAuditRecordInput, CreateLearningSignalInput,
  EvidenceTrailQuery,
  ObservabilityEventSummary, AuditRecordSummary, LearningSignalSummary, EvidenceTrail,
  LearningSignalStatus,
} from './types';

// ============================================================
// ObservabilityEvent
// ============================================================

export async function createEvent(input: CreateObservabilityEventInput): Promise<ObservabilityEventSummary> {
  const event = await prisma.observabilityEvent.create({
    data: {
      event_type: input.eventType,
      event_category: input.eventCategory,
      severity: input.severity,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      acting_agent_type: input.actingAgentType,
      acting_agent_id: input.actingAgentId,
      source_substrate: input.sourceSubstrate,
      source_module: input.sourceModule,
      target_object_type: input.targetObjectType,
      target_object_id: input.targetObjectId,
      run_id: input.runId,
      artifact_id: input.artifactId,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      payload_summary: input.payloadSummary,
    },
  });
  return mapEvent(event);
}

export async function getEventById(id: string): Promise<ObservabilityEventSummary> {
  const event = await prisma.observabilityEvent.findUnique({ where: { id } });
  if (!event) throw new NotFoundError('ObservabilityEvent', id);
  return mapEvent(event);
}

export async function listEvents(filters?: {
  eventType?: string;
  eventCategory?: string;
  severity?: string;
  humanUserId?: string;
  agentRepId?: string;
  targetObjectType?: string;
  targetObjectId?: string;
}): Promise<ObservabilityEventSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.eventType) where.event_type = filters.eventType;
  if (filters?.eventCategory) where.event_category = filters.eventCategory;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.agentRepId) where.agent_rep_id = filters.agentRepId;
  if (filters?.targetObjectType) where.target_object_type = filters.targetObjectType;
  if (filters?.targetObjectId) where.target_object_id = filters.targetObjectId;

  const events = await prisma.observabilityEvent.findMany({ where, orderBy: { created_at: 'desc' } });
  return events.map(mapEvent);
}

// ============================================================
// AuditRecord
// ============================================================

export async function createAuditRecord(input: CreateAuditRecordInput): Promise<AuditRecordSummary> {
  const record = await prisma.auditRecord.create({
    data: {
      audit_type: input.auditType,
      action: input.action,
      result: input.result,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      acting_agent_type: input.actingAgentType,
      acting_agent_id: input.actingAgentId,
      target_object_type: input.targetObjectType,
      target_object_id: input.targetObjectId,
      source_substrate: input.sourceSubstrate,
      source_module: input.sourceModule,
      reason: input.reason,
      rationale: input.rationale,
      before_state: input.beforeState as Prisma.InputJsonValue | undefined,
      after_state: input.afterState as Prisma.InputJsonValue | undefined,
      risk_category: input.riskCategory,
      policy_matched: input.policyMatched,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      mcp_mediation_decision_id: input.mcpMediationDecisionId,
      spine_run_id: input.spineRunId,
      spine_artifact_id: input.spineArtifactId,
    },
  });
  return mapAuditRecord(record);
}

export async function getAuditRecordById(id: string): Promise<AuditRecordSummary> {
  const record = await prisma.auditRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('AuditRecord', id);
  return mapAuditRecord(record);
}

export async function listAuditRecords(filters?: {
  auditType?: string;
  action?: string;
  result?: string;
  humanUserId?: string;
  agentRepId?: string;
  targetObjectType?: string;
  targetObjectId?: string;
}): Promise<AuditRecordSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.auditType) where.audit_type = filters.auditType;
  if (filters?.action) where.action = filters.action;
  if (filters?.result) where.result = filters.result;
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.agentRepId) where.agent_rep_id = filters.agentRepId;
  if (filters?.targetObjectType) where.target_object_type = filters.targetObjectType;
  if (filters?.targetObjectId) where.target_object_id = filters.targetObjectId;

  const records = await prisma.auditRecord.findMany({ where, orderBy: { created_at: 'desc' } });
  return records.map(mapAuditRecord);
}

// ============================================================
// LearningSignal
// ============================================================

export async function createLearningSignal(input: CreateLearningSignalInput): Promise<LearningSignalSummary> {
  const signal = await prisma.learningSignal.create({
    data: {
      signal_type: input.signalType,
      signal_category: input.signalCategory,
      source_event_id: input.sourceEventId,
      source_audit_record_id: input.sourceAuditRecordId,
      source_run_id: input.sourceRunId,
      source_artifact_id: input.sourceArtifactId,
      saif_decision_record_id: input.saifDecisionRecordId,
      dks_entry_id: input.dksEntryId,
      signal_summary: input.signalSummary,
      confidence: input.confidence,
      strength: input.strength,
      observed_outcome: input.observedOutcome,
      expected_outcome: input.expectedOutcome,
      variance: input.variance,
      recommendation: input.recommendation,
    },
  });
  return mapLearningSignal(signal);
}

export async function getLearningSignalById(id: string): Promise<LearningSignalSummary> {
  const signal = await prisma.learningSignal.findUnique({ where: { id } });
  if (!signal) throw new NotFoundError('LearningSignal', id);
  return mapLearningSignal(signal);
}

export async function listLearningSignals(filters?: {
  signalType?: string;
  status?: string;
  saifDecisionRecordId?: string;
  dksEntryId?: string;
}): Promise<LearningSignalSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.signalType) where.signal_type = filters.signalType;
  if (filters?.status) where.status = filters.status;
  if (filters?.saifDecisionRecordId) where.saif_decision_record_id = filters.saifDecisionRecordId;
  if (filters?.dksEntryId) where.dks_entry_id = filters.dksEntryId;

  const signals = await prisma.learningSignal.findMany({ where, orderBy: { created_at: 'desc' } });
  return signals.map(mapLearningSignal);
}

export async function updateLearningSignalStatus(
  id: string,
  status: LearningSignalStatus,
  reviewedByUserId?: string,
  reviewedByAgentRepId?: string,
): Promise<LearningSignalSummary> {
  const existing = await prisma.learningSignal.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('LearningSignal', id);

  const data: Record<string, unknown> = { status };
  if (status === 'under_review' || status === 'accepted' || status === 'rejected') {
    data.reviewed_at = new Date();
    data.reviewed_by_user_id = reviewedByUserId;
    data.reviewed_by_agent_rep_id = reviewedByAgentRepId;
  }

  const signal = await prisma.learningSignal.update({ where: { id }, data });
  return mapLearningSignal(signal);
}

// ============================================================
// Evidence Trail
// ============================================================

export async function getEvidenceTrail(query: EvidenceTrailQuery): Promise<EvidenceTrail> {
  const eventWhere: Record<string, unknown> = {};
  const auditWhere: Record<string, unknown> = {};
  const signalWhere: Record<string, unknown> = {};

  if (query.targetObjectType && query.targetObjectId) {
    eventWhere.target_object_type = query.targetObjectType;
    eventWhere.target_object_id = query.targetObjectId;
    auditWhere.target_object_type = query.targetObjectType;
    auditWhere.target_object_id = query.targetObjectId;
  }
  if (query.humanUserId) {
    eventWhere.human_user_id = query.humanUserId;
    auditWhere.human_user_id = query.humanUserId;
  }
  if (query.agentRepId) {
    eventWhere.agent_rep_id = query.agentRepId;
    auditWhere.agent_rep_id = query.agentRepId;
  }
  if (query.saifDecisionRecordId) {
    eventWhere.saif_decision_record_id = query.saifDecisionRecordId;
    auditWhere.saif_decision_record_id = query.saifDecisionRecordId;
    signalWhere.saif_decision_record_id = query.saifDecisionRecordId;
  }
  if (query.approvalId) {
    eventWhere.approval_id = query.approvalId;
    auditWhere.approval_id = query.approvalId;
  }
  if (query.capabilityResolutionId) {
    eventWhere.capability_resolution_id = query.capabilityResolutionId;
    auditWhere.capability_resolution_id = query.capabilityResolutionId;
  }
  if (query.mcpMediationRequestId) {
    eventWhere.mcp_mediation_request_id = query.mcpMediationRequestId;
  }
  if (query.runId) {
    eventWhere.run_id = query.runId;
    auditWhere.spine_run_id = query.runId;
    signalWhere.source_run_id = query.runId;
  }
  if (query.artifactId) {
    eventWhere.artifact_id = query.artifactId;
    auditWhere.spine_artifact_id = query.artifactId;
    signalWhere.source_artifact_id = query.artifactId;
  }

  const [events, auditRecords, learningSignals] = await Promise.all([
    Object.keys(eventWhere).length > 0
      ? prisma.observabilityEvent.findMany({ where: eventWhere, orderBy: { created_at: 'desc' }, take: 100 })
      : Promise.resolve([]),
    Object.keys(auditWhere).length > 0
      ? prisma.auditRecord.findMany({ where: auditWhere, orderBy: { created_at: 'desc' }, take: 100 })
      : Promise.resolve([]),
    Object.keys(signalWhere).length > 0
      ? prisma.learningSignal.findMany({ where: signalWhere, orderBy: { created_at: 'desc' }, take: 100 })
      : Promise.resolve([]),
  ]);

  return {
    events: events.map(mapEvent),
    auditRecords: auditRecords.map(mapAuditRecord),
    learningSignals: learningSignals.map(mapLearningSignal),
  };
}

// ============================================================
// Mappers
// ============================================================

function mapEvent(e: Record<string, unknown>): ObservabilityEventSummary {
  return {
    id: e.id as string,
    eventType: e.event_type as string,
    eventCategory: e.event_category as string,
    severity: e.severity as ObservabilityEventSummary['severity'],
    humanUserId: e.human_user_id as string | null,
    agentRepId: e.agent_rep_id as string | null,
    actingAgentType: e.acting_agent_type as string | null,
    actingAgentId: e.acting_agent_id as string | null,
    sourceSubstrate: e.source_substrate as string | null,
    sourceModule: e.source_module as string | null,
    targetObjectType: e.target_object_type as string | null,
    targetObjectId: e.target_object_id as string | null,
    runId: e.run_id as string | null,
    artifactId: e.artifact_id as string | null,
    saifDecisionRecordId: e.saif_decision_record_id as string | null,
    approvalId: e.approval_id as string | null,
    capabilityResolutionId: e.capability_resolution_id as string | null,
    mcpMediationRequestId: e.mcp_mediation_request_id as string | null,
    payloadSummary: e.payload_summary as string | null,
    occurredAt: e.occurred_at as Date,
    createdAt: e.created_at as Date,
  };
}

function mapAuditRecord(a: Record<string, unknown>): AuditRecordSummary {
  return {
    id: a.id as string,
    auditType: a.audit_type as string,
    action: a.action as string,
    result: a.result as AuditRecordSummary['result'],
    humanUserId: a.human_user_id as string | null,
    agentRepId: a.agent_rep_id as string | null,
    actingAgentType: a.acting_agent_type as string | null,
    actingAgentId: a.acting_agent_id as string | null,
    targetObjectType: a.target_object_type as string | null,
    targetObjectId: a.target_object_id as string | null,
    sourceSubstrate: a.source_substrate as string | null,
    sourceModule: a.source_module as string | null,
    reason: a.reason as string | null,
    rationale: a.rationale as string | null,
    beforeState: a.before_state as Record<string, unknown> | null,
    afterState: a.after_state as Record<string, unknown> | null,
    riskCategory: a.risk_category as string | null,
    policyMatched: a.policy_matched as string | null,
    saifDecisionRecordId: a.saif_decision_record_id as string | null,
    approvalId: a.approval_id as string | null,
    capabilityResolutionId: a.capability_resolution_id as string | null,
    mcpMediationDecisionId: a.mcp_mediation_decision_id as string | null,
    spineRunId: a.spine_run_id as string | null,
    spineArtifactId: a.spine_artifact_id as string | null,
    createdAt: a.created_at as Date,
  };
}

function mapLearningSignal(s: Record<string, unknown>): LearningSignalSummary {
  return {
    id: s.id as string,
    signalType: s.signal_type as LearningSignalSummary['signalType'],
    signalCategory: s.signal_category as string | null,
    sourceEventId: s.source_event_id as string | null,
    sourceAuditRecordId: s.source_audit_record_id as string | null,
    sourceRunId: s.source_run_id as string | null,
    sourceArtifactId: s.source_artifact_id as string | null,
    saifDecisionRecordId: s.saif_decision_record_id as string | null,
    dksEntryId: s.dks_entry_id as string | null,
    signalSummary: s.signal_summary as string | null,
    confidence: s.confidence as string,
    strength: s.strength as number | null,
    observedOutcome: s.observed_outcome as string | null,
    expectedOutcome: s.expected_outcome as string | null,
    variance: s.variance as string | null,
    recommendation: s.recommendation as string | null,
    status: s.status as LearningSignalSummary['status'],
    createdAt: s.created_at as Date,
    reviewedAt: s.reviewed_at as Date | null,
    reviewedByUserId: s.reviewed_by_user_id as string | null,
    reviewedByAgentRepId: s.reviewed_by_agent_rep_id as string | null,
  };
}
