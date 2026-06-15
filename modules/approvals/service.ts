import { ForbiddenError, NotFoundError, ConflictError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { prisma } from '@shared/database';
import {
  APPROVAL_EVENTS,
  type SubmittedForApprovalEvent,
  type ApprovalDecisionRecorddEvent,
  type AllApprovalsCollectedEvent,
} from './events';
import * as repo from './repository';
import type {
  SubmitForApprovalInput,
  ApprovalDecisionInput,
  ApprovalRecord,
  ApprovalStatus,
  ApprovalRoute,
  RiskCategory,
  ApprovalDecision,
} from './types';
import { ROUTING_RULES, CONTENT_TYPE_ROUTES, APPROVAL_SLA } from './types';

// ============================================================
// Permission Map
// ============================================================

const PERMISSIONS: Record<string, string[]> = {
  admin: ['approval:submit', 'approval:decide', 'approval:read', 'approval:manage'],
  cco: ['approval:submit', 'approval:decide', 'approval:read'],
  department_head: ['approval:submit', 'approval:decide', 'approval:read'],
  specialist: ['approval:submit', 'approval:read'],
  reviewer: ['approval:read'],
  viewer: ['approval:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

// ============================================================
// Approval Routing Logic
// ============================================================

function determineRoutes(
  riskCategory: RiskCategory,
  contentType: string,
  _ownerDepartmentId: string,
): ApprovalRoute[] {
  const routes: ApprovalRoute[] = [];

  // Base routes from risk category
  const riskRoutes = ROUTING_RULES[riskCategory] || [];
  for (const route of riskRoutes) {
    if (!routes.some((r) => r.department === route.department && r.role === route.role)) {
      routes.push(route);
    }
  }

  // Content type overrides
  const contentTypeRoutes = CONTENT_TYPE_ROUTES[contentType] || [];
  for (const route of contentTypeRoutes) {
    if (!routes.some((r) => r.department === route.department && r.role === route.role)) {
      routes.push(route);
    }
  }

  return routes;
}

// ============================================================
// Approval Service
// ============================================================

export async function submitForApproval(
  requesterRole: string,
  requesterId: string,
  input: SubmitForApprovalInput,
): Promise<ApprovalStatus> {
  checkPermission(requesterRole, 'approval:submit');

  // Check if already submitted
  const existingRecords = await repo.getApprovalRecordsByContentItem(input.contentItemId);
  if (existingRecords.length > 0) {
    throw new ConflictError('Content item already submitted for approval');
  }

  // Determine routing
  const routes = determineRoutes(input.riskCategory, input.contentType, input.ownerDepartmentId);

  // Create approval records
  const recordsToCreate = routes.map((route) => ({
    contentItemId: input.contentItemId,
    campaignRequestId: input.campaignRequestId,
    department: route.department,
    approverRole: route.role,
    approverId: null,
    decision: null as ApprovalDecision | null,
    comments: null,
    required: route.required,
    reason: route.reason,
    slaDeadline: new Date(Date.now() + APPROVAL_SLA.reminderHours * 60 * 60 * 1000),
  }));

  await repo.createApprovalRecords(recordsToCreate);

  // Update content item status
  await prisma.contentItem.update({
    where: { id: input.contentItemId },
    data: { status: 'pending_review' },
  });

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'submitted_for_approval',
      object_type: 'content_item',
      object_id: input.contentItemId,
      result: 'success',
    },
    `Submitted for approval: ${routes.length} approvers required`,
  );

  const event: SubmittedForApprovalEvent = {
    contentItemId: input.contentItemId,
    campaignRequestId: input.campaignRequestId,
    riskCategory: input.riskCategory,
    totalRequired: routes.filter((r) => r.required).length,
    timestamp: new Date(),
  };
  await eventBus.emit(APPROVAL_EVENTS.SUBMITTED_FOR_APPROVAL, event);

  return getApprovalStatus(requesterRole, input.contentItemId);
}

export async function recordApprovalDecision(
  requesterRole: string,
  requesterId: string,
  input: ApprovalDecisionInput,
): Promise<ApprovalStatus> {
  checkPermission(requesterRole, 'approval:decide');

  const record = await repo.getApprovalRecordById(input.approvalRecordId);

  // Verify the approver has permission for this department/role
  const user = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!user) throw new NotFoundError('User', requesterId);

  const userDept = await prisma.department.findUnique({ where: { id: user.department_id || '' } });
  if (userDept?.name !== record.department && user.role !== 'admin') {
    throw new ForbiddenError(`You can only approve content for your department (${userDept?.name})`);
  }

  // Record the decision
  await repo.recordDecision(
    input.approvalRecordId,
    requesterId,
    input.decision,
    input.comments || null,
  );

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'approval_decision_recordd',
      object_type: 'approval_event',
      object_id: input.approvalRecordId,
      result: 'success',
    },
    `Approval decision: ${input.decision} for ${record.contentItemId}`,
  );

  const event: ApprovalDecisionRecorddEvent = {
    approvalRecordId: input.approvalRecordId,
    contentItemId: record.contentItemId,
    approverId: requesterId,
    department: record.department,
    decision: input.decision,
    comments: input.comments || null,
    timestamp: new Date(),
  };
  await eventBus.emit(APPROVAL_EVENTS.APPROVAL_DECISION_RECORDED, event);

  // Check if all approvals are collected
  const status = await getApprovalStatus(requesterRole, record.contentItemId);
  if (status.status === 'approved' || status.status === 'rejected') {
    const allEvent: AllApprovalsCollectedEvent = {
      contentItemId: record.contentItemId,
      finalStatus: status.status,
      approvedCount: status.approvedCount,
      rejectedCount: status.rejectedCount,
      timestamp: new Date(),
    };
    await eventBus.emit(APPROVAL_EVENTS.ALL_APPROVALS_COLLECTED, allEvent);

    // Update content item status
    const newContentStatus = status.status === 'approved' ? 'approved' : 'rejected';
    await prisma.contentItem.update({
      where: { id: record.contentItemId },
      data: { status: newContentStatus },
    });
  }

  return status;
}

