import { validateOrThrow } from '@shared/validation';
import {
  createExecutiveReportPreviewSchema,
  createExecutiveReportScheduleSchema,
  executiveDashboardQuerySchema,
  listExecutiveReportsQuerySchema,
  listExecutiveReportSchedulesQuerySchema,
} from './types';

export function validateExecutiveDashboardQuery(data: unknown) {
  return validateOrThrow(executiveDashboardQuerySchema, data);
}

export function validateCreateExecutiveReportPreview(data: unknown) {
  return validateOrThrow(createExecutiveReportPreviewSchema, data);
}

export function validateListExecutiveReportsQuery(data: unknown) {
  return validateOrThrow(listExecutiveReportsQuerySchema, data);
}

export function validateCreateExecutiveReportSchedule(data: unknown) {
  return validateOrThrow(createExecutiveReportScheduleSchema, data);
}

export function validateListExecutiveReportSchedulesQuery(data: unknown) {
  return validateOrThrow(listExecutiveReportSchedulesQuerySchema, data);
}
