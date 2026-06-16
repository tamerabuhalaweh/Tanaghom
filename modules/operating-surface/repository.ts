import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type {
  CreateOperatingSurfaceInput, CreateSurfaceTaskInput, CreateStatusProjectionInput,
  CreateRelayEventInput, CreatePaperclipReferenceInput, CreateSyncPolicyInput,
  OperatingSurfaceSummary, SurfaceTaskSummary, StatusProjectionSummary,
  RelayEventSummary, PaperclipReferenceSummary, SyncPolicySummary,
} from './types';

// ============================================================
// OperatingSurface
// ============================================================

export async function createOperatingSurface(input: CreateOperatingSurfaceInput): Promise<OperatingSurfaceSummary> {
  const surface = await prisma.operatingSurface.create({
    data: {
      name: input.name,
      surface_type: input.surfaceType,
      description: input.description,
      is_external: input.isExternal,
      canonical_authority: input.canonicalAuthority,
      allowed_directions: input.allowedDirections,
    },
  });
  return mapOperatingSurface(surface);
}

export async function getOperatingSurfaceById(id: string): Promise<OperatingSurfaceSummary> {
  const surface = await prisma.operatingSurface.findUnique({ where: { id } });
  if (!surface) throw new NotFoundError('OperatingSurface', id);
  return mapOperatingSurface(surface);
}

export async function getOperatingSurfaceByName(name: string): Promise<OperatingSurfaceSummary | null> {
  const surface = await prisma.operatingSurface.findUnique({ where: { name } });
  return surface ? mapOperatingSurface(surface) : null;
}

export async function listOperatingSurfaces(filters?: { surfaceType?: string; status?: string }): Promise<OperatingSurfaceSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.surfaceType) where.surface_type = filters.surfaceType;
  if (filters?.status) where.status = filters.status;

  const surfaces = await prisma.operatingSurface.findMany({ where, orderBy: { name: 'asc' } });
  return surfaces.map(mapOperatingSurface);
}

// ============================================================
// SurfaceTask
// ============================================================

