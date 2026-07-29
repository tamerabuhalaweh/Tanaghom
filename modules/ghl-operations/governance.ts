import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@shared/errors';
import type { GhlOperationType } from './types';

type Tx = Prisma.TransactionClient;

const CAPABILITY_NAME = 'ExecuteGovernedGhlCommercialOperation';
const PATTERN_NAME = 'Human-Approved Idempotent GHL Operation';
const IMPLEMENTATION_NAME = 'Tanaghum GHL Commercial Operations Adapter';
const CONNECTOR_NAME = 'gohighlevel_commercial_operations';

export async function createOperationApproval(input: {
  tx: Tx;
  tenantKey: string;
  operationId: string;
  operationType: GhlOperationType;
  requesterUserId: string;
  requesterAgentRepId: string;
  expiresAt: Date;
}) {
  const existing = await input.tx.approval.findFirst({
    where: {
      tenant_key: input.tenantKey,
      target_type: 'external_operation',
      target_id: input.operationId,
      approval_status: 'pending',
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('This GHL operation already has an active approval request');
  }
  return input.tx.approval.create({
    data: {
      tenant_key: input.tenantKey,
      target_type: 'external_operation',
      target_id: input.operationId,
      requester_user_id: input.requesterUserId,
      requester_agent_rep_id: input.requesterAgentRepId,
      approval_type: 'revenue_operations_review',
      approval_status: 'pending',
      risk_category: input.operationType === 'whatsapp_send' ? 'high' : 'medium',
      required_department: 'Commercial',
      required_role: 'cco_or_delegated_authority',
      comment: `Review governed GoHighLevel operation: ${input.operationType}`,
      expires_at: input.expiresAt,
    },
  });
}

export async function approveOperationGovernance(input: {
  tx: Tx;
  tenantKey: string;
  operationId: string;
  operationType: GhlOperationType;
  approvalId: string;
  requesterUserId: string;
  requesterAgentRepId: string;
  approverUserId: string;
  approverAgentRepId: string;
  notes: string;
}): Promise<{
  approvalId: string;
  capabilityResolutionId: string;
  mcpMediationRequestId: string;
  mcpMediationDecisionId: string;
}> {
  const tx = input.tx;
  const approval = await tx.approval.findFirst({
    where: {
      id: input.approvalId,
      tenant_key: input.tenantKey,
      target_id: input.operationId,
      target_type: 'external_operation',
    },
  });
  if (!approval) throw new NotFoundError('GHL operation approval', input.approvalId);
  const approvalResult = await tx.approval.updateMany({
    where: { id: approval.id, approval_status: 'pending' },
    data: {
      approval_status: 'approved',
      decision: 'approved',
      rationale: input.notes,
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      decided_at: new Date(),
    },
  });
  if (approvalResult.count !== 1) {
    throw new ConflictError('GHL operation approval was already decided');
  }

  const capability = await ensureCapability(tx);
  const [pattern, implementation, connector] = await Promise.all([
    ensurePattern(tx, capability.id),
    ensureImplementation(tx, capability.id),
    ensureConnector(tx),
  ]);
  await ensureBinding(tx, capability.id, implementation.id, connector.id);

  const intent = await tx.intent.create({
    data: {
      name: `Execute ${input.operationType} in GoHighLevel`,
      description: 'Perform one approved commercial CRM action and reconcile the provider outcome.',
      category: 'commercial_crm',
      source_type: 'ghl_operation_command',
      created_by_user_id: input.requesterUserId,
      created_by_agent_rep_id: input.requesterAgentRepId,
    },
  });
  const objective = await tx.objective.create({
    data: {
      intent_id: intent.id,
      name: 'Execute exactly once and retain provider confirmation',
      description:
        'Use the tenant-owned GHL credential, approved business data and operation idempotency key.',
      success_criteria:
        'Provider accepts the operation and Tanaghum records a webhook or read-back confirmation.',
      constraints:
        'Human approval, tenant isolation, capability resolution, MCP mediation and all runtime kill switches are mandatory.',
      priority: 100,
    },
  });
  const resolution = await tx.capabilityResolution.create({
    data: {
      intent_id: intent.id,
      objective_id: objective.id,
      capability_id: capability.id,
      execution_pattern_id: pattern.id,
      implementation_id: implementation.id,
      human_user_id: input.requesterUserId,
      agent_rep_id: input.requesterAgentRepId,
      resolution_status: 'resolved',
      rationale:
        'The approved GHL operation is resolved to the governed Tanaghum adapter; direct browser access is not allowed.',
      constraints_applied: {
        operationId: input.operationId,
        operationType: input.operationType,
        approvalId: input.approvalId,
        tenantOwnedCredentialRequired: true,
        exactlyOnceLedgerRequired: true,
        reconciliationRequired: true,
      },
      rejected_alternatives: {
        directBrowserWrite: 'Rejected because credentials and governance must remain server-side.',
        unapprovedWrite: 'Rejected because external CRM mutations require human approval.',
      },
    },
  });
  const mediation = await tx.mcpMediationRequest.create({
    data: {
      capability_resolution_id: resolution.id,
      mcp_connector_id: connector.id,
      requested_operation: input.operationType,
      resource_ids: [input.operationId],
      human_user_id: input.requesterUserId,
      agent_rep_id: input.requesterAgentRepId,
      acting_agent_type: 'human_or_stitchi',
      approval_id: input.approvalId,
      request_status: 'approved',
    },
  });
  const mediationDecision = await tx.mcpMediationDecision.create({
    data: {
      mediation_request_id: mediation.id,
      decision: 'allow',
      rationale:
        'Allow this single approved operation through the server-side GHL adapter. Runtime kill switches still apply.',
      policy_matched: 'approved_tenant_scoped_exactly_once_ghl_operation',
      decided_by_user_id: input.approverUserId,
      decided_by_agent_rep_id: input.approverAgentRepId,
    },
  });
  return {
    approvalId: input.approvalId,
    capabilityResolutionId: resolution.id,
    mcpMediationRequestId: mediation.id,
    mcpMediationDecisionId: mediationDecision.id,
  };
}

export async function rejectOperationApproval(input: {
  tx: Tx;
  tenantKey: string;
  operationId: string;
  approvalId: string;
  approverUserId: string;
  approverAgentRepId: string;
  notes: string;
}): Promise<void> {
  const approval = await input.tx.approval.findFirst({
    where: {
      id: input.approvalId,
      tenant_key: input.tenantKey,
      target_id: input.operationId,
      target_type: 'external_operation',
    },
  });
  if (!approval) throw new NotFoundError('GHL operation approval', input.approvalId);
  const result = await input.tx.approval.updateMany({
    where: { id: approval.id, approval_status: 'pending' },
    data: {
      approval_status: 'rejected',
      decision: 'rejected',
      rationale: input.notes,
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      decided_at: new Date(),
    },
  });
  if (result.count !== 1) {
    throw new ConflictError('GHL operation approval was already decided');
  }
}

async function ensureCapability(tx: Tx) {
  return tx.capability.upsert({
    where: { name: CAPABILITY_NAME },
    update: {
      description: 'Execute governed commercial operations in the tenant GoHighLevel location',
      category: 'commercial_crm',
      owner_substrate: 'STITCH',
      risk_level: 'high',
      requires_approval: true,
      allowed_agent_types: ['human', 'functional'],
    },
    create: {
      name: CAPABILITY_NAME,
      description: 'Execute governed commercial operations in the tenant GoHighLevel location',
      category: 'commercial_crm',
      owner_substrate: 'STITCH',
      risk_level: 'high',
      requires_approval: true,
      requires_saif_decision: false,
      allowed_agent_types: ['human', 'functional'],
    },
  });
}

async function ensurePattern(tx: Tx, capabilityId: string) {
  const existing = await tx.executionPattern.findFirst({
    where: { capability_id: capabilityId, name: PATTERN_NAME },
  });
  if (existing) return existing;
  return tx.executionPattern.create({
    data: {
      capability_id: capabilityId,
      name: PATTERN_NAME,
      description:
        'Preview, approve, execute once, capture provider identifiers and reconcile by webhook or read-back.',
      ordered_steps: {
        steps: [
          'build_preview',
          'verify_preview_hash',
          'approve',
          'resolve_capability',
          'mediate_connector',
          'enforce_runtime_flags',
          'execute_once',
          'reconcile',
        ],
      },
      required_inputs: ['operationId', 'approvalId', 'idempotencyKey'],
      expected_outputs: ['providerObjectId', 'reconciliationStatus', 'auditEvidence'],
      boundary_rules: {
        directExternalAccess: false,
        rawSecretsReturned: false,
        providerRetryWithoutReconciliation: false,
      },
      m4_allowed: true,
      m5_required: true,
    },
  });
}

async function ensureImplementation(tx: Tx, capabilityId: string) {
  const existing = await tx.implementation.findFirst({
    where: { capability_id: capabilityId, name: IMPLEMENTATION_NAME },
  });
  if (existing) return existing;
  return tx.implementation.create({
    data: {
      capability_id: capabilityId,
      name: IMPLEMENTATION_NAME,
      implementation_type: 'server_side_api_adapter',
      provider: 'gohighlevel',
      is_external: true,
      requires_mcp: true,
      m4_allowed: false,
      m5_allowed: true,
      status: 'active',
    },
  });
}

async function ensureConnector(tx: Tx) {
  return tx.mcpConnector.upsert({
    where: { name: CONNECTOR_NAME },
    update: {
      description: 'Governed server-side GoHighLevel commercial operations adapter',
      connector_type: 'rest_api_adapter',
      target_system: 'gohighlevel',
      status: 'active',
      supports_read: true,
      supports_write: true,
      m4_allowed: false,
      m5_allowed: true,
      credential_required: true,
      owner_substrate: 'STITCH',
    },
    create: {
      name: CONNECTOR_NAME,
      description: 'Governed server-side GoHighLevel commercial operations adapter',
      connector_type: 'rest_api_adapter',
      target_system: 'gohighlevel',
      status: 'active',
      is_external: true,
      supports_read: true,
      supports_write: true,
      m4_allowed: false,
      m5_allowed: true,
      credential_required: true,
      owner_substrate: 'STITCH',
    },
  });
}

async function ensureBinding(
  tx: Tx,
  capabilityId: string,
  implementationId: string,
  connectorId: string,
): Promise<void> {
  await tx.mcpCapabilityBinding.upsert({
    where: {
      capability_id_implementation_id_mcp_connector_id: {
        capability_id: capabilityId,
        implementation_id: implementationId,
        mcp_connector_id: connectorId,
      },
    },
    update: {
      allowed_operation: 'write',
      requires_approval: true,
      requires_m5_authorization: true,
    },
    create: {
      capability_id: capabilityId,
      implementation_id: implementationId,
      mcp_connector_id: connectorId,
      allowed_operation: 'write',
      requires_approval: true,
      requires_saif_decision: false,
      requires_m5_authorization: true,
    },
  });
}
