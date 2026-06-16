import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateMcpConnectorInput, CreateMcpCapabilityBindingInput,
  CreateMcpMediationRequestInput, CreateMcpMediationDecisionInput,
  CreateMcpAccessPolicyInput,
  McpConnectorSummary, McpCapabilityBindingSummary,
  McpMediationRequestSummary, McpMediationDecisionSummary,
  McpAccessPolicySummary,
} from './types';

// ============================================================
// MCP Connector
// ============================================================

export async function createMcpConnector(input: CreateMcpConnectorInput): Promise<McpConnectorSummary> {
  const connector = await prisma.mcpConnector.create({
    data: {
      name: input.name,
      description: input.description,
      connector_type: input.connectorType,
      target_system: input.targetSystem,
      status: input.status,
      is_external: input.isExternal,
      supports_read: input.supportsRead,
      supports_write: input.supportsWrite,
      m4_allowed: input.m4Allowed,
      m5_allowed: input.m5Allowed,
      credential_required: input.credentialRequired,
      owner_substrate: input.ownerSubstrate,
    },
  });
  return mapMcpConnector(connector);
}

export async function getMcpConnectorById(id: string): Promise<McpConnectorSummary> {
  const connector = await prisma.mcpConnector.findUnique({ where: { id } });
  if (!connector) throw new NotFoundError('McpConnector', id);
  return mapMcpConnector(connector);
}

export async function getMcpConnectorByName(name: string): Promise<McpConnectorSummary | null> {
  const connector = await prisma.mcpConnector.findUnique({ where: { name } });
  return connector ? mapMcpConnector(connector) : null;
}

export async function listMcpConnectors(filters?: { status?: string; connectorType?: string }): Promise<McpConnectorSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.connectorType) where.connector_type = filters.connectorType;

  const connectors = await prisma.mcpConnector.findMany({ where, orderBy: { name: 'asc' } });
  return connectors.map(mapMcpConnector);
}

// ============================================================
// MCP Capability Binding
// ============================================================

export async function createMcpCapabilityBinding(input: CreateMcpCapabilityBindingInput): Promise<McpCapabilityBindingSummary> {
  const binding = await prisma.mcpCapabilityBinding.create({
    data: {
      capability_id: input.capabilityId,
      implementation_id: input.implementationId,
      mcp_connector_id: input.mcpConnectorId,
      allowed_operation: input.allowedOperation,
      requires_approval: input.requiresApproval,
      requires_saif_decision: input.requiresSaifDecision,
      requires_m5_authorization: input.requiresM5Authorization,
    },
  });
  return mapMcpCapabilityBinding(binding);
}

export async function listMcpCapabilityBindings(filters?: { capabilityId?: string; mcpConnectorId?: string }): Promise<McpCapabilityBindingSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.capabilityId) where.capability_id = filters.capabilityId;
  if (filters?.mcpConnectorId) where.mcp_connector_id = filters.mcpConnectorId;

  const bindings = await prisma.mcpCapabilityBinding.findMany({ where });
  return bindings.map(mapMcpCapabilityBinding);
}

// ============================================================
// MCP Mediation Request
// ============================================================

export async function createMcpMediationRequest(input: CreateMcpMediationRequestInput): Promise<McpMediationRequestSummary> {
  // Verify connector exists and is active
  const connector = await prisma.mcpConnector.findUnique({ where: { id: input.mcpConnectorId } });
  if (!connector) throw new NotFoundError('McpConnector', input.mcpConnectorId);

  // Block inactive connectors
  if (connector.status !== 'active') {
    throw new ForbiddenError(`MCP connector '${connector.name}' is ${connector.status}. Only active connectors can be used.`);
  }

  const request = await prisma.mcpMediationRequest.create({
    data: {
      capability_resolution_id: input.capabilityResolutionId,
      mcp_connector_id: input.mcpConnectorId,
      requested_operation: input.requestedOperation,
      resource_ids: input.resourceIds,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      acting_agent_type: input.actingAgentType,
      acting_agent_id: input.actingAgentId,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
    },
  });
  return mapMcpMediationRequest(request);
}

export async function getMcpMediationRequestById(id: string): Promise<McpMediationRequestSummary> {
  const request = await prisma.mcpMediationRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('McpMediationRequest', id);
  return mapMcpMediationRequest(request);
}

export async function listMcpMediationRequests(filters?: {
  mcpConnectorId?: string;
  humanUserId?: string;
  requestStatus?: string;
}): Promise<McpMediationRequestSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.mcpConnectorId) where.mcp_connector_id = filters.mcpConnectorId;
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.requestStatus) where.request_status = filters.requestStatus;

  const requests = await prisma.mcpMediationRequest.findMany({ where, orderBy: { created_at: 'desc' } });
  return requests.map(mapMcpMediationRequest);
}

// ============================================================
// MCP Mediation Decision
// ============================================================

