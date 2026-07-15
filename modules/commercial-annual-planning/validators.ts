import { ValidationError } from '@shared/errors';
import { type ZodTypeAny, type output } from 'zod';
import {
  annualPlanTransitionSchema,
  archivePortfolioItemSchema,
  createAnnualPlanSchema,
  createPortfolioItemSchema,
  linkLearningSetsSchema,
  listAnnualPlansSchema,
  rejectAnnualPlanSchema,
  updateAnnualPlanSchema,
  updatePortfolioItemSchema,
} from './types';

function parse<T extends ZodTypeAny>(schema: T, value: unknown): output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        .join('; '),
    );
  }
  return result.data as output<T>;
}

export const validateListAnnualPlans = (value: unknown) => parse(listAnnualPlansSchema, value);
export const validateCreateAnnualPlan = (value: unknown) => parse(createAnnualPlanSchema, value);
export const validateUpdateAnnualPlan = (value: unknown) => parse(updateAnnualPlanSchema, value);
export const validateAnnualPlanTransition = (value: unknown) =>
  parse(annualPlanTransitionSchema, value);
export const validateRejectAnnualPlan = (value: unknown) => parse(rejectAnnualPlanSchema, value);
export const validateLinkLearningSets = (value: unknown) => parse(linkLearningSetsSchema, value);
export const validateCreatePortfolioItem = (value: unknown) =>
  parse(createPortfolioItemSchema, value);
export const validateUpdatePortfolioItem = (value: unknown) =>
  parse(updatePortfolioItemSchema, value);
export const validateArchivePortfolioItem = (value: unknown) =>
  parse(archivePortfolioItemSchema, value);
