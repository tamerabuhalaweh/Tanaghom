import { auditLog } from '@shared/logging';
import { checkAnnualPlanningPermission } from './policy';
import * as repo from './repository';
import type {
  AnnualPlanStatus,
  AnnualPlanTransitionInput,
  ArchivePortfolioItemInput,
  CreateAnnualPlanInput,
  CreatePortfolioItemInput,
  LinkLearningSetsInput,
  ListAnnualPlansInput,
  RejectAnnualPlanInput,
  UpdateAnnualPlanInput,
  UpdatePortfolioItemInput,
} from './types';

export async function listAnnualPlans(
  role: string,
  tenantKey: string,
  input: ListAnnualPlansInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:read');
  return repo.listAnnualPlans(tenantKey, input);
}

export async function getAnnualPlan(role: string, tenantKey: string, id: string) {
  checkAnnualPlanningPermission(role, 'annual-plan:read');
  return repo.getAnnualPlan(tenantKey, id);
}

export async function createAnnualPlan(
  role: string,
  tenantKey: string,
  userId: string,
  input: CreateAnnualPlanInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:create');
  const result = await repo.createAnnualPlan(tenantKey, userId, input);
  log(
    userId,
    'annual_commercial_plan_created',
    result.id,
    `Annual plan created for ${result.year}`,
  );
  return result;
}

export async function updateAnnualPlan(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateAnnualPlanInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:update');
  const result = await repo.updateAnnualPlan(tenantKey, userId, id, input);
  log(userId, 'annual_commercial_plan_updated', id, `Annual plan updated for ${result.year}`);
  return result;
}

export async function transitionAnnualPlan(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  target: AnnualPlanStatus,
  input: AnnualPlanTransitionInput | RejectAnnualPlanInput,
) {
  checkAnnualPlanningPermission(
    role,
    target === 'approved' || target === 'rejected' ? 'annual-plan:approve' : 'annual-plan:update',
  );
  const result = await repo.transitionAnnualPlan(tenantKey, userId, id, target, input);
  log(userId, `annual_commercial_plan_${target}`, id, `Annual plan moved to ${target}`);
  return result;
}

export async function updateLearningSets(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: LinkLearningSetsInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:update');
  return repo.updateLearningSets(tenantKey, userId, id, input);
}

export async function createPortfolioItem(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  input: CreatePortfolioItemInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:update');
  return repo.createPortfolioItem(tenantKey, userId, annualPlanId, input);
}

export async function updatePortfolioItem(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:update');
  return repo.updatePortfolioItem(tenantKey, userId, annualPlanId, itemId, input);
}

export async function archivePortfolioItem(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  input: ArchivePortfolioItemInput,
) {
  checkAnnualPlanningPermission(role, 'annual-plan:update');
  return repo.archivePortfolioItem(tenantKey, userId, annualPlanId, itemId, input);
}

function log(userId: string, action: string, objectId: string, message: string): void {
  auditLog(
    {
      actor: `user:${userId}`,
      action,
      object_type: 'annual_commercial_plan',
      object_id: objectId,
      result: 'success',
    },
    message,
  );
}
