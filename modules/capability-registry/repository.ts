import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateIntentInput, CreateObjectiveInput, CreateCapabilityInput,
  CreateExecutionPatternInput, CreateResourceInput, CreateImplementationInput,
  ResolveCapabilityInput,
  IntentSummary, ObjectiveSummary, CapabilitySummary, ExecutionPatternSummary,
  ResourceSummary, ImplementationSummary, CapabilityResolutionSummary,
} from './types';

// ============================================================
// Intent
// ============================================================

export async function createIntent(input: CreateIntentInput): Promise<IntentSummary> {
  const intent = await prisma.intent.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      source_type: input.sourceType,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapIntent(intent);
}

export async function getIntentById(id: string): Promise<IntentSummary> {
  const intent = await prisma.intent.findUnique({ where: { id } });
  if (!intent) throw new NotFoundError('Intent', id);
  return mapIntent(intent);
}

export async function listIntents(filters?: { status?: string; createdByUserId?: string }): Promise<IntentSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;

  const intents = await prisma.intent.findMany({ where, orderBy: { created_at: 'desc' } });
  return intents.map(mapIntent);
}

// ============================================================
// Objective
// ============================================================

export async function createObjective(input: CreateObjectiveInput): Promise<ObjectiveSummary> {
  const objective = await prisma.objective.create({
    data: {
      intent_id: input.intentId,
      name: input.name,
      description: input.description,
      success_criteria: input.successCriteria,
      constraints: input.constraints,
      priority: input.priority,
    },
  });
  return mapObjective(objective);
}

export async function getObjectiveById(id: string): Promise<ObjectiveSummary> {
  const objective = await prisma.objective.findUnique({ where: { id } });
  if (!objective) throw new NotFoundError('Objective', id);
  return mapObjective(objective);
}

export async function listObjectivesByIntent(intentId: string): Promise<ObjectiveSummary[]> {
  const objectives = await prisma.objective.findMany({
    where: { intent_id: intentId },
    orderBy: { priority: 'desc' },
  });
  return objectives.map(mapObjective);
}

// ============================================================
// Capability
// ============================================================

export async function createCapability(input: CreateCapabilityInput): Promise<CapabilitySummary> {
  const capability = await prisma.capability.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      owner_substrate: input.ownerSubstrate,
      risk_level: input.riskLevel,
      requires_approval: input.requiresApproval,
      requires_saif_decision: input.requiresSaifDecision,
      allowed_agent_types: input.allowedAgentTypes,
    },
  });
  return mapCapability(capability);
}

export async function getCapabilityById(id: string): Promise<CapabilitySummary> {
  const capability = await prisma.capability.findUnique({ where: { id } });
  if (!capability) throw new NotFoundError('Capability', id);
  return mapCapability(capability);
}

export async function getCapabilityByName(name: string): Promise<CapabilitySummary | null> {
  const capability = await prisma.capability.findUnique({ where: { name } });
  return capability ? mapCapability(capability) : null;
}

export async function listCapabilities(filters?: { category?: string; riskLevel?: string }): Promise<CapabilitySummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.category) where.category = filters.category;
  if (filters?.riskLevel) where.risk_level = filters.riskLevel;

  const capabilities = await prisma.capability.findMany({ where, orderBy: { name: 'asc' } });
  return capabilities.map(mapCapability);
}

// ============================================================
// ExecutionPattern
// ============================================================

export async function createExecutionPattern(input: CreateExecutionPatternInput): Promise<ExecutionPatternSummary> {
  const pattern = await prisma.executionPattern.create({
    data: {
      capability_id: input.capabilityId,
      name: input.name,
      description: input.description,
      ordered_steps: input.orderedSteps as Prisma.InputJsonValue,
      required_inputs: input.requiredInputs,
      expected_outputs: input.expectedOutputs,
      boundary_rules: input.boundaryRules as Prisma.InputJsonValue | undefined,
      m4_allowed: input.m4Allowed,
      m5_required: input.m5Required,
    },
  });
  return mapExecutionPattern(pattern);
}

export async function getExecutionPatternById(id: string): Promise<ExecutionPatternSummary> {
  const pattern = await prisma.executionPattern.findUnique({ where: { id } });
  if (!pattern) throw new NotFoundError('ExecutionPattern', id);
  return mapExecutionPattern(pattern);
}

export async function listExecutionPatternsByCapability(capabilityId: string): Promise<ExecutionPatternSummary[]> {
  const patterns = await prisma.executionPattern.findMany({
    where: { capability_id: capabilityId },
    orderBy: { name: 'asc' },
  });
  return patterns.map(mapExecutionPattern);
}

// ============================================================
// Resource
// ============================================================

