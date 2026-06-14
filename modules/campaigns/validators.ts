import { validateOrThrow } from '@shared/validation';
import { createCampaignSchema, updateCampaignSchema, transitionSchema } from './types';

export function validateCreateCampaign(data: unknown) {
  return validateOrThrow(createCampaignSchema, data);
}

export function validateUpdateCampaign(data: unknown) {
  return validateOrThrow(updateCampaignSchema, data);
}

export function validateTransition(data: unknown) {
  return validateOrThrow(transitionSchema, data);
}