export async function createSurfaceTask(input: CreateSurfaceTaskInput): Promise<SurfaceTaskSummary> {
  // SurfaceTask cannot approve, publish, schedule, or execute
  if (input.taskType === 'approval') {
    // Approval tasks are projections only — they don't create real approvals
  }

  const task = await prisma.surfaceTask.create({
    data: {
      operating_surface_id: input.operatingSurfaceId,
      external_task_reference: input.externalTaskReference,
      title: input.title,
      description: input.description,
      task_type: input.taskType,
      canonical_target_type: input.canonicalTargetType,
      canonical_target_id: input.canonicalTargetId,
      assigned_user_id: input.assignedUserId,
      assigned_agent_rep_id: input.assignedAgentRepId,
      approval_id: input.approvalId,
      saif_decision_record_id: input.saifDecisionRecordId,
      spine_run_id: input.spineRunId,
      capability_resolution_id: input.capabilityResolutionId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapSurfaceTask(task);
}

export async function listSurfaceTasks(operatingSurfaceId: string, filters?: { taskStatus?: string }): Promise<SurfaceTaskSummary[]> {
  const where: Record<string, unknown> = { operating_surface_id: operatingSurfaceId };
  if (filters?.taskStatus) where.task_status = filters.taskStatus;

  const tasks = await prisma.surfaceTask.findMany({ where, orderBy: { created_at: 'desc' } });
  return tasks.map(mapSurfaceTask);
}

// ============================================================
// SurfaceStatusProjection
// ============================================================

export async function createStatusProjection(input: CreateStatusProjectionInput): Promise<StatusProjectionSummary> {
  // Projection is derived visibility only — cannot become source of truth
  const projection = await prisma.surfaceStatusProjection.create({
    data: {
      operating_surface_id: input.operatingSurfaceId,
      canonical_object_type: input.canonicalObjectType,
      canonical_object_id: input.canonicalObjectId,
      projected_status: input.projectedStatus,
      projected_summary: input.projectedSummary,
      source_substrate: input.sourceSubstrate,
    },
  });
  return mapStatusProjection(projection);
}

export async function listStatusProjections(operatingSurfaceId: string): Promise<StatusProjectionSummary[]> {
  const projections = await prisma.surfaceStatusProjection.findMany({
    where: { operating_surface_id: operatingSurfaceId },
    orderBy: { created_at: 'desc' },
  });
  return projections.map(mapStatusProjection);
}

// ============================================================
// SurfaceRelayEvent
// ============================================================

export async function createRelayEvent(input: CreateRelayEventInput): Promise<RelayEventSummary> {
  // Store summaries only, not raw sensitive payloads
  if (input.payloadSummary && input.payloadSummary.length > 5000) {
    throw new ForbiddenError('Payload summary too large — store summaries only, not raw payloads');
  }

  const event = await prisma.surfaceRelayEvent.create({
    data: {
      operating_surface_id: input.operatingSurfaceId,
      direction: input.direction,
      event_type: input.eventType,
      canonical_object_type: input.canonicalObjectType,
      canonical_object_id: input.canonicalObjectId,
      external_reference: input.externalReference,
      payload_summary: input.payloadSummary,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
    },
  });
  return mapRelayEvent(event);
}

export async function listRelayEvents(operatingSurfaceId: string, filters?: { direction?: string; eventStatus?: string }): Promise<RelayEventSummary[]> {
  const where: Record<string, unknown> = { operating_surface_id: operatingSurfaceId };
  if (filters?.direction) where.direction = filters.direction;
  if (filters?.eventStatus) where.event_status = filters.eventStatus;

  const events = await prisma.surfaceRelayEvent.findMany({ where, orderBy: { created_at: 'desc' } });
  return events.map(mapRelayEvent);
}

export async function updateRelayEventStatus(id: string, status: string, result?: string): Promise<RelayEventSummary> {
  const existing = await prisma.surfaceRelayEvent.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SurfaceRelayEvent', id);

  const event = await prisma.surfaceRelayEvent.update({
    where: { id },
    data: {
      event_status: status as 'received' | 'processed' | 'blocked' | 'requires_review' | 'failed',
      processed_at: new Date(),
      result,
    },
  });
  return mapRelayEvent(event);
}

// ============================================================
// PaperclipReference
// ============================================================

export async function createPaperclipReference(input: CreatePaperclipReferenceInput): Promise<PaperclipReferenceSummary> {
  // Paperclip cannot own canonical object identity
  const reference = await prisma.paperclipReference.create({
    data: {
      canonical_object_type: input.canonicalObjectType,
      canonical_object_id: input.canonicalObjectId,
      paperclip_object_type: input.paperclipObjectType,
      paperclip_reference_id: input.paperclipReferenceId,
      sync_status: input.syncStatus,
    },
  });
  return mapPaperclipReference(reference);
}

export async function listPaperclipReferences(filters?: { canonicalObjectType?: string; canonicalObjectId?: string }): Promise<PaperclipReferenceSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.canonicalObjectType) where.canonical_object_type = filters.canonicalObjectType;
  if (filters?.canonicalObjectId) where.canonical_object_id = filters.canonicalObjectId;

  const references = await prisma.paperclipReference.findMany({ where, orderBy: { created_at: 'desc' } });
  return references.map(mapPaperclipReference);
}

// ============================================================
// SurfaceSyncPolicy
// ============================================================

export async function createSyncPolicy(input: CreateSyncPolicyInput): Promise<SyncPolicySummary> {
  const policy = await prisma.surfaceSyncPolicy.create({
    data: {
      operating_surface_id: input.operatingSurfaceId,
      canonical_object_type: input.canonicalObjectType,
      direction: input.direction,
      policy_type: input.policyType,
      requires_review: input.requiresReview,
      requires_approval: input.requiresApproval,
      allowed_fields: input.allowedFields,
      blocked_fields: input.blockedFields,
    },
  });
  return mapSyncPolicy(policy);
}

export async function listSyncPolicies(operatingSurfaceId: string): Promise<SyncPolicySummary[]> {
  const policies = await prisma.surfaceSyncPolicy.findMany({
    where: { operating_surface_id: operatingSurfaceId },
    orderBy: { created_at: 'desc' },
  });
  return policies.map(mapSyncPolicy);
}

// ============================================================
// Mappers
// ============================================================

function mapOperatingSurface(s: Record<string, unknown>): OperatingSurfaceSummary {
  return {
    id: s.id as string,
    name: s.name as string,
    surfaceType: s.surface_type as OperatingSurfaceSummary['surfaceType'],
    status: s.status as OperatingSurfaceSummary['status'],
    description: s.description as string | null,
    isExternal: s.is_external as boolean,
    canonicalAuthority: s.canonical_authority as string,
    allowedDirections: s.allowed_directions as string[],
    createdAt: s.created_at as Date,
    updatedAt: s.updated_at as Date,
  };
}

function mapSurfaceTask(t: Record<string, unknown>): SurfaceTaskSummary {
  return {
    id: t.id as string,
    operatingSurfaceId: t.operating_surface_id as string,
    externalTaskReference: t.external_task_reference as string | null,
    title: t.title as string,
    description: t.description as string | null,
    taskType: t.task_type as SurfaceTaskSummary['taskType'],
    taskStatus: t.task_status as SurfaceTaskSummary['taskStatus'],
    canonicalTargetType: t.canonical_target_type as string | null,
    canonicalTargetId: t.canonical_target_id as string | null,
    assignedUserId: t.assigned_user_id as string | null,
    assignedAgentRepId: t.assigned_agent_rep_id as string | null,
    approvalId: t.approval_id as string | null,
    saifDecisionRecordId: t.saif_decision_record_id as string | null,
    spineRunId: t.spine_run_id as string | null,
    capabilityResolutionId: t.capability_resolution_id as string | null,
    createdByUserId: t.created_by_user_id as string,
    createdByAgentRepId: t.created_by_agent_rep_id as string,
    createdAt: t.created_at as Date,
    updatedAt: t.updated_at as Date,
  };
}

function mapStatusProjection(p: Record<string, unknown>): StatusProjectionSummary {
  return {
    id: p.id as string,
    operatingSurfaceId: p.operating_surface_id as string,
    canonicalObjectType: p.canonical_object_type as string,
    canonicalObjectId: p.canonical_object_id as string,
    projectedStatus: p.projected_status as string,
    projectedSummary: p.projected_summary as string | null,
    sourceSubstrate: p.source_substrate as string | null,
    lastProjectedAt: p.last_projected_at as Date,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapRelayEvent(e: Record<string, unknown>): RelayEventSummary {
  return {
    id: e.id as string,
    operatingSurfaceId: e.operating_surface_id as string,
    direction: e.direction as RelayEventSummary['direction'],
    eventType: e.event_type as string,
    eventStatus: e.event_status as RelayEventSummary['eventStatus'],
    canonicalObjectType: e.canonical_object_type as string | null,
    canonicalObjectId: e.canonical_object_id as string | null,
    externalReference: e.external_reference as string | null,
    payloadSummary: e.payload_summary as string | null,
    humanUserId: e.human_user_id as string | null,
    agentRepId: e.agent_rep_id as string | null,
    createdAt: e.created_at as Date,
    processedAt: e.processed_at as Date | null,
    result: e.result as string | null,
  };
}

function mapPaperclipReference(r: Record<string, unknown>): PaperclipReferenceSummary {
  return {
    id: r.id as string,
    canonicalObjectType: r.canonical_object_type as string,
    canonicalObjectId: r.canonical_object_id as string,
    paperclipObjectType: r.paperclip_object_type as string,
    paperclipReferenceId: r.paperclip_reference_id as string,
    syncStatus: r.sync_status as PaperclipReferenceSummary['syncStatus'],
    lastCheckedAt: r.last_checked_at as Date | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapSyncPolicy(p: Record<string, unknown>): SyncPolicySummary {
  return {
    id: p.id as string,
    operatingSurfaceId: p.operating_surface_id as string,
    canonicalObjectType: p.canonical_object_type as string,
    direction: p.direction as SyncPolicySummary['direction'],
    policyType: p.policy_type as SyncPolicySummary['policyType'],
    requiresReview: p.requires_review as boolean,
    requiresApproval: p.requires_approval as boolean,
    allowedFields: p.allowed_fields as string[],
    blockedFields: p.blocked_fields as string[],
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}