export async function createMcpMediationDecision(input: CreateMcpMediationDecisionInput): Promise<McpMediationDecisionSummary> {
  const decision = await prisma.mcpMediationDecision.create({
    data: {
      mediation_request_id: input.mediationRequestId,
      decision: input.decision,
      rationale: input.rationale,
      policy_matched: input.policyMatched,
      decided_by_user_id: input.decidedByUserId,
      decided_by_agent_rep_id: input.decidedByAgentRepId,
    },
  });

  // Update request status based on decision
  const statusMap: Record<string, string> = {
    allow: 'approved',
    deny: 'denied',
    defer: 'deferred',
    escalate: 'escalated',
    blocked_m5: 'blocked',
    blocked_missing_approval: 'blocked',
    blocked_missing_saif: 'blocked',
    blocked_direct_access: 'blocked',
    blocked_inactive_connector: 'blocked',
    blocked_suspended_credential: 'blocked',
  };

  await prisma.mcpMediationRequest.update({
    where: { id: input.mediationRequestId },
    data: { request_status: (statusMap[input.decision] || 'pending') as 'pending' | 'approved' | 'denied' | 'deferred' | 'escalated' | 'blocked' },
  });

  return mapMcpMediationDecision(decision);
}

export async function listMcpMediationDecisions(mediationRequestId: string): Promise<McpMediationDecisionSummary[]> {
  const decisions = await prisma.mcpMediationDecision.findMany({
    where: { mediation_request_id: mediationRequestId },
    orderBy: { created_at: 'desc' },
  });
  return decisions.map(mapMcpMediationDecision);
}

// ============================================================
// MCP Access Policy
// ============================================================

export async function createMcpAccessPolicy(input: CreateMcpAccessPolicyInput): Promise<McpAccessPolicySummary> {
  const policy = await prisma.mcpAccessPolicy.create({
    data: {
      name: input.name,
      description: input.description,
      connector_type: input.connectorType,
      operation_type: input.operationType,
      allowed: input.allowed,
      requires_m4: input.requiresM4,
      requires_m5: input.requiresM5,
      requires_saif_decision: input.requiresSaifDecision,
      requires_approval: input.requiresApproval,
      conditions: input.conditions as Prisma.InputJsonValue | undefined,
    },
  });
  return mapMcpAccessPolicy(policy);
}

export async function listMcpAccessPolicies(filters?: { connectorType?: string }): Promise<McpAccessPolicySummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.connectorType) where.connector_type = filters.connectorType;

  const policies = await prisma.mcpAccessPolicy.findMany({ where, orderBy: { name: 'asc' } });
  return policies.map(mapMcpAccessPolicy);
}

// ============================================================
// Mappers
// ============================================================

function mapMcpConnector(c: Record<string, unknown>): McpConnectorSummary {
  return {
    id: c.id as string,
    name: c.name as string,
    description: c.description as string | null,
    connectorType: c.connector_type as string,
    targetSystem: c.target_system as string,
    status: c.status as McpConnectorSummary['status'],
    isExternal: c.is_external as boolean,
    supportsRead: c.supports_read as boolean,
    supportsWrite: c.supports_write as boolean,
    m4Allowed: c.m4_allowed as boolean,
    m5Allowed: c.m5_allowed as boolean,
    credentialRequired: c.credential_required as boolean,
    ownerSubstrate: c.owner_substrate as string | null,
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

function mapMcpCapabilityBinding(b: Record<string, unknown>): McpCapabilityBindingSummary {
  return {
    id: b.id as string,
    capabilityId: b.capability_id as string,
    implementationId: b.implementation_id as string | null,
    mcpConnectorId: b.mcp_connector_id as string,
    allowedOperation: b.allowed_operation as string,
    requiresApproval: b.requires_approval as boolean,
    requiresSaifDecision: b.requires_saif_decision as boolean,
    requiresM5Authorization: b.requires_m5_authorization as boolean,
    createdAt: b.created_at as Date,
    updatedAt: b.updated_at as Date,
  };
}

function mapMcpMediationRequest(r: Record<string, unknown>): McpMediationRequestSummary {
  return {
    id: r.id as string,
    capabilityResolutionId: r.capability_resolution_id as string | null,
    mcpConnectorId: r.mcp_connector_id as string,
    requestedOperation: r.requested_operation as string,
    resourceIds: r.resource_ids as string[],
    humanUserId: r.human_user_id as string,
    agentRepId: r.agent_rep_id as string,
    actingAgentType: r.acting_agent_type as string,
    actingAgentId: r.acting_agent_id as string | null,
    saifDecisionRecordId: r.saif_decision_record_id as string | null,
    approvalId: r.approval_id as string | null,
    requestStatus: r.request_status as McpMediationRequestSummary['requestStatus'],
    requestedAt: r.requested_at as Date,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapMcpMediationDecision(d: Record<string, unknown>): McpMediationDecisionSummary {
  return {
    id: d.id as string,
    mediationRequestId: d.mediation_request_id as string,
    decision: d.decision as McpMediationDecisionSummary['decision'],
    rationale: d.rationale as string | null,
    policyMatched: d.policy_matched as string | null,
    decidedByUserId: d.decided_by_user_id as string | null,
    decidedByAgentRepId: d.decided_by_agent_rep_id as string | null,
    decidedAt: d.decided_at as Date,
    createdAt: d.created_at as Date,
  };
}

function mapMcpAccessPolicy(p: Record<string, unknown>): McpAccessPolicySummary {
  return {
    id: p.id as string,
    name: p.name as string,
    description: p.description as string | null,
    connectorType: p.connector_type as string | null,
    operationType: p.operation_type as string | null,
    allowed: p.allowed as boolean,
    requiresM4: p.requires_m4 as boolean,
    requiresM5: p.requires_m5 as boolean,
    requiresSaifDecision: p.requires_saif_decision as boolean,
    requiresApproval: p.requires_approval as boolean,
    conditions: p.conditions as Record<string, unknown> | null,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}
