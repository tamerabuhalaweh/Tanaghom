import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateSpineRunInput, UpdateSpineRunStatusInput,
  CreateSpineArtifactInput, CreateSpineArtifactLinkInput,
  SpineRunSummary, SpineArtifactSummary, SpineArtifactLinkSummary,
  SpineReplayBundle, SpineArtifactLineage,
  SpineRunStatus,
} from './types';
import { validateRunTransition } from './types';

// ============================================================
// SpineRun
// ============================================================

export async function createSpineRun(input: CreateSpineRunInput): Promise<SpineRunSummary> {
  // Block M5 write-enabled runs
  if (input.runType === 'execution') {
    throw new ForbiddenError('M5 write-enabled execution runs are blocked in this sprint');
  }

  const run = await prisma.spineRun.create({
    data: {
      run_type: input.runType,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      acting_agent_type: input.actingAgentType,
      acting_agent_id: input.actingAgentId,
      saif_decision_record_id: input.saifDecisionRecordId,
      capability_resolution_id: input.capabilityResolutionId,
      approval_id: input.approvalId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      mcp_mediation_decision_id: input.mcpMediationDecisionId,
      parent_run_id: input.parentRunId,
      rationale: input.rationale,
      expected_outcome: input.expectedOutcome,
    },
    include: { child_runs: true, artifacts: true },
  });
  return mapSpineRun(run);
}

export async function getSpineRunById(id: string): Promise<SpineRunSummary> {
  const run = await prisma.spineRun.findUnique({
    where: { id },
    include: { child_runs: true, artifacts: true },
  });
  if (!run) throw new NotFoundError('SpineRun', id);
  return mapSpineRun(run);
}

export async function listSpineRuns(filters?: {
  humanUserId?: string;
  agentRepId?: string;
  runStatus?: string;
  runType?: string;
  parentRunId?: string;
}): Promise<SpineRunSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.agentRepId) where.agent_rep_id = filters.agentRepId;
  if (filters?.runStatus) where.run_status = filters.runStatus;
  if (filters?.runType) where.run_type = filters.runType;
  if (filters?.parentRunId) where.parent_run_id = filters.parentRunId;

  const runs = await prisma.spineRun.findMany({
    where,
    include: { child_runs: true, artifacts: true },
    orderBy: { created_at: 'desc' },
  });
  return runs.map(mapSpineRun);
}

export async function updateSpineRunStatus(id: string, input: UpdateSpineRunStatusInput): Promise<SpineRunSummary> {
  const existing = await prisma.spineRun.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SpineRun', id);

  // Validate status transition
  validateRunTransition(existing.run_status as SpineRunStatus, input.status);

  // Block M5 execution
  if (input.status === 'running' && existing.run_type === 'execution') {
    throw new ForbiddenError('M5 write-enabled execution runs are blocked');
  }

  const data: Record<string, unknown> = { run_status: input.status };
  if (input.actualOutcome) data.actual_outcome = input.actualOutcome;
  if (input.failureReason) data.failure_reason = input.failureReason;
  if (input.status === 'running') data.started_at = new Date();
  if (input.status === 'succeeded' || input.status === 'failed') {
    data.completed_at = new Date();
    if (input.status === 'failed') data.failed_at = new Date();
  }

  const run = await prisma.spineRun.update({
    where: { id },
    data,
    include: { child_runs: true, artifacts: true },
  });
  return mapSpineRun(run);
}

// ============================================================
// SpineArtifact
// ============================================================