export async function getApprovalStatus(
  requesterRole: string,
  contentItemId: string,
): Promise<ApprovalStatus> {
  checkPermission(requesterRole, 'approval:read');

  const records = await repo.getApprovalRecordsByContentItem(contentItemId);
  if (records.length === 0) {
    throw new NotFoundError('Approval records for content item', contentItemId);
  }

  const requiredRecords = records.filter((r) => r.required);
  const approvedCount = requiredRecords.filter((r) => r.decision === 'approved').length;
  const rejectedCount = requiredRecords.filter((r) => r.decision === 'rejected').length;
  const needsChangesCount = requiredRecords.filter((r) => r.decision === 'needs_changes').length;
  const pendingCount = requiredRecords.filter((r) => r.decision === null).length;

  let status: 'pending' | 'approved' | 'rejected' | 'needs_changes' = 'pending';
  const blockReasons: string[] = [];

  if (rejectedCount > 0) {
    status = 'rejected';
    blockReasons.push(`${rejectedCount} approval(s) rejected`);
  } else if (needsChangesCount > 0) {
    status = 'needs_changes';
    blockReasons.push(`${needsChangesCount} approval(s) need changes`);
  } else if (pendingCount > 0) {
    status = 'pending';
    blockReasons.push(`${pendingCount} approval(s) still pending`);
  } else if (approvedCount === requiredRecords.length) {
    status = 'approved';
  }

  return {
    contentItemId,
    status,
    totalRequired: requiredRecords.length,
    approvedCount,
    rejectedCount,
    needsChangesCount,
    pendingCount,
    records,
    canSchedule: status === 'approved' && blockReasons.length === 0,
    blockReasons,
  };
}

export async function getPendingApprovalsForReviewer(
  requesterRole: string,
  requesterId: string,
): Promise<ApprovalRecord[]> {
  checkPermission(requesterRole, 'approval:read');

  const user = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!user) throw new NotFoundError('User', requesterId);

  const userDept = await prisma.department.findUnique({ where: { id: user.department_id || '' } });
  if (!userDept) return [];

  const pending = await repo.getPendingApprovals();
  return pending.filter((r) => r.department === userDept.name);
}

export async function checkSlaCompliance(): Promise<{
  remindersNeeded: ApprovalRecord[];
  escalationsNeeded: ApprovalRecord[];
}> {
  const pending = await repo.getPendingApprovals();
  const now = new Date();

  const remindersNeeded: ApprovalRecord[] = [];
  const escalationsNeeded: ApprovalRecord[] = [];

  for (const record of pending) {
    const hoursWaiting = (now.getTime() - record.submittedAt.getTime()) / (1000 * 60 * 60);

    if (hoursWaiting >= APPROVAL_SLA.criticalHours && !record.escalated) {
      escalationsNeeded.push(record);
    } else if (hoursWaiting >= APPROVAL_SLA.reminderHours && !record.reminderSent) {
      remindersNeeded.push(record);
    }
  }

  return { remindersNeeded, escalationsNeeded };
}
