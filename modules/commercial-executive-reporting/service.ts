import { auditLog } from '@shared/logging';
import { checkExecutiveReportingPermission } from './policy';
import * as repo from './repository';
import type {
  CreateExecutiveReportPreviewInput,
  CreateExecutiveReportScheduleInput,
  ExecutiveDashboard,
  ExecutiveReportScheduleSummary,
  ExecutiveReportSummary,
  ListExecutiveReportsQueryInput,
  ListExecutiveReportSchedulesQueryInput,
  ExecutiveDashboardQueryInput,
} from './types';

export async function getDashboard(
  requesterRole: string,
  tenantKey: string,
  filters: ExecutiveDashboardQueryInput,
): Promise<ExecutiveDashboard> {
  checkExecutiveReportingPermission(requesterRole, 'commercial:executive:read');
  return repo.getExecutiveDashboard(tenantKey, filters);
}

export async function listReports(
  requesterRole: string,
  tenantKey: string,
  filters: ListExecutiveReportsQueryInput,
): Promise<ExecutiveReportSummary[]> {
  checkExecutiveReportingPermission(requesterRole, 'commercial:executive:read');
  return repo.listReports(tenantKey, filters);
}

export async function createReportPreview(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateExecutiveReportPreviewInput,
): Promise<ExecutiveReportSummary> {
  checkExecutiveReportingPermission(requesterRole, 'commercial:executive:report');
  const report = await repo.createReportPreview(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_executive_report_preview_created',
      object_type: 'commercial_executive_report',
      object_id: report.id,
      result: 'success',
    },
    `Commercial executive report preview created: ${report.title}`,
  );

  return report;
}

export async function listSchedules(
  requesterRole: string,
  tenantKey: string,
  filters: ListExecutiveReportSchedulesQueryInput,
): Promise<ExecutiveReportScheduleSummary[]> {
  checkExecutiveReportingPermission(requesterRole, 'commercial:executive:read');
  return repo.listSchedules(tenantKey, filters);
}

export async function createSchedule(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateExecutiveReportScheduleInput,
): Promise<ExecutiveReportScheduleSummary> {
  checkExecutiveReportingPermission(requesterRole, 'commercial:executive:schedule');
  const schedule = await repo.createSchedule(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_executive_report_schedule_created',
      object_type: 'commercial_executive_report_schedule',
      object_id: schedule.id,
      result: 'success',
    },
    `Commercial executive report schedule created: ${schedule.cadence}`,
  );

  return schedule;
}
