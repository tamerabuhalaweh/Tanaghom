import { validateOrThrow } from '@shared/validation';
import { scoreDraftSchema, addRuleSchema } from './types';

export function validateScoreDraft(data: unknown) {
  return validateOrThrow(scoreDraftSchema, data);
}

export function validateAddRule(data: unknown) {
  return validateOrThrow(addRuleSchema, data);
}
