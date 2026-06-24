import { validateOrThrow } from '@shared/validation';
import {
  createUserSchema,
  updateUserSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createAgentRepSchema,
  updateAgentRepSchema,
  createFunctionalAgentSchema,
  createGovernanceAgentSchema,
} from './types';

export function validateCreateUser(data: unknown) {
  return validateOrThrow(createUserSchema, data);
}

export function validateUpdateUser(data: unknown) {
  return validateOrThrow(updateUserSchema, data);
}

export function validateCreateDepartment(data: unknown) {
  return validateOrThrow(createDepartmentSchema, data);
}

export function validateUpdateDepartment(data: unknown) {
  return validateOrThrow(updateDepartmentSchema, data);
}

export function validateCreateAgentRep(data: unknown) {
  return validateOrThrow(createAgentRepSchema, data);
}

export function validateUpdateAgentRep(data: unknown) {
  return validateOrThrow(updateAgentRepSchema, data);
}

export function validateCreateFunctionalAgent(data: unknown) {
  return validateOrThrow(createFunctionalAgentSchema, data);
}

export function validateCreateGovernanceAgent(data: unknown) {
  return validateOrThrow(createGovernanceAgentSchema, data);
}
