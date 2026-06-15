import { validateOrThrow } from '@shared/validation';
import { submitForApprovalSchema, approvalDecisionSchema, checkApprovalStatusSchema } from './types';

export function validateSubmitForApproval(data: unknown) {
  return validateOrThrow(submitForApprovalSchema, data);
}

export function validateApprovalDecision(data: unknown) {
  return validateOrThrow(approvalDecisionSchema, data);
}

export function validateCheckApprovalStatus(data: unknown) {
  return validateOrThrow(checkApprovalStatusSchema, data);
}
