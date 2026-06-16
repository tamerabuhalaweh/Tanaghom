import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type {
  CreateApprovalInput, ApprovalDecisionInput, EscalationInput, CancellationInput,
  ApprovalSummary, ApprovalStatus,
} from './types';
import { getRoutingRule, validateApprovalTransition } from './types';

export async function createApproval(input: CreateApprovalInput): Promise<ApprovalSummary> {
  const routingRule = getRoutingRule(input.riskCategory, input.targetType);

  const approval = await prisma.approval.create({
    data: {
      target_type: input.targetType,
      target_id: input.targetId,
      saif_decision_record_id: input.saifDecisionRecordId,
      requester_user_id: input.requesterUserId,
      requester_agent_rep_id: input.requesterAgentRepId,
      approval_type: input.approvalType || routingRule?.approvalType || 'department_review',
      risk_category: input.riskCategory,
      required_department: input.requiredDepartment || routingRule?.requiredDepartment,
      required_role: input.requiredRole || routingRule?.requiredRole,
      comment: input.comment,
    },
  });
  return mapApproval(approval);
}

export async function getApprovalById(id: string): Promise<ApprovalSummary> {
  const approval = await prisma.approval.findUnique({ where: { id } });
  if (!approval) throw new NotFoundError('Approval', id);
  return mapApproval(approval);
}

export async function listApprovals(filters?: {
  targetId?: string;
  targetType?: string;
  approvalStatus?: string;
  requesterUserId?: string;
  approverUserId?: string;
  requiredDepartment?: string;
}): Promise<ApprovalSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.targetId) where.target_id = filters.targetId;
  if (filters?.targetType) where.target_type = filters.targetType;
  if (filters?.approvalStatus) where.approval_status = filters.approvalStatus;
  if (filters?.requesterUserId) where.requester_user_id = filters.requesterUserId;
  if (filters?.approverUserId) where.approver_user_id = filters.approverUserId;
  if (filters?.requiredDepartment) where.required_department = filters.requiredDepartment;

  const approvals = await prisma.approval.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return approvals.map(mapApproval);
}

export async function approve(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'approved');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'approved',
      decision: input.decision || 'approved',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function reject(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'rejected');

  if (!input.comment) {
    throw new ForbiddenError('Rejection requires a comment');
  }

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'rejected',
      decision: 'rejected',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function requestChanges(id: string, input: ApprovalDecisionInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'changes_requested');

  if (!input.comment) {
    throw new ForbiddenError('Requesting changes requires a comment');
  }

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approver_user_id: input.approverUserId,
      approver_agent_rep_id: input.approverAgentRepId,
      approval_status: 'changes_requested',
      decision: 'changes_requested',
      comment: input.comment,
      rationale: input.rationale,
      decided_at: new Date(),
    },
  });
  return mapApproval(approval);
}

export async function escalate(id: string, input: EscalationInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'escalated');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approval_status: 'escalated',
      escalated_at: new Date(),
      comment: input.reason || 'Escalated',
    },
  });
  return mapApproval(approval);
}

export async function cancel(id: string, input: CancellationInput): Promise<ApprovalSummary> {
  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Approval', id);

  validateApprovalTransition(existing.approval_status as ApprovalStatus, 'cancelled');

  const approval = await prisma.approval.update({
    where: { id },
    data: {
      approval_status: 'cancelled',
      comment: input.reason || 'Cancelled',
    },
  });
  return mapApproval(approval);
}

function mapApproval(a: Record<string, unknown>): ApprovalSummary {
  return {
    id: a.id as string,
    targetType: a.target_type as ApprovalSummary['targetType'],
    targetId: a.target_id as string,
    saifDecisionRecordId: a.saif_decision_record_id as string | null,
    requesterUserId: a.requester_user_id as string,
    requesterAgentRepId: a.requester_agent_rep_id as string,
    approverUserId: a.approver_user_id as string | null,
    approverAgentRepId: a.approver_agent_rep_id as string | null,
    approvalType: a.approval_type as ApprovalSummary['approvalType'],
    approvalStatus: a.approval_status as ApprovalSummary['approvalStatus'],
    decision: a.decision as string | null,
    comment: a.comment as string | null,
    rationale: a.rationale as string | null,
    riskCategory: a.risk_category as ApprovalSummary['riskCategory'],
    requiredDepartment: a.required_department as string | null,
    requiredRole: a.required_role as string | null,
    requestedAt: a.requested_at as Date,
    decidedAt: a.decided_at as Date | null,
    expiresAt: a.expires_at as Date | null,
    escalatedAt: a.escalated_at as Date | null,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}
