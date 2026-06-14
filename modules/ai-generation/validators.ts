import { validateOrThrow } from '@shared/validation';
import { generateDraftSchema, reviseDraftSchema } from './types';

export function validateGenerateDraft(data: unknown) {
  return validateOrThrow(generateDraftSchema, data);
}

export function validateReviseDraft(data: unknown) {
  return validateOrThrow(reviseDraftSchema, data);
}
