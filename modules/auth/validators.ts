import { loginSchema } from './types';
import { validateOrThrow } from '@shared/validation';

export function validateLoginInput(data: unknown) {
  return validateOrThrow(loginSchema, data);
}
