import { validateOrThrow } from '@shared/validation';
import {
  createEventSchema,
  updateEventSchema,
  updateStrategySchema,
  transitionEventSchema,
  linkCampaignSchema,
  linkLeadSchema,
  createKpiRecordSchema,
  updateKpiRecordSchema,
} from './types';

export function validateCreateEvent(data: unknown) {
  return validateOrThrow(createEventSchema, data);
}

export function validateUpdateEvent(data: unknown) {
  return validateOrThrow(updateEventSchema, data);
}

export function validateUpdateStrategy(data: unknown) {
  return validateOrThrow(updateStrategySchema, data);
}

export function validateTransitionEvent(data: unknown) {
  return validateOrThrow(transitionEventSchema, data);
}

export function validateLinkCampaign(data: unknown) {
  return validateOrThrow(linkCampaignSchema, data);
}

export function validateLinkLead(data: unknown) {
  return validateOrThrow(linkLeadSchema, data);
}

export function validateCreateKpiRecord(data: unknown) {
  return validateOrThrow(createKpiRecordSchema, data);
}

export function validateUpdateKpiRecord(data: unknown) {
  return validateOrThrow(updateKpiRecordSchema, data);
}
