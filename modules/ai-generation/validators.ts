import { validateOrThrow } from '@shared/validation';
import { generateDraftSchema, reviseDraftSchema, saveEditedDraftSchema } from './types';

export function validateGenerateDraft(data: unknown) {
  return validateOrThrow(generateDraftSchema, data);
}

export function validateReviseDraft(data: unknown) {
  return validateOrThrow(reviseDraftSchema, data);
}

export function validateSaveEditedDraft(data: unknown) {
  return validateOrThrow(saveEditedDraftSchema, data);
}
