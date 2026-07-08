import { auditLog } from '@shared/logging';
import { checkCommercialCenterPermission } from './policy';
import * as repo from './repository';
import type {
  CommercialAssessmentSignalSummary,
  CommercialCommandCenterDashboard,
  CommercialPlanSummary,
  CommercialRevenueLineSummary,
  CreateAssessmentSignalInput,
  CreateCommercialPlanInput,
  CreateRevenueLineInput,
  DashboardQueryInput,
  ListAssessmentSignalsQueryInput,
  ListPlansQueryInput,
} from './types';

export async function getCommercialCommandCenterDashboard(
  requesterRole: string,
  tenantKey: string,
  filters: DashboardQueryInput,
): Promise<CommercialCommandCenterDashboard> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:read');
  return repo.getDashboard(tenantKey, filters);
}

export async function listRevenueLines(
  requesterRole: string,
  tenantKey: string,
): Promise<CommercialRevenueLineSummary[]> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:read');
  return repo.listRevenueLines(tenantKey);
}

export async function createRevenueLine(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateRevenueLineInput,
): Promise<CommercialRevenueLineSummary> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:create');
  const line = await repo.createRevenueLine(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_revenue_line_upserted',
      object_type: 'commercial_revenue_line',
      object_id: line.id || line.revenueLineType,
      result: 'success',
    },
    `Commercial revenue line configured: ${line.name}`,
  );

  return line;
}

export async function listPlans(
  requesterRole: string,
  tenantKey: string,
  filters: ListPlansQueryInput,
): Promise<CommercialPlanSummary[]> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:read');
  return repo.listPlans(tenantKey, filters);
}

export async function createPlan(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateCommercialPlanInput,
): Promise<CommercialPlanSummary> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:create');
  const plan = await repo.createPlan(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_plan_created',
      object_type: 'commercial_plan',
      object_id: plan.id,
      result: 'success',
    },
    `Commercial plan created: ${plan.title}`,
  );

  return plan;
}

export async function listAssessmentSignals(
  requesterRole: string,
  tenantKey: string,
  filters: ListAssessmentSignalsQueryInput,
): Promise<CommercialAssessmentSignalSummary[]> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:read');
  return repo.listAssessmentSignals(tenantKey, filters);
}

export async function createAssessmentSignal(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateAssessmentSignalInput,
): Promise<CommercialAssessmentSignalSummary> {
  checkCommercialCenterPermission(requesterRole, 'commercial:center:create');
  const signal = await repo.createAssessmentSignal(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_assessment_signal_created',
      object_type: 'commercial_assessment_signal',
      object_id: signal.id,
      result: 'success',
    },
    `Commercial assessment signal created: ${signal.title}`,
  );

  return signal;
}
