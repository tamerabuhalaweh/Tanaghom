import { z } from 'zod';

export const SPINE_RUN_TYPES = ['planned', 'simulated', 'advisory', 'execution'] as const;
export type SpineRunType = (typeof SPINE_RUN_TYPES)[number];

export const SPINE_RUN_STATUSES = ['planned', 'ready', 'simulated', 'running', 'succeeded', 'failed', 'cancelled', 'blocked', 'audited'] as const;
export type SpineRunStatus = (typeof SPINE_RUN_STATUSES)[number];

export const SPINE_REPLAY_STATUSES = ['replayable', 'partial', 'not_replayable'] as const;
export type SpineReplayStatus = (typeof SPINE_REPLAY_STATUSES)[number];

export const SPINE_ARTIFACT_TYPES = [
  'campaign_request_snapshot', 'draft_version_snapshot', 'reach_score_report',
  'approval_record_snapshot', 'saif_decision_record', 'dks_reference_bundle',
  'capability_resolution_bundle', 'mediation_decision_record', 'future_publishing_package'
] as const;
export type SpineArtifactType = (typeof SPINE_ARTIFACT_TYPES)[number];

export const SPINE_ARTIFACT_STATUSES = ['created', 'validated', 'archived', 'superseded'] as const;
export type SpineArtifactStatus = (typeof SPINE_ARTIFACT_STATUSES)[number];

export const SPINE_ARTIFACT_LINK_TYPES = [
  'derived_from', 'supports', 'supersedes', 'evidence_for', 'produced_by', 'consumed_by', 'references'
] as const;
export type SpineArtifactLinkType = (typeof SPINE_ARTIFACT_LINK_TYPES)[number];

export const createSpineRunSchema = z.object({
  runType: z.enum(SPINE_RUN_TYPES).default('planned'),
  humanUserId: z.string().uuid(),
  agentRepId: z.string().uuid(),
  actingAgentType: z.string().min(1).max(100),
  actingAgentId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  mcpMediationDecisionId: z.string().uuid().optional(),
  parentRunId: z.string().uuid().optional(),
  rationale: z.string().max(5000).optional(),
  expectedOutcome: z.string().max(5000).optional(),
});

export const updateSpineRunStatusSchema = z.object({
  status: z.enum(SPINE_RUN_STATUSES),
  actualOutcome: z.string().max(5000).optional(),
  failureReason: z.string().max(5000).optional(),
});

export const createSpineArtifactSchema = z.object({
  artifactType: z.enum(SPINE_ARTIFACT_TYPES),
  canonicalOwner: z.string().max(200).optional(),
  sourceObjectType: z.string().max(200).optional(),
  sourceObjectId: z.string().uuid().optional(),
  runId: z.string().uuid(),
  saifDecisionRecordId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  contentHash: z.string().max(200).optional(),
  version: z.number().int().default(1),
  metadata: z.record(z.unknown()).optional(),
  summary: z.string().max(5000).optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createSpineArtifactLinkSchema = z.object({
  sourceArtifactId: z.string().uuid(),
  targetArtifactId: z.string().uuid(),
  relationshipType: z.enum(SPINE_ARTIFACT_LINK_TYPES),
  rationale: z.string().max(5000).optional(),
});

export type CreateSpineRunInput = z.infer<typeof createSpineRunSchema>;
export type UpdateSpineRunStatusInput = z.infer<typeof updateSpineRunStatusSchema>;
export type CreateSpineArtifactInput = z.infer<typeof createSpineArtifactSchema>;
export type CreateSpineArtifactLinkInput = z.infer<typeof createSpineArtifactLinkSchema>;

export interface SpineRunSummary {
  id: string;
  runType: SpineRunType;
  runStatus: SpineRunStatus;
  humanUserId: string;
  agentRepId: string;
  actingAgentType: string;
  actingAgentId: string | null;
  saifDecisionRecordId: string | null;
  capabilityResolutionId: string | null;
  approvalId: string | null;
  mcpMediationRequestId: string | null;
  mcpMediationDecisionId: string | null;
  parentRunId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  rationale: string | null;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  failureReason: string | null;
  replayStatus: SpineReplayStatus;
  createdAt: Date;
  updatedAt: Date;
  childRuns?: SpineRunSummary[];
  artifacts?: SpineArtifactSummary[];
}

export interface SpineArtifactSummary {
  id: string;
  artifactType: SpineArtifactType;
  artifactStatus: SpineArtifactStatus;
  canonicalOwner: string | null;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  runId: string;
  saifDecisionRecordId: string | null;
  capabilityResolutionId: string | null;
  approvalId: string | null;
  contentHash: string | null;
  version: number;
  metadata: Record<string, unknown> | null;
  summary: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpineArtifactLinkSummary {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationshipType: SpineArtifactLinkType;
  rationale: string | null;
  createdAt: Date;
}

export interface SpineReplayBundle {
  run: SpineRunSummary;
  artifacts: SpineArtifactSummary[];
  artifactLinks: SpineArtifactLinkSummary[];
  saifDecisionRecordId: string | null;
  capabilityResolutionId: string | null;
  approvalId: string | null;
  mcpMediationRequestId: string | null;
  mcpMediationDecisionId: string | null;
}

export interface SpineArtifactLineage {
  artifact: SpineArtifactSummary;
  sourceLinks: SpineArtifactLinkSummary[];
  targetLinks: SpineArtifactLinkSummary[];
}

export const VALID_RUN_TRANSITIONS: Record<SpineRunStatus, SpineRunStatus[]> = {
  planned: ['ready', 'cancelled', 'blocked'],
  ready: ['simulated', 'running', 'cancelled', 'blocked'],
  simulated: ['ready', 'succeeded', 'failed', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['audited'],
  failed: ['planned', 'cancelled'],
  cancelled: [],
  blocked: ['planned', 'ready', 'cancelled'],
  audited: [],
};

export function isValidRunTransition(from: SpineRunStatus, to: SpineRunStatus): boolean {
  return VALID_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateRunTransition(from: SpineRunStatus, to: SpineRunStatus): void {
  if (!isValidRunTransition(from, to)) {
    throw new Error(`Invalid run status transition: ${from} → ${to}`);
  }
}
