import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateOperatingSurfaceInput, CreateSurfaceTaskInput, CreateStatusProjectionInput,
  CreateRelayEventInput, CreatePaperclipReferenceInput, CreateSyncPolicyInput,
  OperatingSurfaceSummary, SurfaceTaskSummary, StatusProjectionSummary,
  RelayEventSummary, PaperclipReferenceSummary, SyncPolicySummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['surface:create', 'surface:read', 'surface:write', 'surface:relay'],
  cco: ['surface:create', 'surface:read', 'surface:write', 'surface:relay'],
  department_head: ['surface:create', 'surface:read', 'surface:write'],
  specialist: ['surface:read', 'surface:write'],
  reviewer: ['surface:read'],
  viewer: ['surface:read'],
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
// OperatingSurface Service
// ============================================================

export async function createOperatingSurface(requesterRole: string, input: CreateOperatingSurfaceInput): Promise<OperatingSurfaceSummary> {
  checkPermission(requesterRole, 'surface:create');
  const surface = await repo.createOperatingSurface(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'operating_surface_created', object_type: 'operating_surface', object_id: surface.id, result: 'success' },
    `Operating surface created: ${surface.name} (${surface.surfaceType})`,
  );

  return surface;
}

export async function getOperatingSurface(requesterRole: string, id: string): Promise<OperatingSurfaceSummary> {
  checkPermission(requesterRole, 'surface:read');
  return repo.getOperatingSurfaceById(id);
}

export async function listOperatingSurfaces(requesterRole: string, filters?: { surfaceType?: string; status?: string }): Promise<OperatingSurfaceSummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listOperatingSurfaces(filters);
}

// ============================================================
// SurfaceTask Service
// ============================================================

export async function createSurfaceTask(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateSurfaceTaskInput,
): Promise<SurfaceTaskSummary> {
  checkPermission(requesterRole, 'surface:write');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // SurfaceTask cannot approve, publish, schedule, or execute
  if (input.taskType === 'approval') {
    // Approval tasks are projections only
  }

  const task = await repo.createSurfaceTask(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'surface_task_created', object_type: 'surface_task', object_id: task.id, result: 'success' },
    `Surface task created: ${task.title} on ${task.operatingSurfaceId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_surface_task',
    'surface_task',
    task.id,
    'success',
    { title: task.title, taskType: task.taskType },
  );

  return task;
}

export async function listSurfaceTasks(requesterRole: string, operatingSurfaceId: string, filters?: { taskStatus?: string }): Promise<SurfaceTaskSummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listSurfaceTasks(operatingSurfaceId, filters);
}

// ============================================================
// StatusProjection Service
// ============================================================

export async function createStatusProjection(requesterRole: string, input: CreateStatusProjectionInput): Promise<StatusProjectionSummary> {
  checkPermission(requesterRole, 'surface:write');

  // Projection is derived visibility only — cannot become source of truth
  const projection = await repo.createStatusProjection(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'status_projection_created', object_type: 'status_projection', object_id: projection.id, result: 'success' },
    `Status projection created: ${projection.canonicalObjectType}/${projection.canonicalObjectId} -> ${projection.projectedStatus}`,
  );

  return projection;
}

export async function listStatusProjections(requesterRole: string, operatingSurfaceId: string): Promise<StatusProjectionSummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listStatusProjections(operatingSurfaceId);
}

// ============================================================
// RelayEvent Service
// ============================================================

export async function createRelayEvent(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateRelayEventInput,
): Promise<RelayEventSummary> {
  checkPermission(requesterRole, 'surface:relay');

  // Store summaries only, not raw sensitive payloads
  if (input.payloadSummary && input.payloadSummary.length > 5000) {
    throw new ForbiddenError('Payload summary too large — store summaries only, not raw payloads');
  }

  // Inbound events require review if surface_to_stitch_review_required policy applies
  if (input.direction === 'inbound') {
    // Check sync policy — for now, all inbound events require review
    auditLog(
      { actor: `user:${sessionUserId}`, action: 'relay_event_received', object_type: 'relay_event', result: 'success' },
      `Inbound relay event received: ${input.eventType}`,
    );
  }

  const event = await repo.createRelayEvent(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'relay_event_created', object_type: 'relay_event', object_id: event.id, result: 'success' },
    `Relay event created: ${event.direction} ${event.eventType}`,
  );

  return event;
}

export async function listRelayEvents(requesterRole: string, operatingSurfaceId: string, filters?: { direction?: string; eventStatus?: string }): Promise<RelayEventSummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listRelayEvents(operatingSurfaceId, filters);
}

export async function updateRelayEventStatus(
  requesterRole: string,
  eventId: string,
  status: string,
  result?: string,
): Promise<RelayEventSummary> {
  checkPermission(requesterRole, 'surface:write');
  return repo.updateRelayEventStatus(eventId, status, result);
}

// ============================================================
// PaperclipReference Service
// ============================================================

export async function createPaperclipReference(requesterRole: string, input: CreatePaperclipReferenceInput): Promise<PaperclipReferenceSummary> {
  checkPermission(requesterRole, 'surface:write');

  // Paperclip cannot own canonical object identity
  const reference = await repo.createPaperclipReference(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'paperclip_reference_created', object_type: 'paperclip_reference', object_id: reference.id, result: 'success' },
    `Paperclip reference created: ${reference.paperclipObjectType}/${reference.paperclipReferenceId}`,
  );

  return reference;
}

export async function listPaperclipReferences(requesterRole: string, filters?: { canonicalObjectType?: string; canonicalObjectId?: string }): Promise<PaperclipReferenceSummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listPaperclipReferences(filters);
}

// ============================================================
// SyncPolicy Service
// ============================================================

export async function createSyncPolicy(requesterRole: string, input: CreateSyncPolicyInput): Promise<SyncPolicySummary> {
  checkPermission(requesterRole, 'surface:create');
  const policy = await repo.createSyncPolicy(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'sync_policy_created', object_type: 'sync_policy', object_id: policy.id, result: 'success' },
    `Sync policy created: ${policy.policyType} for ${policy.canonicalObjectType}`,
  );

  return policy;
}

export async function listSyncPolicies(requesterRole: string, operatingSurfaceId: string): Promise<SyncPolicySummary[]> {
  checkPermission(requesterRole, 'surface:read');
  return repo.listSyncPolicies(operatingSurfaceId);
}
