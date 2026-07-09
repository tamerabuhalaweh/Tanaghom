import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import { recordCommercialWorkflowAudit } from '@modules/commercial-workflow/evidence';
import * as repo from './repository';
import { checkApprovalPermission } from './policy';
import { validateCriticalDimensions } from '../saif-decisions/repository';
import type {
  CreateApprovalInput, ApprovalDecisionInput, EscalationInput, CancellationInput,
  ApprovalDecisionPacket, ApprovalSummary,
} from './types';

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

function validateApproverNotFunctionalAgent(agentType: string): void {
  if (agentType === 'functional') {
    throw new ForbiddenError('FunctionalAgent cannot approve');
  }
}

export async function submitForApproval(requesterRole: string, tenantKey: string, input: CreateApprovalInput): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:create');

  const approval = await repo.createApproval(input, tenantKey);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'approval_submitted', object_type: 'approval', object_id: approval.id, result: 'success' },
    `Approval submitted: ${approval.targetType}/${approval.targetId}`,
  );
  await recordCommercialWorkflowAudit({
    action: 'approval_submitted',
    result: 'success',
    humanUserId: input.requesterUserId,
    agentRepId: input.requesterAgentRepId,
    targetObjectType: 'approval',
    targetObjectId: approval.id,
    sourceModule: 'approvals',
    reason: `Approval submitted for ${approval.targetType}/${approval.targetId}`,
    riskCategory: approval.riskCategory,
    afterState: {
      targetType: approval.targetType,
      targetId: approval.targetId,
      approvalStatus: approval.approvalStatus,
    },
  });

  createIdentityLineage(
    input.requesterUserId,
    input.requesterAgentRepId,
    'human',
    null,
    'submit_for_approval',
    'approval',
    approval.id,
    'success',
    { targetType: approval.targetType, targetId: approval.targetId, riskCategory: approval.riskCategory },
  );

  return approval;
}

export async function getApproval(requesterRole: string, tenantKey: string, id: string): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:read');
  return repo.getApprovalById(id, tenantKey);
}

export async function getApprovalDecisionPacket(requesterRole: string, tenantKey: string, id: string): Promise<ApprovalDecisionPacket> {
  checkApprovalPermission(requesterRole, 'approvals:read');
  return repo.getApprovalDecisionPacket(id, tenantKey);
}

export async function listApprovals(requesterRole: string, filters?: {
  tenantKey?: string;
  targetId?: string;
  targetType?: string;
  approvalStatus?: string;
  requesterUserId?: string;
  approverUserId?: string;
  requiredDepartment?: string;
}): Promise<ApprovalSummary[]> {
  checkApprovalPermission(requesterRole, 'approvals:read');
  return repo.listApprovals(filters);
}

export async function approve(
  requesterRole: string,
  tenantKey: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:approve');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  // Check SAIF critical dimensions if decision record is linked
  const approval = await repo.getApprovalById(approvalId, tenantKey);
  if (approval.saifDecisionRecordId) {
    const { valid, missing } = await validateCriticalDimensions(approval.saifDecisionRecordId);
    if (!valid) {
      throw new ForbiddenError(
        `Cannot approve: SAIF critical dimensions unresolved: ${missing.join(', ')}`
      );
    }
  }

  const result = await repo.approve(approvalId, tenantKey, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'approved' },
    `Approval approved: ${approvalId}`,
  );
  await recordCommercialWorkflowAudit({
    action: 'approval_decided',
    result: 'success',
    humanUserId: sessionUserId,
    agentRepId: sessionAgentRepId,
    targetObjectType: 'approval',
    targetObjectId: approvalId,
    sourceModule: 'approvals',
    reason: input.comment || 'Approved by human reviewer',
    policyMatched: 'human_approval_required',
    approvalId,
    afterState: { decision: 'approved' },
  });

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'approve',
    'approval',
    approvalId,
    'success',
    { decision: 'approved', comment: input.comment },
  );

  return result;
}

export async function reject(
  requesterRole: string,
  tenantKey: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:reject');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  const result = await repo.reject(approvalId, tenantKey, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'rejected' },
    `Approval rejected: ${approvalId}`,
  );
  await recordCommercialWorkflowAudit({
    action: 'approval_decided',
    result: 'success',
    humanUserId: sessionUserId,
    agentRepId: sessionAgentRepId,
    targetObjectType: 'approval',
    targetObjectId: approvalId,
    sourceModule: 'approvals',
    reason: input.comment || 'Rejected by human reviewer',
    policyMatched: 'human_approval_required',
    approvalId,
    afterState: { decision: 'rejected' },
  });

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'reject',
    'approval',
    approvalId,
    'success',
    { decision: 'rejected', comment: input.comment },
  );

  return result;
}

export async function requestChanges(
  requesterRole: string,
  tenantKey: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:approve');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  const result = await repo.requestChanges(approvalId, tenantKey, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'changes_requested' },
    `Approval changes requested: ${approvalId}`,
  );
  await recordCommercialWorkflowAudit({
    action: 'approval_decided',
    result: 'success',
    humanUserId: sessionUserId,
    agentRepId: sessionAgentRepId,
    targetObjectType: 'approval',
    targetObjectId: approvalId,
    sourceModule: 'approvals',
    reason: input.comment || 'Changes requested by human reviewer',
    policyMatched: 'human_approval_required',
    approvalId,
    afterState: { decision: 'changes_requested' },
  });

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'request_changes',
    'approval',
    approvalId,
    'success',
    { decision: 'changes_requested', comment: input.comment },
  );

  return result;
}

export async function escalate(
  requesterRole: string,
  tenantKey: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: EscalationInput,
): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:escalate');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.escalatedByUserId, input.escalatedByAgentRepId);

  const result = await repo.escalate(approvalId, tenantKey, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_escalated', object_type: 'approval', object_id: approvalId, result: 'success' },
    `Approval escalated: ${approvalId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'escalate',
    'approval',
    approvalId,
    'success',
    { reason: input.reason },
  );

  return result;
}

export async function cancel(
  requesterRole: string,
  tenantKey: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CancellationInput,
): Promise<ApprovalSummary> {
  checkApprovalPermission(requesterRole, 'approvals:cancel');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.cancelledByUserId, input.cancelledByAgentRepId);

  const result = await repo.cancel(approvalId, tenantKey, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_cancelled', object_type: 'approval', object_id: approvalId, result: 'success' },
    `Approval cancelled: ${approvalId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'cancel',
    'approval',
    approvalId,
    'success',
    { reason: input.reason },
  );

  return result;
}
