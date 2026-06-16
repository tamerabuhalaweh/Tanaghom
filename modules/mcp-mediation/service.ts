import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateMcpConnectorInput, CreateMcpCapabilityBindingInput,
  CreateMcpMediationRequestInput, CreateMcpMediationDecisionInput,
  CreateMcpAccessPolicyInput,
  McpConnectorSummary, McpCapabilityBindingSummary,
  McpMediationRequestSummary, McpMediationDecisionSummary,
  McpAccessPolicySummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['mcp:create', 'mcp:read', 'mcp:mediate', 'mcp:decide'],
  cco: ['mcp:create', 'mcp:read', 'mcp:mediate', 'mcp:decide'],
  department_head: ['mcp:create', 'mcp:read', 'mcp:mediate'],
  specialist: ['mcp:read', 'mcp:mediate'],
  reviewer: ['mcp:read'],
  viewer: ['mcp:read'],
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

function validateAgentType(agentType: string): void {
  if (agentType === 'functional') {
    throw new ForbiddenError('FunctionalAgent cannot bypass mediation');
  }
}

// ============================================================
// MCP Connector Service
// ============================================================

export async function createMcpConnector(requesterRole: string, input: CreateMcpConnectorInput): Promise<McpConnectorSummary> {
  checkPermission(requesterRole, 'mcp:create');
  const connector = await repo.createMcpConnector(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'mcp_connector_created', object_type: 'mcp_connector', object_id: connector.id, result: 'success' },
    `MCP connector created: ${connector.name}`,
  );

  return connector;
}

export async function getMcpConnector(requesterRole: string, id: string): Promise<McpConnectorSummary> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.getMcpConnectorById(id);
}

export async function listMcpConnectors(requesterRole: string, filters?: { status?: string; connectorType?: string }): Promise<McpConnectorSummary[]> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.listMcpConnectors(filters);
}

// ============================================================
// MCP Capability Binding Service
// ============================================================

export async function createMcpCapabilityBinding(requesterRole: string, input: CreateMcpCapabilityBindingInput): Promise<McpCapabilityBindingSummary> {
  checkPermission(requesterRole, 'mcp:create');
  const binding = await repo.createMcpCapabilityBinding(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'mcp_binding_created', object_type: 'mcp_capability_binding', object_id: binding.id, result: 'success' },
    `MCP binding created: capability ${binding.capabilityId} -> connector ${binding.mcpConnectorId}`,
  );

  return binding;
}

export async function listMcpCapabilityBindings(requesterRole: string, filters?: { capabilityId?: string; mcpConnectorId?: string }): Promise<McpCapabilityBindingSummary[]> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.listMcpCapabilityBindings(filters);
}

// ============================================================
// MCP Mediation Request Service
// ============================================================

export async function createMcpMediationRequest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateMcpMediationRequestInput,
): Promise<McpMediationRequestSummary> {
  checkPermission(requesterRole, 'mcp:mediate');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.humanUserId, input.agentRepId);

  // Block direct access attempts
  if (input.actingAgentType === 'direct') {
    throw new ForbiddenError('Direct access is always blocked. Use MCP mediation.');
  }

  const request = await repo.createMcpMediationRequest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'mcp_mediation_requested', object_type: 'mcp_mediation_request', object_id: request.id, result: 'success' },
    `MCP mediation requested: ${request.requestedOperation} on connector ${request.mcpConnectorId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    input.actingAgentType as 'functional' | 'governance' | 'human',
    input.actingAgentId || null,
    'request_mcp_mediation',
    'mcp_mediation_request',
    request.id,
    'success',
    { connectorId: request.mcpConnectorId, operation: request.requestedOperation },
  );

  return request;
}

export async function getMcpMediationRequest(requesterRole: string, id: string): Promise<McpMediationRequestSummary> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.getMcpMediationRequestById(id);
}

export async function listMcpMediationRequests(requesterRole: string, filters?: {
  mcpConnectorId?: string;
  humanUserId?: string;
  requestStatus?: string;
}): Promise<McpMediationRequestSummary[]> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.listMcpMediationRequests(filters);
}

// ============================================================
// MCP Mediation Decision Service
// ============================================================

export async function createMcpMediationDecision(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: CreateMcpMediationDecisionInput,
): Promise<McpMediationDecisionSummary> {
  checkPermission(requesterRole, 'mcp:decide');
  validateAgentType(sessionAgentType);

  // Get the mediation request
  const request = await repo.getMcpMediationRequestById(input.mediationRequestId);

  // Get the connector
  const connector = await repo.getMcpConnectorById(request.mcpConnectorId);

  // Block M5 write-enabled operations
  if (!connector.m5Allowed && request.requestedOperation === 'write') {
    throw new ForbiddenError('M5 write-enabled operations are blocked');
  }

  // Block direct access
  if (request.actingAgentType === 'direct') {
    throw new ForbiddenError('Direct access is always blocked');
  }

  const decision = await repo.createMcpMediationDecision(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'mcp_mediation_decided', object_type: 'mcp_mediation_decision', object_id: decision.id, result: 'success' },
    `MCP mediation decided: ${decision.decision} for request ${input.mediationRequestId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    sessionAgentType as 'functional' | 'governance' | 'human',
    null,
    'decide_mcp_mediation',
    'mcp_mediation_decision',
    decision.id,
    'success',
    { decision: decision.decision, rationale: decision.rationale },
  );

  return decision;
}

export async function listMcpMediationDecisions(requesterRole: string, mediationRequestId: string): Promise<McpMediationDecisionSummary[]> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.listMcpMediationDecisions(mediationRequestId);
}

// ============================================================
// MCP Access Policy Service
// ============================================================

export async function createMcpAccessPolicy(requesterRole: string, input: CreateMcpAccessPolicyInput): Promise<McpAccessPolicySummary> {
  checkPermission(requesterRole, 'mcp:create');
  const policy = await repo.createMcpAccessPolicy(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'mcp_policy_created', object_type: 'mcp_access_policy', object_id: policy.id, result: 'success' },
    `MCP policy created: ${policy.name}`,
  );

  return policy;
}

export async function listMcpAccessPolicies(requesterRole: string, filters?: { connectorType?: string }): Promise<McpAccessPolicySummary[]> {
  checkPermission(requesterRole, 'mcp:read');
  return repo.listMcpAccessPolicies(filters);
}
