import { ValidationError } from '@shared/errors';
import { type ZodTypeAny, type output } from 'zod';
import {
  budgetTransitionSchema,
  createBudgetAllocationSchema,
  reallocateBudgetSchema,
  verifyKpiEvidenceSchema,
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

export const validateCreateBudgetAllocation = (value: unknown) =>
  parse(createBudgetAllocationSchema, value);
export const validateReallocateBudget = (value: unknown) => parse(reallocateBudgetSchema, value);
export const validateBudgetTransition = (value: unknown) => parse(budgetTransitionSchema, value);
export const validateVerifyKpiEvidence = (value: unknown) =>
  parse(verifyKpiEvidenceSchema, value);
