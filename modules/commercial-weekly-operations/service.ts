import { auditLog } from '@shared/logging';
import { ForbiddenError, ValidationError } from '@shared/errors';
import {
  canApproveWeeklyWork,
  canContributeToWeeklyWork,
  canManageWeeklyWork,
  checkWeeklyWorkPermission,
} from './policy';
import * as repo from './repository';
import type {
  CreateWeeklyWorkItemInput,
  TransitionWeeklyWorkItemInput,
  UpdateWeeklyWorkItemInput,
  WeeklyWorkspaceQuery,
  WeeklyWorkspaceSummary,
  WeeklyWorkItemSummary,
  WeeklyWorkStatus,
} from './types';

const TRANSITIONS: Record<WeeklyWorkStatus, WeeklyWorkStatus[]> = {
  planned: ['ready', 'in_progress', 'blocked', 'awaiting_approval', 'cancelled'],
  ready: ['in_progress', 'blocked', 'awaiting_approval', 'cancelled'],
  in_progress: ['blocked', 'awaiting_approval', 'completed', 'cancelled'],
  blocked: ['ready', 'in_progress', 'awaiting_approval', 'cancelled'],
  awaiting_approval: ['planned', 'ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function getWeeklyWorkspace(
  role: string,
  tenantKey: string,
  commercialPlanId: string,
  query: WeeklyWorkspaceQuery,
): Promise<WeeklyWorkspaceSummary> {
  checkWeeklyWorkPermission(role, 'weekly-work:read');
  return repo.getWeeklyWorkspace(tenantKey, commercialPlanId, query);
}

export async function createWeeklyWorkItem(
  role: string,
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  input: CreateWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  checkWeeklyWorkPermission(role, 'weekly-work:create');
  const item = await repo.createWeeklyWorkItem(tenantKey, userId, commercialPlanId, input);
  writeOperationalAudit(userId, 'commercial_weekly_work_created', item);
  return item;
}

export async function updateWeeklyWorkItem(
  role: string,
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  itemId: string,
  input: UpdateWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  const current = await repo.getWeeklyWorkItem(tenantKey, commercialPlanId, itemId);
  assertContributor(role, userId, current);
  if (current.status === 'awaiting_approval' || current.status === 'completed' || current.status === 'cancelled') {
    throw new ValidationError('This weekly work item must leave its current status before its details can be edited');
  }
  const item = await repo.updateWeeklyWorkItem(tenantKey, userId, commercialPlanId, itemId, input);
  writeOperationalAudit(userId, 'commercial_weekly_work_updated', item);
  return item;
}

export async function transitionWeeklyWorkItem(
  role: string,
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  itemId: string,
  input: TransitionWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  const current = await repo.getWeeklyWorkItem(tenantKey, commercialPlanId, itemId);
  if (!TRANSITIONS[current.status].includes(input.targetStatus)) {
    throw new ValidationError(`Weekly work cannot move from ${current.status} to ${input.targetStatus}`);
  }

  const approvalDecision = current.status === 'awaiting_approval' && input.targetStatus === 'ready';
  if (approvalDecision) {
    checkWeeklyWorkPermission(role, 'weekly-work:approve');
    if (current.createdByUserId === userId) {
      throw new ForbiddenError('The person who prepared weekly work cannot approve the same item');
    }
  } else {
    assertContributor(role, userId, current);
  }

  if (input.targetStatus === 'blocked' && !input.blockerReason) {
    throw new ValidationError('A blocker reason is required');
  }
  if (input.targetStatus === 'completed' && !input.completionEvidence) {
    throw new ValidationError('Completion evidence is required');
  }
  if (current.status === 'awaiting_approval' && input.targetStatus === 'planned' && !canManageWeeklyWork(role)) {
    throw new ForbiddenError('Only a workspace manager can withdraw weekly work from approval');
  }

  const item = await repo.transitionWeeklyWorkItem(tenantKey, userId, commercialPlanId, itemId, input);
  writeOperationalAudit(userId, approvalDecision ? 'commercial_weekly_work_approved' : 'commercial_weekly_work_status_changed', item);
  return item;
}

function assertContributor(role: string, userId: string, item: WeeklyWorkItemSummary): void {
  if (canManageWeeklyWork(role)) return;
  if (!canContributeToWeeklyWork(role) || item.ownerUserId !== userId) {
    throw new ForbiddenError('Only the assigned owner or a workspace manager can change this weekly work item');
  }
}

function writeOperationalAudit(userId: string, action: string, item: WeeklyWorkItemSummary): void {
  auditLog(
    {
      actor: `user:${userId}`,
      action,
      object_type: 'commercial_weekly_work_item',
      object_id: item.id,
      result: 'success',
    },
    `${item.title}: ${item.status}`,
  );
}

export { canApproveWeeklyWork, canManageWeeklyWork };