export async function createSpineArtifact(input: CreateSpineArtifactInput): Promise<SpineArtifactSummary> {
  const artifact = await prisma.spineArtifact.create({
    data: {
      artifact_type: input.artifactType,
      canonical_owner: input.canonicalOwner,
      source_object_type: input.sourceObjectType,
      source_object_id: input.sourceObjectId,
      run_id: input.runId,
      saif_decision_record_id: input.saifDecisionRecordId,
      capability_resolution_id: input.capabilityResolutionId,
      approval_id: input.approvalId,
      content_hash: input.contentHash,
      version: input.version,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      summary: input.summary,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapSpineArtifact(artifact);
}

export async function getSpineArtifactById(id: string): Promise<SpineArtifactSummary> {
  const artifact = await prisma.spineArtifact.findUnique({ where: { id } });
  if (!artifact) throw new NotFoundError('SpineArtifact', id);
  return mapSpineArtifact(artifact);
}

export async function listSpineArtifacts(filters?: {
  runId?: string;
  artifactType?: string;
  artifactStatus?: string;
  sourceObjectType?: string;
  sourceObjectId?: string;
  createdByUserId?: string;
}): Promise<SpineArtifactSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.runId) where.run_id = filters.runId;
  if (filters?.artifactType) where.artifact_type = filters.artifactType;
  if (filters?.artifactStatus) where.artifact_status = filters.artifactStatus;
  if (filters?.sourceObjectType) where.source_object_type = filters.sourceObjectType;
  if (filters?.sourceObjectId) where.source_object_id = filters.sourceObjectId;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;

  const artifacts = await prisma.spineArtifact.findMany({ where, orderBy: { created_at: 'desc' } });
  return artifacts.map(mapSpineArtifact);
}

// ============================================================
// SpineArtifactLink
// ============================================================

export async function createSpineArtifactLink(input: CreateSpineArtifactLinkInput): Promise<SpineArtifactLinkSummary> {
  const link = await prisma.spineArtifactLink.create({
    data: {
      source_artifact_id: input.sourceArtifactId,
      target_artifact_id: input.targetArtifactId,
      relationship_type: input.relationshipType,
      rationale: input.rationale,
    },
  });
  return mapSpineArtifactLink(link);
}

export async function getSpineArtifactLineage(artifactId: string): Promise<SpineArtifactLineage> {
  const artifact = await prisma.spineArtifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw new NotFoundError('SpineArtifact', artifactId);

  const sourceLinks = await prisma.spineArtifactLink.findMany({
    where: { source_artifact_id: artifactId },
    orderBy: { created_at: 'desc' },
  });

  const targetLinks = await prisma.spineArtifactLink.findMany({
    where: { target_artifact_id: artifactId },
    orderBy: { created_at: 'desc' },
  });

  return {
    artifact: mapSpineArtifact(artifact),
    sourceLinks: sourceLinks.map(mapSpineArtifactLink),
    targetLinks: targetLinks.map(mapSpineArtifactLink),
  };
}

// ============================================================
// Replay Bundle
// ============================================================

export async function getSpineRunReplayBundle(runId: string): Promise<SpineReplayBundle> {
  const run = await prisma.spineRun.findUnique({
    where: { id: runId },
    include: { child_runs: true, artifacts: true },
  });
  if (!run) throw new NotFoundError('SpineRun', runId);

  const artifacts = await prisma.spineArtifact.findMany({
    where: { run_id: runId },
    orderBy: { created_at: 'desc' },
  });

  const artifactIds = artifacts.map(a => a.id);
  const artifactLinks = artifactIds.length > 0
    ? await prisma.spineArtifactLink.findMany({
        where: {
          OR: [
            { source_artifact_id: { in: artifactIds } },
            { target_artifact_id: { in: artifactIds } },
          ],
        },
        orderBy: { created_at: 'desc' },
      })
    : [];

  return {
    run: mapSpineRun(run),
    artifacts: artifacts.map(mapSpineArtifact),
    artifactLinks: artifactLinks.map(mapSpineArtifactLink),
    saifDecisionRecordId: run.saif_decision_record_id,
    capabilityResolutionId: run.capability_resolution_id,
    approvalId: run.approval_id,
    mcpMediationRequestId: run.mcp_mediation_request_id,
    mcpMediationDecisionId: run.mcp_mediation_decision_id,
  };
}

// ============================================================
// Mappers
// ============================================================

function mapSpineRun(r: Record<string, unknown>): SpineRunSummary {
  return {
    id: r.id as string,
    runType: r.run_type as SpineRunSummary['runType'],
    runStatus: r.run_status as SpineRunSummary['runStatus'],
    humanUserId: r.human_user_id as string,
    agentRepId: r.agent_rep_id as string,
    actingAgentType: r.acting_agent_type as string,
    actingAgentId: r.acting_agent_id as string | null,
    saifDecisionRecordId: r.saif_decision_record_id as string | null,
    capabilityResolutionId: r.capability_resolution_id as string | null,
    approvalId: r.approval_id as string | null,
    mcpMediationRequestId: r.mcp_mediation_request_id as string | null,
    mcpMediationDecisionId: r.mcp_mediation_decision_id as string | null,
    parentRunId: r.parent_run_id as string | null,
    startedAt: r.started_at as Date | null,
    completedAt: r.completed_at as Date | null,
    failedAt: r.failed_at as Date | null,
    rationale: r.rationale as string | null,
    expectedOutcome: r.expected_outcome as string | null,
    actualOutcome: r.actual_outcome as string | null,
    failureReason: r.failure_reason as string | null,
    replayStatus: r.replay_status as SpineRunSummary['replayStatus'],
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
    childRuns: (r.child_runs as Record<string, unknown>[] || []).map(mapSpineRun),
    artifacts: (r.artifacts as Record<string, unknown>[] || []).map(mapSpineArtifact),
  };
}

function mapSpineArtifact(a: Record<string, unknown>): SpineArtifactSummary {
  return {
    id: a.id as string,
    artifactType: a.artifact_type as SpineArtifactSummary['artifactType'],
    artifactStatus: a.artifact_status as SpineArtifactSummary['artifactStatus'],
    canonicalOwner: a.canonical_owner as string | null,
    sourceObjectType: a.source_object_type as string | null,
    sourceObjectId: a.source_object_id as string | null,
    runId: a.run_id as string,
    saifDecisionRecordId: a.saif_decision_record_id as string | null,
    capabilityResolutionId: a.capability_resolution_id as string | null,
    approvalId: a.approval_id as string | null,
    contentHash: a.content_hash as string | null,
    version: a.version as number,
    metadata: a.metadata as Record<string, unknown> | null,
    summary: a.summary as string | null,
    createdByUserId: a.created_by_user_id as string,
    createdByAgentRepId: a.created_by_agent_rep_id as string,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

function mapSpineArtifactLink(l: Record<string, unknown>): SpineArtifactLinkSummary {
  return {
    id: l.id as string,
    sourceArtifactId: l.source_artifact_id as string,
    targetArtifactId: l.target_artifact_id as string,
    relationshipType: l.relationship_type as SpineArtifactLinkSummary['relationshipType'],
    rationale: l.rationale as string | null,
    createdAt: l.created_at as Date,
  };
}
