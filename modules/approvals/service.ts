import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import { validateCriticalDimensions } from '../saif-decisions/repository';
import type {
  CreateApprovalInput, ApprovalDecisionInput, EscalationInput, CancellationInput,
  ApprovalDecisionPacket, ApprovalSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
  cco: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
  department_head: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate'],
  specialist: ['approvals:create', 'approvals:read'],
  reviewer: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject'],
  viewer: ['approvals:read'],
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

function validateApproverNotFunctionalAgent(agentType: string): void {
  if (agentType === 'functional') {
    throw new ForbiddenError('FunctionalAgent cannot approve');
  }
}

export async function submitForApproval(requesterRole: string, input: CreateApprovalInput): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:create');

  const approval = await repo.createApproval(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'approval_submitted', object_type: 'approval', object_id: approval.id, result: 'success' },
    `Approval submitted: ${approval.targetType}/${approval.targetId}`,
  );

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

export async function getApproval(requesterRole: string, id: string): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:read');
  return repo.getApprovalById(id);
}

export async function getApprovalDecisionPacket(requesterRole: string, id: string): Promise<ApprovalDecisionPacket> {
  checkPermission(requesterRole, 'approvals:read');
  return repo.getApprovalDecisionPacket(id);
}

export async function listApprovals(requesterRole: string, filters?: {
  targetId?: string;
  targetType?: string;
  approvalStatus?: string;
  requesterUserId?: string;
  approverUserId?: string;
  requiredDepartment?: string;
}): Promise<ApprovalSummary[]> {
  checkPermission(requesterRole, 'approvals:read');
  return repo.listApprovals(filters);
}

export async function approve(
  requesterRole: string,
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:approve');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  // Check SAIF critical dimensions if decision record is linked
  const approval = await repo.getApprovalById(approvalId);
  if (approval.saifDecisionRecordId) {
    const { valid, missing } = await validateCriticalDimensions(approval.saifDecisionRecordId);
    if (!valid) {
      throw new ForbiddenError(
        `Cannot approve: SAIF critical dimensions unresolved: ${missing.join(', ')}`
      );
    }
  }

  const result = await repo.approve(approvalId, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'approved' },
    `Approval approved: ${approvalId}`,
  );

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
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:reject');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  const result = await repo.reject(approvalId, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'rejected' },
    `Approval rejected: ${approvalId}`,
  );

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
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  sessionAgentType: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:approve');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.approverUserId, input.approverAgentRepId);
  validateApproverNotFunctionalAgent(sessionAgentType);

  const result = await repo.requestChanges(approvalId, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'approval_decided', object_type: 'approval', object_id: approvalId, result: 'success', policy_decision: 'changes_requested' },
    `Approval changes requested: ${approvalId}`,
  );

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
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: EscalationInput,
): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:escalate');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.escalatedByUserId, input.escalatedByAgentRepId);

  const result = await repo.escalate(approvalId, input);

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
  approvalId: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CancellationInput,
): Promise<ApprovalSummary> {
  checkPermission(requesterRole, 'approvals:cancel');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.cancelledByUserId, input.cancelledByAgentRepId);

  const result = await repo.cancel(approvalId, input);

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
