import { validateOrThrow } from '@shared/validation';
import {
  createEmailPlanSchema,
  updateEmailPlanSchema,
  createWhatsappPlanSchema,
  updateWhatsappPlanSchema,
  createUpsellPlanSchema,
  updateUpsellPlanSchema,
  createContentRequirementSchema,
  updateContentRequirementSchema,
  createSalesTaskSchema,
  updateSalesTaskSchema,
} from './types';

export function validateCreateEmailPlan(data: unknown) {
  return validateOrThrow(createEmailPlanSchema, data);
}

export function validateUpdateEmailPlan(data: unknown) {
  return validateOrThrow(updateEmailPlanSchema, data);
}

export function validateCreateWhatsappPlan(data: unknown) {
  return validateOrThrow(createWhatsappPlanSchema, data);
}

export function validateUpdateWhatsappPlan(data: unknown) {
  return validateOrThrow(updateWhatsappPlanSchema, data);
}

export function validateCreateUpsellPlan(data: unknown) {
  return validateOrThrow(createUpsellPlanSchema, data);
}

export function validateUpdateUpsellPlan(data: unknown) {
  return validateOrThrow(updateUpsellPlanSchema, data);
}

export function validateCreateContentRequirement(data: unknown) {
  return validateOrThrow(createContentRequirementSchema, data);
}

export function validateUpdateContentRequirement(data: unknown) {
  return validateOrThrow(updateContentRequirementSchema, data);
}

export function validateCreateSalesTask(data: unknown) {
  return validateOrThrow(createSalesTaskSchema, data);
}

export function validateUpdateSalesTask(data: unknown) {
  return validateOrThrow(updateSalesTaskSchema, data);
}
