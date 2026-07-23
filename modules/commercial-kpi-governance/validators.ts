import { validateOrThrow } from '@shared/validation';
import {
  amendKpiTargetSchema,
  createKpiTargetSchema,
  eventCapacitySchema,
  listKpiTargetsSchema,
  transitionKpiTargetSchema,
  updateKpiTargetSchema,
} from './types';

export const validateListKpiTargets = (input: unknown) =>
  validateOrThrow(listKpiTargetsSchema, input);
export const validateCreateKpiTarget = (input: unknown) =>
  validateOrThrow(createKpiTargetSchema, input);
export const validateUpdateKpiTarget = (input: unknown) =>
  validateOrThrow(updateKpiTargetSchema, input);
export const validateTransitionKpiTarget = (input: unknown) =>
  validateOrThrow(transitionKpiTargetSchema, input);
export const validateAmendKpiTarget = (input: unknown) =>
  validateOrThrow(amendKpiTargetSchema, input);
export const validateEventCapacity = (input: unknown) =>
  validateOrThrow(eventCapacitySchema, input);

