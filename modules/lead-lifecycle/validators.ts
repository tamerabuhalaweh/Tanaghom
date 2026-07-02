import { validateOrThrow } from '@shared/validation';
import {
  createLeadSchema,
  updateLeadSchema,
  transitionLeadSchema,
  updateMeetingSchema,
  updatePurchaseSchema,
  setTemperatureSchema,
} from './types';

export function validateCreateLead(data: unknown) {
  return validateOrThrow(createLeadSchema, data);
}

export function validateUpdateLead(data: unknown) {
  return validateOrThrow(updateLeadSchema, data);
}

export function validateTransitionLead(data: unknown) {
  return validateOrThrow(transitionLeadSchema, data);
}

export function validateUpdateMeeting(data: unknown) {
  return validateOrThrow(updateMeetingSchema, data);
}

export function validateUpdatePurchase(data: unknown) {
  return validateOrThrow(updatePurchaseSchema, data);
}

export function validateSetTemperature(data: unknown) {
  return validateOrThrow(setTemperatureSchema, data);
}
