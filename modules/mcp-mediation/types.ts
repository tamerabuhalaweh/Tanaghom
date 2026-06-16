import { z } from 'zod';

export const MCP_CONNECTOR_STATUSES = ['active', 'inactive', 'suspended', 'planned'] as const;
export type McpConnectorStatus = (typeof MCP_CONNECTOR_STATUSES)[number];

export const MCP_MEDIATION_REQUEST_STATUSES = ['pending', 'approved', 'denied', 'deferred', 'escalated', 'blocked'] as const;
export type McpMediationRequestStatus = (typeof MCP_MEDIATION_REQUEST_STATUSES)[number];

export const MCP_MEDIATION_DECISION_TYPES = [
  'allow', 'deny', 'defer', 'escalate',
  'blocked_m5', 'blocked_missing_approval', 'blocked_missing_saif',
  'blocked_direct_access', 'blocked_inactive_connector', 'blocked_suspended_credential'
] as const;
export type McpMediationDecisionType = (typeof MCP_MEDIATION_DECISION_TYPES)[number];

export const MCP_CREDENTIAL_STATUSES = ['active', 'inactive', 'suspended', 'placeholder'] as const;
export type McpCredentialStatus = (typeof MCP_CREDENTIAL_STATUSES)[number];

export const createMcpConnectorSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  connectorType: z.string().min(1).max(200),
  targetSystem: z.string().min(1).max(200),
  status: z.enum(MCP_CONNECTOR_STATUSES).default('planned'),
  isExternal: z.boolean().default(true),
  supportsRead: z.boolean().default(true),
  supportsWrite: z.boolean().default(false),
  m4Allowed: z.boolean().default(true),
  m5Allowed: z.boolean().default(false),
  credentialRequired: z.boolean().default(true),
  ownerSubstrate: z.string().max(200).optional(),
});

export const createMcpCapabilityBindingSchema = z.object({
  capabilityId: z.string().uuid(),
  implementationId: z.string().uuid().optional(),
  mcpConnectorId: z.string().uuid(),
  allowedOperation: z.string().default('read'),
  requiresApproval: z.boolean().default(false),
  requiresSaifDecision: z.boolean().default(false),
  requiresM5Authorization: z.boolean().default(false),
});

export const createMcpMediationRequestSchema = z.object({
  capabilityResolutionId: z.string().uuid().optional(),
  mcpConnectorId: z.string().uuid(),
  requestedOperation: z.string().min(1).max(200),
  resourceIds: z.array(z.string().uuid()).default([]),
  humanUserId: z.string().uuid(),
  agentRepId: z.string().uuid(),
  actingAgentType: z.string().min(1).max(100),
  actingAgentId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
});

export const createMcpMediationDecisionSchema = z.object({
  mediationRequestId: z.string().uuid(),
  decision: z.enum(MCP_MEDIATION_DECISION_TYPES),
  rationale: z.string().max(5000).optional(),
  policyMatched: z.string().max(200).optional(),
  decidedByUserId: z.string().uuid().optional(),
  decidedByAgentRepId: z.string().uuid().optional(),
});

export const createMcpAccessPolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  connectorType: z.string().max(200).optional(),
  operationType: z.string().max(200).optional(),
  allowed: z.boolean().default(true),
  requiresM4: z.boolean().default(true),
  requiresM5: z.boolean().default(false),
  requiresSaifDecision: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  conditions: z.record(z.unknown()).optional(),
});

export type CreateMcpConnectorInput = z.infer<typeof createMcpConnectorSchema>;
export type CreateMcpCapabilityBindingInput = z.infer<typeof createMcpCapabilityBindingSchema>;
export type CreateMcpMediationRequestInput = z.infer<typeof createMcpMediationRequestSchema>;
export type CreateMcpMediationDecisionInput = z.infer<typeof createMcpMediationDecisionSchema>;
export type CreateMcpAccessPolicyInput = z.infer<typeof createMcpAccessPolicySchema>;

export interface McpConnectorSummary {
  id: string;
  name: string;
  description: string | null;
  connectorType: string;
  targetSystem: string;
  status: McpConnectorStatus;
  isExternal: boolean;
  supportsRead: boolean;
  supportsWrite: boolean;
  m4Allowed: boolean;
  m5Allowed: boolean;
  credentialRequired: boolean;
  ownerSubstrate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpCapabilityBindingSummary {
  id: string;
  capabilityId: string;
  implementationId: string | null;
  mcpConnectorId: string;
  allowedOperation: string;
  requiresApproval: boolean;
  requiresSaifDecision: boolean;
  requiresM5Authorization: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpMediationRequestSummary {
  id: string;
  capabilityResolutionId: string | null;
  mcpConnectorId: string;
  requestedOperation: string;
  resourceIds: string[];
  humanUserId: string;
  agentRepId: string;
  actingAgentType: string;
  actingAgentId: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  requestStatus: McpMediationRequestStatus;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpMediationDecisionSummary {
  id: string;
  mediationRequestId: string;
  decision: McpMediationDecisionType;
  rationale: string | null;
  policyMatched: string | null;
  decidedByUserId: string | null;
  decidedByAgentRepId: string | null;
  decidedAt: Date;
  createdAt: Date;
}

export interface McpAccessPolicySummary {
  id: string;
  name: string;
  description: string | null;
  connectorType: string | null;
  operationType: string | null;
  allowed: boolean;
  requiresM4: boolean;
  requiresM5: boolean;
  requiresSaifDecision: boolean;
  requiresApproval: boolean;
  conditions: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
