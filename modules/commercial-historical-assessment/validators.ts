import { validateOrThrow } from '@shared/validation';
import {
  createAssessmentRunSchema,
  decideAssessmentFindingSchema,
  listAssessmentRunsSchema,
  previewAssessmentSchema,
  type AssessmentScopeInput,
  type CreateAssessmentRunInput,
  type DecideAssessmentFindingInput,
  type ListAssessmentRunsInput,
} from './types';

export const validateAssessmentPreview = (value: unknown): AssessmentScopeInput =>
  validateOrThrow(previewAssessmentSchema, value) as AssessmentScopeInput;
export const validateCreateAssessmentRun = (value: unknown): CreateAssessmentRunInput =>
  validateOrThrow(createAssessmentRunSchema, value) as CreateAssessmentRunInput;
export const validateListAssessmentRuns = (value: unknown): ListAssessmentRunsInput =>
  validateOrThrow(listAssessmentRunsSchema, value);
export const validateAssessmentFindingDecision = (value: unknown): DecideAssessmentFindingInput =>
  validateOrThrow(decideAssessmentFindingSchema, value);
