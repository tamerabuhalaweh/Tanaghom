import { z } from 'zod';

export const EVENT_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const AUDIT_RESULTS = ['success', 'failure', 'blocked', 'denied', 'deferred', 'escalated', 'cancelled'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const LEARNING_SIGNAL_TYPES = ['performance', 'quality', 'compliance', 'efficiency', 'risk', 'pattern'] as const;
export type LearningSignalType = (typeof LEARNING_SIGNAL_TYPES)[number];

export const LEARNING_SIGNAL_STATUSES = ['observed', 'under_review', 'accepted', 'rejected', 'superseded'] as const;
export type LearningSignalStatus = (typeof LEARNING_SIGNAL_STATUSES)[number];

export const EVENT_CATEGORIES = [
  'identity', 'auth', 'campaign', 'ai_generation', 'algorithm_intelligence',
  'saif_decision', 'dks', 'approval', 'capability_resolution', 'mcp_mediation',
  'spine', 'security', 'system'
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const createObservabilityEventSchema = z.object({
  eventType: z.string().min(1).max(200),
  eventCategory: z.enum(EVENT_CATEGORIES),
  severity: z.enum(EVENT_SEVERITIES).default('info'),
  humanUserId: z.string().uuid().optional(),
  agentRepId: z.string().uuid().optional(),
  actingAgentType: z.string().max(100).optional(),
  actingAgentId: z.string().uuid().optional(),
  sourceSubstrate: z.string().max(200).optional(),
  sourceModule: z.string().max(200).optional(),
  targetObjectType: z.string().max(200).optional(),
  targetObjectId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  artifactId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  payloadSummary: z.string().max(5000).optional(),
});

export const createAuditRecordSchema = z.object({
  auditType: z.string().min(1).max(200),
  action: z.string().min(1).max(200),
  result: z.enum(AUDIT_RESULTS),
  humanUserId: z.string().uuid().optional(),
  agentRepId: z.string().uuid().optional(),
  actingAgentType: z.string().max(100).optional(),
  actingAgentId: z.string().uuid().optional(),
  targetObjectType: z.string().max(200).optional(),
  targetObjectId: z.string().uuid().optional(),
  sourceSubstrate: z.string().max(200).optional(),
  sourceModule: z.string().max(200).optional(),
  reason: z.string().max(5000).optional(),
  rationale: z.string().max(5000).optional(),
  beforeState: z.record(z.unknown()).optional(),
  afterState: z.record(z.unknown()).optional(),
  riskCategory: z.string().max(100).optional(),
  policyMatched: z.string().max(200).optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationDecisionId: z.string().uuid().optional(),
  spineRunId: z.string().uuid().optional(),
  spineArtifactId: z.string().uuid().optional(),
});

export const createLearningSignalSchema = z.object({
  signalType: z.enum(LEARNING_SIGNAL_TYPES),
  signalCategory: z.string().max(200).optional(),
  sourceEventId: z.string().uuid().optional(),
  sourceAuditRecordId: z.string().uuid().optional(),
  sourceRunId: z.string().uuid().optional(),
  sourceArtifactId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  dksEntryId: z.string().uuid().optional(),
  signalSummary: z.string().max(5000).optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  strength: z.number().min(0).max(1).optional(),
  observedOutcome: z.string().max(5000).optional(),
  expectedOutcome: z.string().max(5000).optional(),
  variance: z.string().max(5000).optional(),
  recommendation: z.string().max(5000).optional(),
});

export const evidenceTrailQuerySchema = z.object({
  targetObjectType: z.string().optional(),
  targetObjectId: z.string().uuid().optional(),
  humanUserId: z.string().uuid().optional(),
  agentRepId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  artifactId: z.string().uuid().optional(),
});

export type CreateObservabilityEventInput = z.infer<typeof createObservabilityEventSchema>;
export type CreateAuditRecordInput = z.infer<typeof createAuditRecordSchema>;
export type CreateLearningSignalInput = z.infer<typeof createLearningSignalSchema>;
export type EvidenceTrailQuery = z.infer<typeof evidenceTrailQuerySchema>;

export interface ObservabilityEventSummary {
  id: string;
  eventType: string;
  eventCategory: string;
  severity: EventSeverity;
  humanUserId: string | null;
  agentRepId: string | null;
  actingAgentType: string | null;
  actingAgentId: string | null;
  sourceSubstrate: string | null;
  sourceModule: string | null;
  targetObjectType: string | null;
  targetObjectId: string | null;
  runId: string | null;
  artifactId: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  mcpMediationRequestId: string | null;
  payloadSummary: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface AuditRecordSummary {
  id: string;
  auditType: string;
  action: string;
  result: AuditResult;
  humanUserId: string | null;
  agentRepId: string | null;
  actingAgentType: string | null;
  actingAgentId: string | null;
  targetObjectType: string | null;
  targetObjectId: string | null;
  sourceSubstrate: string | null;
  sourceModule: string | null;
  reason: string | null;
  rationale: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  riskCategory: string | null;
  policyMatched: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  mcpMediationDecisionId: string | null;
  spineRunId: string | null;
  spineArtifactId: string | null;
  createdAt: Date;
}

export interface LearningSignalSummary {
  id: string;
  signalType: LearningSignalType;
  signalCategory: string | null;
  sourceEventId: string | null;
  sourceAuditRecordId: string | null;
  sourceRunId: string | null;
  sourceArtifactId: string | null;
  saifDecisionRecordId: string | null;
  dksEntryId: string | null;
  signalSummary: string | null;
  confidence: string;
  strength: number | null;
  observedOutcome: string | null;
  expectedOutcome: string | null;
  variance: string | null;
  recommendation: string | null;
  status: LearningSignalStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedByAgentRepId: string | null;
}

export interface EvidenceTrail {
  events: ObservabilityEventSummary[];
  auditRecords: AuditRecordSummary[];
  learningSignals: LearningSignalSummary[];
}
