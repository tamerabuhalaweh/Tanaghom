import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';

const PUBLISHING_CAPABILITY_NAME = 'PreparePublishingPackage';
const PUBLISHING_PATTERN_NAME = 'Approval-Gated Publishing Package Preparation';
const PUBLISHING_IMPLEMENTATION_NAME = 'STITCH Postiz Package Preparation';
const POSTIZ_CONNECTOR_NAME = 'postiz_package_scheduling_mcp';

export interface PublishingPackageGovernanceInput {
  humanUserId: string;
  agentRepId: string;
  campaignId: string;
  contentItemId?: string | null;
  approvalId: string;
  packageTitle: string;
}

export interface PublishingPackageGovernanceLinks {
  saifDecisionRecordId: string;
  capabilityResolutionId: string;
  mcpMediationRequestId: string;
  mcpMediationDecisionId: string;
  mcpConnectorId: string;
}

type Tx = Prisma.TransactionClient;

export async function createPublishingPackageGovernance(
  input: PublishingPackageGovernanceInput,
): Promise<PublishingPackageGovernanceLinks> {
  return prisma.$transaction(async (tx) => {
    const capability = await ensurePublishingCapability(tx);
    const [pattern, implementation, connector] = await Promise.all([
      ensurePublishingPattern(tx, capability.id),
      ensurePublishingImplementation(tx, capability.id),
      ensurePostizPreparationConnector(tx),
    ]);

    const intent = await tx.intent.create({
      data: {
        name: `Prepare publishing package for ${input.packageTitle}`,
        description: 'Create a governed package for approval-gated scheduling preparation.',
        category: 'publishing',
        source_type: 'commercial_social_workflow',
        created_by_user_id: input.humanUserId,
        created_by_agent_rep_id: input.agentRepId,
      },
    });
    const objective = await tx.objective.create({
      data: {
        intent_id: intent.id,
        name: 'Prepare external scheduling package without performing external execution',
        description: 'Create scheduling-ready payloads, evidence, and connector mediation records while external execution remains policy-gated.',
        success_criteria: 'Package contains approved content, SAIF record, resolved capability, and MCP mediation evidence.',
        constraints: 'No direct external publishing. No scheduling unless tenant credentials, approval, runtime flags, and M5 policy permit it.',
        priority: 80,
      },
    });
    const decision = await tx.saifDecisionRecord.create({
      data: {
        title: `SAIF publishing package decision for ${input.packageTitle}`,
        description: 'System-generated decision record documenting the approved preparation of a Postiz-ready scheduling package.',
        decision_scope: 'commercial_social_publishing_preparation',
        complexity: 'medium',
        status: 'execution_ready',
        human_user_id: input.humanUserId,
        agent_rep_id: input.agentRepId,
        authority_user_id: input.humanUserId,
        authority_agent_rep_id: input.agentRepId,
        rationale: 'Human approval exists; external execution remains blocked until tenant credentials, runtime flags, MCP mediation, and M5 policy permit scheduling.',
        alternatives_considered: 'Direct social publishing rejected. Postiz scheduling package preparation selected as governed pathway.',
        confidence: 'medium',
        risk_acceptance: 'Preparation only. No external write is performed by this decision.',
        execution_readiness: true,
        success_criteria: 'Approved content is packaged with traceable governance IDs and can be evaluated by downstream scheduling gates.',
      },
    });
    const resolution = await tx.capabilityResolution.create({
      data: {
        intent_id: intent.id,
        objective_id: objective.id,
        capability_id: capability.id,
        execution_pattern_id: pattern.id,
        implementation_id: implementation.id,
        saif_decision_record_id: decision.id,
        human_user_id: input.humanUserId,
        agent_rep_id: input.agentRepId,
        resolution_status: 'resolved',
        rationale: 'Capability resolved for approval-gated publishing package preparation. External scheduling remains separate and gated.',
        constraints_applied: {
          approvalId: input.approvalId,
          campaignId: input.campaignId,
          contentItemId: input.contentItemId ?? null,
          directExternalAccess: false,
          customerOwnedCredentialsRequired: true,
        },
        rejected_alternatives: {
          directPostizWrite: 'Rejected. Scheduling must pass external execution policy and MCP mediation.',
          directSocialApiWrite: 'Rejected. Social publishing must go through approved connector path.',
        },
      },
    });
    const mediation = await tx.mcpMediationRequest.create({
      data: {
        capability_resolution_id: resolution.id,
        mcp_connector_id: connector.id,
        requested_operation: 'prepare_schedule',
        resource_ids: [],
        human_user_id: input.humanUserId,
        agent_rep_id: input.agentRepId,
        acting_agent_type: 'human',
        saif_decision_record_id: decision.id,
        approval_id: input.approvalId,
        request_status: 'approved',
      },
    });
    const mediationDecision = await tx.mcpMediationDecision.create({
      data: {
        mediation_request_id: mediation.id,
        decision: 'allow',
        rationale: 'Allow preparation of a scheduling package only. No connector write is authorized by this mediation decision.',
        policy_matched: 'approval_gated_prepare_schedule',
        decided_by_user_id: input.humanUserId,
        decided_by_agent_rep_id: input.agentRepId,
      },
    });

    return {
      saifDecisionRecordId: decision.id,
      capabilityResolutionId: resolution.id,
      mcpMediationRequestId: mediation.id,
      mcpMediationDecisionId: mediationDecision.id,
      mcpConnectorId: connector.id,
    };
  });
}

