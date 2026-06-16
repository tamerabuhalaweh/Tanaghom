import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateSpineRunInput, UpdateSpineRunStatusInput,
  CreateSpineArtifactInput, CreateSpineArtifactLinkInput,
  SpineRunSummary, SpineArtifactSummary, SpineArtifactLinkSummary,
  SpineReplayBundle, SpineArtifactLineage,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['spine:create', 'spine:read', 'spine:update'],
  cco: ['spine:create', 'spine:read', 'spine:update'],
  department_head: ['spine:create', 'spine:read', 'spine:update'],
  specialist: ['spine:create', 'spine:read'],
  reviewer: ['spine:read'],
  viewer: ['spine:read'],
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
// SpineRun Service
// ============================================================

export async function createSpineRun(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateSpineRunInput,
): Promise<SpineRunSummary> {
  checkPermission(requesterRole, 'spine:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.humanUserId, input.agentRepId);

  const run = await repo.createSpineRun(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'spine_run_created', object_type: 'spine_run', object_id: run.id, result: 'success' },
    `SPINE run created: ${run.runType} (${run.runStatus})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    input.actingAgentType as 'functional' | 'governance' | 'human',
    input.actingAgentId || null,
    'create_spine_run',
    'spine_run',
    run.id,
    'success',
    { runType: run.runType, runStatus: run.runStatus },
  );

  return run;
}

export async function getSpineRun(requesterRole: string, id: string): Promise<SpineRunSummary> {
  checkPermission(requesterRole, 'spine:read');
  return repo.getSpineRunById(id);
}

export async function listSpineRuns(requesterRole: string, filters?: {
  humanUserId?: string;
  agentRepId?: string;
  runStatus?: string;
  runType?: string;
  parentRunId?: string;
}): Promise<SpineRunSummary[]> {
  checkPermission(requesterRole, 'spine:read');
  return repo.listSpineRuns(filters);
}

export async function updateSpineRunStatus(
  requesterRole: string,
  runId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: UpdateSpineRunStatusInput,
): Promise<SpineRunSummary> {
  checkPermission(requesterRole, 'spine:update');

  const run = await repo.updateSpineRunStatus(runId, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'spine_run_status_updated', object_type: 'spine_run', object_id: runId, result: 'success' },
    `SPINE run status updated: ${run.runStatus}`,
  );

  return run;
}

// ============================================================
// SpineArtifact Service
// ============================================================

export async function createSpineArtifact(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateSpineArtifactInput,
): Promise<SpineArtifactSummary> {
  checkPermission(requesterRole, 'spine:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  const artifact = await repo.createSpineArtifact(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'spine_artifact_created', object_type: 'spine_artifact', object_id: artifact.id, result: 'success' },
    `SPINE artifact created: ${artifact.artifactType}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_spine_artifact',
    'spine_artifact',
    artifact.id,
    'success',
    { artifactType: artifact.artifactType, runId: artifact.runId },
  );

  return artifact;
}

export async function getSpineArtifact(requesterRole: string, id: string): Promise<SpineArtifactSummary> {
  checkPermission(requesterRole, 'spine:read');
  return repo.getSpineArtifactById(id);
}

export async function listSpineArtifacts(requesterRole: string, filters?: {
  runId?: string;
  artifactType?: string;
  artifactStatus?: string;
  sourceObjectType?: string;
  sourceObjectId?: string;
  createdByUserId?: string;
}): Promise<SpineArtifactSummary[]> {
  checkPermission(requesterRole, 'spine:read');
  return repo.listSpineArtifacts(filters);
}

// ============================================================
// SpineArtifactLink Service
// ============================================================

export async function createSpineArtifactLink(
  requesterRole: string,
  input: CreateSpineArtifactLinkInput,
): Promise<SpineArtifactLinkSummary> {
  checkPermission(requesterRole, 'spine:create');
  const link = await repo.createSpineArtifactLink(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'spine_artifact_link_created', object_type: 'spine_artifact_link', object_id: link.id, result: 'success' },
    `SPINE artifact link created: ${link.relationshipType}`,
  );

  return link;
}

export async function getSpineArtifactLineage(requesterRole: string, artifactId: string): Promise<SpineArtifactLineage> {
  checkPermission(requesterRole, 'spine:read');
  return repo.getSpineArtifactLineage(artifactId);
}

// ============================================================
// Replay Bundle Service
// ============================================================

export async function getSpineRunReplayBundle(requesterRole: string, runId: string): Promise<SpineReplayBundle> {
  checkPermission(requesterRole, 'spine:read');
  return repo.getSpineRunReplayBundle(runId);
}
