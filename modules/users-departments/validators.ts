import { validateOrThrow } from '@shared/validation';
import { createUserSchema, updateUserSchema, createDepartmentSchema, updateDepartmentSchema } from './types';

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
