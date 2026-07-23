import { validateOrThrow } from '@shared/validation';
import {
  approveAttributionMappingSchema,
  createAttributionMappingSchema,
  listAttributionMappingsSchema,
  previewAttributionMatchSchema,
  updateAttributionMappingSchema,
} from './types';
import type {
  ApproveAttributionMappingInput,
  CreateAttributionMappingInput,
  ListAttributionMappingsInput,
  PreviewAttributionMatchInput,
  UpdateAttributionMappingInput,
} from './types';

export const validateListAttributionMappings = (value: unknown) =>
  validateOrThrow(listAttributionMappingsSchema, value) as ListAttributionMappingsInput;
export const validateCreateAttributionMapping = (value: unknown) =>
  validateOrThrow(createAttributionMappingSchema, value) as CreateAttributionMappingInput;
export const validateUpdateAttributionMapping = (value: unknown) =>
  validateOrThrow(updateAttributionMappingSchema, value) as UpdateAttributionMappingInput;
export const validateApproveAttributionMapping = (value: unknown) =>
  validateOrThrow(approveAttributionMappingSchema, value) as ApproveAttributionMappingInput;
export const validatePreviewAttributionMatch = (value: unknown) =>
  validateOrThrow(previewAttributionMatchSchema, value) as PreviewAttributionMatchInput;