export async function createResource(input: CreateResourceInput): Promise<ResourceSummary> {
  const resource = await prisma.resource.create({
    data: {
      name: input.name,
      resource_type: input.resourceType,
      canonical_owner: input.canonicalOwner,
      external_reference: input.externalReference,
      sensitivity: input.sensitivity,
      access_rules: input.accessRules as Prisma.InputJsonValue | undefined,
    },
  });
  return mapResource(resource);
}

export async function getResourceById(id: string): Promise<ResourceSummary> {
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) throw new NotFoundError('Resource', id);
  return mapResource(resource);
}

export async function listResources(filters?: { resourceType?: string }): Promise<ResourceSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.resourceType) where.resource_type = filters.resourceType;

  const resources = await prisma.resource.findMany({ where, orderBy: { name: 'asc' } });
  return resources.map(mapResource);
}

// ============================================================
// Implementation
// ============================================================

export async function createImplementation(input: CreateImplementationInput): Promise<ImplementationSummary> {
  const implementation = await prisma.implementation.create({
    data: {
      capability_id: input.capabilityId,
      name: input.name,
      implementation_type: input.implementationType,
      provider: input.provider,
      is_external: input.isExternal,
      requires_mcp: input.requiresMcp,
      m4_allowed: input.m4Allowed,
      m5_allowed: input.m5Allowed,
    },
  });
  return mapImplementation(implementation);
}

export async function getImplementationById(id: string): Promise<ImplementationSummary> {
  const implementation = await prisma.implementation.findUnique({ where: { id } });
  if (!implementation) throw new NotFoundError('Implementation', id);
  return mapImplementation(implementation);
}

export async function listImplementationsByCapability(capabilityId: string): Promise<ImplementationSummary[]> {
  const implementations = await prisma.implementation.findMany({
    where: { capability_id: capabilityId },
    orderBy: { name: 'asc' },
  });
  return implementations.map(mapImplementation);
}

// ============================================================
// CapabilityResolution
// ============================================================

export async function resolveCapability(input: ResolveCapabilityInput): Promise<CapabilityResolutionSummary> {
  // Validate capability exists
  const capability = await prisma.capability.findUnique({ where: { id: input.capabilityId } });
  if (!capability) throw new NotFoundError('Capability', input.capabilityId);

  // Validate execution pattern belongs to capability
  const pattern = await prisma.executionPattern.findUnique({ where: { id: input.executionPatternId } });
  if (!pattern || pattern.capability_id !== input.capabilityId) {
    throw new ForbiddenError('ExecutionPattern does not belong to the specified Capability');
  }

  // Validate implementation belongs to capability
  const implementation = await prisma.implementation.findUnique({ where: { id: input.implementationId } });
  if (!implementation || implementation.capability_id !== input.capabilityId) {
    throw new ForbiddenError('Implementation does not belong to the specified Capability');
  }

  // Validate required resources are available for this implementation
  const implementationResources = await prisma.implementationResource.findMany({
    where: { implementation_id: input.implementationId },
    include: { resource: true },
  });

  // Check all required resources are accessible
  for (const ir of implementationResources) {
    if (!ir.resource) {
      throw new ForbiddenError(`Required resource not found for implementation '${implementation.name}'`);
    }
  }

  // Block M5 implementations
  if (implementation.m5_allowed && !implementation.m4_allowed) {
    throw new ForbiddenError('M5 write-enabled implementations are blocked in this sprint');
  }

  // Block MCP-required implementations from direct execution
  if (implementation.requires_mcp) {
    throw new ForbiddenError('MCP-required implementations cannot be directly executed');
  }

  // Require SAIF decision if capability requires it
  if (capability.requires_saif_decision && !input.saifDecisionRecordId) {
    throw new ForbiddenError('This capability requires a SAIF Decision Record');
  }

  // Require approval if capability requires it
  if (capability.requires_approval) {
    // Approval check would be done here - for now just validate the field exists
  }

  const resolution = await prisma.capabilityResolution.create({
    data: {
      intent_id: input.intentId,
      objective_id: input.objectiveId,
      capability_id: input.capabilityId,
      execution_pattern_id: input.executionPatternId,
      implementation_id: input.implementationId,
      saif_decision_record_id: input.saifDecisionRecordId,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      resolution_status: 'resolved',
      rationale: input.rationale,
      constraints_applied: input.constraintsApplied as Prisma.InputJsonValue | undefined,
      rejected_alternatives: input.rejectedAlternatives as Prisma.InputJsonValue | undefined,
    },
  });
  return mapCapabilityResolution(resolution);
}

export async function getResolutionById(id: string): Promise<CapabilityResolutionSummary> {
  const resolution = await prisma.capabilityResolution.findUnique({ where: { id } });
  if (!resolution) throw new NotFoundError('CapabilityResolution', id);
  return mapCapabilityResolution(resolution);
}

