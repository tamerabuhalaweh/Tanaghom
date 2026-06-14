import { describe, it, expect } from 'vitest';
import { validateLoginInput } from '../validators';
import { ValidationError } from '@shared/errors';

describe('auth/validators', () => {
  it('accepts valid login input', () => {
    const result = validateLoginInput({ email: 'user@example.com', password: 'secret' });
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('secret');
  });

  it('rejects invalid email', () => {
    expect(() => validateLoginInput({ email: 'bad', password: 'secret' })).toThrow(ValidationError);
  });

  it('rejects empty password', () => {
    expect(() => validateLoginInput({ email: 'user@example.com', password: '' })).toThrow(ValidationError);
  });

  it('rejects missing fields', () => {
    expect(() => validateLoginInput({})).toThrow(ValidationError);
  });
});
