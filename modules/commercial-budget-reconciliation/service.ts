import { checkBudgetPermission } from './policy';
import * as repo from './repository';
import type {
  BudgetTransitionInput,
  CreateBudgetAllocationInput,
  ReallocateBudgetInput,
  VerifyKpiEvidenceInput,
} from './types';

export async function getBudgetReconciliation(role: string, tenantKey: string, annualPlanId: string) {
  checkBudgetPermission(role, 'commercial-budget:read');
  const result = await repo.getBudgetReconciliation(tenantKey, annualPlanId);
  return {
    ...result,
    permissions: {
      canManage: ['admin', 'cco', 'department_head'].includes(role),
      canApprove: ['admin', 'cco'].includes(role),
      canVerifyEvidence: ['admin', 'cco'].includes(role),
    },
  };
}

export async function createBudgetAllocation(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  input: CreateBudgetAllocationInput,
) {
  checkBudgetPermission(role, 'commercial-budget:manage');
  const approver = exceptionApprover(role, userId, input.allowOverAllocation);
  return repo.createBudgetAllocation(tenantKey, userId, approver, annualPlanId, input);
}

export async function reallocateBudget(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  allocationId: string,
  input: ReallocateBudgetInput,
) {
  checkBudgetPermission(role, 'commercial-budget:manage');
  const approver = exceptionApprover(role, userId, input.allowOverAllocation);
  return repo.reallocateBudget(
    tenantKey,
    userId,
    approver,
    annualPlanId,
    allocationId,
    input,
  );
}

export async function transitionBudgetAllocation(
  role: string,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  allocationId: string,
  target: 'approved' | 'committed' | 'archived',
  input: BudgetTransitionInput,
) {
  checkBudgetPermission(
    role,
    target === 'approved' || target === 'committed'
      ? 'commercial-budget:approve'
      : 'commercial-budget:manage',
  );
  return repo.transitionBudgetAllocation(
    tenantKey,
    userId,
    annualPlanId,
    allocationId,
    target,
    input,
  );
}

export async function verifyKpiEvidence(
  role: string,
  tenantKey: string,
  userId: string,
  kpiId: string,
  input: VerifyKpiEvidenceInput,
) {
  checkBudgetPermission(role, 'commercial-budget:verify-evidence');
  return repo.verifyKpiEvidence(tenantKey, userId, kpiId, input);
}

function exceptionApprover(role: string, userId: string, requested: boolean) {
  if (!requested) return null;
  checkBudgetPermission(role, 'commercial-budget:approve-exception');
  return userId;
}