export async function listResolutions(filters?: {
  intentId?: string;
  capabilityId?: string;
  humanUserId?: string;
  resolutionStatus?: string;
}): Promise<CapabilityResolutionSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.intentId) where.intent_id = filters.intentId;
  if (filters?.capabilityId) where.capability_id = filters.capabilityId;
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.resolutionStatus) where.resolution_status = filters.resolutionStatus;

  const resolutions = await prisma.capabilityResolution.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return resolutions.map(mapCapabilityResolution);
}

// ============================================================
// Mappers
// ============================================================

function mapIntent(i: Record<string, unknown>): IntentSummary {
  return {
    id: i.id as string,
    name: i.name as string,
    description: i.description as string | null,
    category: i.category as string | null,
    sourceType: i.source_type as string | null,
    createdByUserId: i.created_by_user_id as string,
    createdByAgentRepId: i.created_by_agent_rep_id as string,
    status: i.status as IntentSummary['status'],
    createdAt: i.created_at as Date,
    updatedAt: i.updated_at as Date,
  };
}

function mapObjective(o: Record<string, unknown>): ObjectiveSummary {
  return {
    id: o.id as string,
    intentId: o.intent_id as string,
    name: o.name as string,
    description: o.description as string | null,
    successCriteria: o.success_criteria as string | null,
    constraints: o.constraints as string | null,
    priority: o.priority as number,
    status: o.status as ObjectiveSummary['status'],
    createdAt: o.created_at as Date,
    updatedAt: o.updated_at as Date,
  };
}

function mapCapability(c: Record<string, unknown>): CapabilitySummary {
  return {
    id: c.id as string,
    name: c.name as string,
    description: c.description as string | null,
    category: c.category as string | null,
    ownerSubstrate: c.owner_substrate as string | null,
    riskLevel: c.risk_level as CapabilitySummary['riskLevel'],
    requiresApproval: c.requires_approval as boolean,
    requiresSaifDecision: c.requires_saif_decision as boolean,
    allowedAgentTypes: c.allowed_agent_types as string[],
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

function mapExecutionPattern(ep: Record<string, unknown>): ExecutionPatternSummary {
  return {
    id: ep.id as string,
    capabilityId: ep.capability_id as string,
    name: ep.name as string,
    description: ep.description as string | null,
    orderedSteps: ep.ordered_steps as Record<string, unknown>,
    requiredInputs: ep.required_inputs as string[],
    expectedOutputs: ep.expected_outputs as string[],
    boundaryRules: ep.boundary_rules as Record<string, unknown> | null,
    m4Allowed: ep.m4_allowed as boolean,
    m5Required: ep.m5_required as boolean,
    createdAt: ep.created_at as Date,
    updatedAt: ep.updated_at as Date,
  };
}

function mapResource(r: Record<string, unknown>): ResourceSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    resourceType: r.resource_type as string,
    canonicalOwner: r.canonical_owner as string | null,
    externalReference: r.external_reference as string | null,
    sensitivity: r.sensitivity as string | null,
    accessRules: r.access_rules as Record<string, unknown> | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapImplementation(impl: Record<string, unknown>): ImplementationSummary {
  return {
    id: impl.id as string,
    capabilityId: impl.capability_id as string,
    name: impl.name as string,
    implementationType: impl.implementation_type as string,
    provider: impl.provider as string | null,
    isExternal: impl.is_external as boolean,
    requiresMcp: impl.requires_mcp as boolean,
    m4Allowed: impl.m4_allowed as boolean,
    m5Allowed: impl.m5_allowed as boolean,
    status: impl.status as string,
    createdAt: impl.created_at as Date,
    updatedAt: impl.updated_at as Date,
  };
}

function mapCapabilityResolution(cr: Record<string, unknown>): CapabilityResolutionSummary {
  return {
    id: cr.id as string,
    intentId: cr.intent_id as string,
    objectiveId: cr.objective_id as string,
    capabilityId: cr.capability_id as string,
    executionPatternId: cr.execution_pattern_id as string,
    implementationId: cr.implementation_id as string,
    saifDecisionRecordId: cr.saif_decision_record_id as string | null,
    humanUserId: cr.human_user_id as string,
    agentRepId: cr.agent_rep_id as string,
    resolutionStatus: cr.resolution_status as CapabilityResolutionSummary['resolutionStatus'],
    rationale: cr.rationale as string | null,
    constraintsApplied: cr.constraints_applied as Record<string, unknown> | null,
    rejectedAlternatives: cr.rejected_alternatives as Record<string, unknown> | null,
    createdAt: cr.created_at as Date,
    updatedAt: cr.updated_at as Date,
  };
}
