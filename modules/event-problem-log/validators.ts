import { validateOrThrow } from '@shared/validation';
import { createProblemSchema, updateProblemSchema, transitionProblemSchema } from './types';

export function validateCreateProblem(data: unknown) {
  return validateOrThrow(createProblemSchema, data);
}

export function validateUpdateProblem(data: unknown) {
  return validateOrThrow(updateProblemSchema, data);
}

export function validateTransitionProblem(data: unknown) {
  return validateOrThrow(transitionProblemSchema, data);
}
