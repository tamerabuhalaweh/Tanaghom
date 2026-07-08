import { validateOrThrow } from '@shared/validation';
import {
  createAssessmentSignalSchema,
  createCommercialPlanSchema,
  createRevenueLineSchema,
  dashboardQuerySchema,
  listAssessmentSignalsQuerySchema,
  listPlansQuerySchema,
  updateCommercialPlanSchema,
} from './types';

export function validateCreateRevenueLine(data: unknown) {
  return validateOrThrow(createRevenueLineSchema, data);
}

export function validateCreateCommercialPlan(data: unknown) {
  return validateOrThrow(createCommercialPlanSchema, data);
}

export function validateUpdateCommercialPlan(data: unknown) {
  return validateOrThrow(updateCommercialPlanSchema, data);
}

export function validateCreateAssessmentSignal(data: unknown) {
  return validateOrThrow(createAssessmentSignalSchema, data);
}

export function validateDashboardQuery(data: unknown) {
  return validateOrThrow(dashboardQuerySchema, data);
}

export function validateListPlansQuery(data: unknown) {
  return validateOrThrow(listPlansQuerySchema, data);
}

export function validateListAssessmentSignalsQuery(data: unknown) {
  return validateOrThrow(listAssessmentSignalsQuerySchema, data);
}
