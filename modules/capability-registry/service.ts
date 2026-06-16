import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateIntentInput, CreateObjectiveInput, CreateCapabilityInput,
  CreateExecutionPatternInput, CreateResourceInput, CreateImplementationInput,
  ResolveCapabilityInput,
  IntentSummary, ObjectiveSummary, CapabilitySummary, ExecutionPatternSummary,
  ResourceSummary, ImplementationSummary, CapabilityResolutionSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['registry:create', 'registry:read', 'registry:resolve'],
  cco: ['registry:create', 'registry:read', 'registry:resolve'],
  department_head: ['registry:create', 'registry:read', 'registry:resolve'],
  specialist: ['registry:create', 'registry:read', 'registry:resolve'],
  reviewer: ['registry:read'],
  viewer: ['registry:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

// ============================================================
// Intent Service
// ============================================================

export async function createIntent(requesterRole: string, input: CreateIntentInput): Promise<IntentSummary> {
  checkPermission(requesterRole, 'registry:create');
  const intent = await repo.createIntent(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'intent_created', object_type: 'intent', object_id: intent.id, result: 'success' },
    `Intent created: ${intent.name}`,
  );

  createIdentityLineage(
    input.createdByUserId,
    input.createdByAgentRepId,
    'human',
    null,
    'create_intent',
    'intent',
    intent.id,
    'success',
    { name: intent.name, category: intent.category },
  );

  return intent;
}

export async function getIntent(requesterRole: string, id: string): Promise<IntentSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getIntentById(id);
}

export async function listIntents(requesterRole: string, filters?: { status?: string; createdByUserId?: string }): Promise<IntentSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listIntents(filters);
}

// ============================================================
// Objective Service
// ============================================================

export async function createObjective(requesterRole: string, input: CreateObjectiveInput): Promise<ObjectiveSummary> {
  checkPermission(requesterRole, 'registry:create');
  const objective = await repo.createObjective(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'objective_created', object_type: 'objective', object_id: objective.id, result: 'success' },
    `Objective created: ${objective.name}`,
  );

  return objective;
}

export async function getObjective(requesterRole: string, id: string): Promise<ObjectiveSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getObjectiveById(id);
}

export async function listObjectivesByIntent(requesterRole: string, intentId: string): Promise<ObjectiveSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listObjectivesByIntent(intentId);
}

// ============================================================
// Capability Service
// ============================================================

export async function createCapability(requesterRole: string, input: CreateCapabilityInput): Promise<CapabilitySummary> {
  checkPermission(requesterRole, 'registry:create');
  const capability = await repo.createCapability(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'capability_created', object_type: 'capability', object_id: capability.id, result: 'success' },
    `Capability created: ${capability.name}`,
  );

  return capability;
}

export async function getCapability(requesterRole: string, id: string): Promise<CapabilitySummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getCapabilityById(id);
}

export async function listCapabilities(requesterRole: string, filters?: { category?: string; riskLevel?: string }): Promise<CapabilitySummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listCapabilities(filters);
}

// ============================================================
// ExecutionPattern Service
// ============================================================

export async function createExecutionPattern(requesterRole: string, input: CreateExecutionPatternInput): Promise<ExecutionPatternSummary> {
  checkPermission(requesterRole, 'registry:create');
  const pattern = await repo.createExecutionPattern(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'execution_pattern_created', object_type: 'execution_pattern', object_id: pattern.id, result: 'success' },
    `ExecutionPattern created: ${pattern.name}`,
  );

  return pattern;
}

export async function getExecutionPattern(requesterRole: string, id: string): Promise<ExecutionPatternSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getExecutionPatternById(id);
}

export async function listExecutionPatternsByCapability(requesterRole: string, capabilityId: string): Promise<ExecutionPatternSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listExecutionPatternsByCapability(capabilityId);
}

// ============================================================
// Resource Service
// ============================================================

export async function createResource(requesterRole: string, input: CreateResourceInput): Promise<ResourceSummary> {
  checkPermission(requesterRole, 'registry:create');
  const resource = await repo.createResource(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'resource_created', object_type: 'resource', object_id: resource.id, result: 'success' },
    `Resource created: ${resource.name}`,
  );

  return resource;
}

export async function getResource(requesterRole: string, id: string): Promise<ResourceSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getResourceById(id);
}

export async function listResources(requesterRole: string, filters?: { resourceType?: string }): Promise<ResourceSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listResources(filters);
}

// ============================================================
// Implementation Service
// ============================================================

export async function createImplementation(requesterRole: string, input: CreateImplementationInput): Promise<ImplementationSummary> {
  checkPermission(requesterRole, 'registry:create');
  const implementation = await repo.createImplementation(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'implementation_created', object_type: 'implementation', object_id: implementation.id, result: 'success' },
    `Implementation created: ${implementation.name}`,
  );

  return implementation;
}

export async function getImplementation(requesterRole: string, id: string): Promise<ImplementationSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getImplementationById(id);
}

export async function listImplementationsByCapability(requesterRole: string, capabilityId: string): Promise<ImplementationSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listImplementationsByCapability(capabilityId);
}

// ============================================================
// CapabilityResolution Service
// ============================================================

export async function resolveCapability(requesterRole: string, input: ResolveCapabilityInput): Promise<CapabilityResolutionSummary> {
  checkPermission(requesterRole, 'registry:resolve');

  const resolution = await repo.resolveCapability(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'capability_resolved', object_type: 'capability_resolution', object_id: resolution.id, result: 'success' },
    `Capability resolved: ${resolution.capabilityId}`,
  );

  createIdentityLineage(
    input.humanUserId,
    input.agentRepId,
    'human',
    null,
    'resolve_capability',
    'capability_resolution',
    resolution.id,
    'success',
    { capabilityId: resolution.capabilityId, status: resolution.resolutionStatus },
  );

  return resolution;
}

export async function getResolution(requesterRole: string, id: string): Promise<CapabilityResolutionSummary> {
  checkPermission(requesterRole, 'registry:read');
  return repo.getResolutionById(id);
}

export async function listResolutions(requesterRole: string, filters?: {
  intentId?: string;
  capabilityId?: string;
  humanUserId?: string;
  resolutionStatus?: string;
}): Promise<CapabilityResolutionSummary[]> {
  checkPermission(requesterRole, 'registry:read');
  return repo.listResolutions(filters);
}