async function ensurePublishingCapability(tx: Tx) {
  return tx.capability.upsert({
    where: { name: PUBLISHING_CAPABILITY_NAME },
    update: {
      description: 'Prepare content package for publishing',
      category: 'publishing',
      risk_level: 'high',
      requires_approval: true,
      requires_saif_decision: true,
      allowed_agent_types: ['functional'],
    },
    create: {
      name: PUBLISHING_CAPABILITY_NAME,
      description: 'Prepare content package for publishing',
      category: 'publishing',
      risk_level: 'high',
      requires_approval: true,
      requires_saif_decision: true,
      allowed_agent_types: ['functional'],
    },
  });
}

async function ensurePublishingPattern(tx: Tx, capabilityId: string) {
  const existing = await tx.executionPattern.findFirst({
    where: { capability_id: capabilityId, name: PUBLISHING_PATTERN_NAME },
  });
  if (existing) return existing;
  return tx.executionPattern.create({
    data: {
      capability_id: capabilityId,
      name: PUBLISHING_PATTERN_NAME,
      description: 'Prepare a scheduling-ready package after human approval while keeping external execution behind policy gates.',
      ordered_steps: {
        steps: [
          'verify_human_approval',
          'create_saif_decision_record',
          'resolve_publishing_capability',
          'create_mcp_mediation_evidence',
          'generate_postiz_ready_payload',
        ],
      },
      required_inputs: ['approvalId', 'campaignId'],
      expected_outputs: ['publishingPackage', 'postizReadyPayload', 'governanceLinks'],
      boundary_rules: {
        directExternalAccess: false,
        externalExecutionRequiresSeparateGate: true,
      },
      m4_allowed: true,
      m5_required: false,
    },
  });
}

async function ensurePublishingImplementation(tx: Tx, capabilityId: string) {
  const existing = await tx.implementation.findFirst({
    where: { capability_id: capabilityId, name: PUBLISHING_IMPLEMENTATION_NAME },
  });
  if (existing) return existing;
  return tx.implementation.create({
    data: {
      capability_id: capabilityId,
      name: PUBLISHING_IMPLEMENTATION_NAME,
      implementation_type: 'postiz_package_preparation',
      provider: 'Tanaghum STITCH',
      is_external: false,
      requires_mcp: true,
      m4_allowed: true,
      m5_allowed: false,
      status: 'active',
    },
  });
}

async function ensurePostizPreparationConnector(tx: Tx) {
  return tx.mcpConnector.upsert({
    where: { name: POSTIZ_CONNECTOR_NAME },
    update: {
      description: 'Governed MCP mediation record for Postiz package preparation. External writes remain blocked by execution policy.',
      connector_type: 'publishing',
      target_system: 'Postiz',
      status: 'active',
      is_external: true,
      supports_read: true,
      supports_write: false,
      m4_allowed: true,
      m5_allowed: false,
      credential_required: true,
    },
    create: {
      name: POSTIZ_CONNECTOR_NAME,
      description: 'Governed MCP mediation record for Postiz package preparation. External writes remain blocked by execution policy.',
      connector_type: 'publishing',
      target_system: 'Postiz',
      status: 'active',
      is_external: true,
      supports_read: true,
      supports_write: false,
      m4_allowed: true,
      m5_allowed: false,
      credential_required: true,
    },
  });
}
