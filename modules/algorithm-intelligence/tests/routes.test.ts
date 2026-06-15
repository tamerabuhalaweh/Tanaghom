import { describe, it, expect } from 'vitest';
import { signToken } from '@shared/auth';
import { algoRouter } from '../controller';

describe('Algorithm Intelligence Routes', () => {
  it('algo router is defined and is an Express router', () => {
    expect(algoRouter).toBeDefined();
    expect(typeof algoRouter).toBe('function');
  });

  it('token generation works for route testing', () => {
    const token = signToken({
      sub: 'test-user-id',
      email: 'test@example.com',
      role: 'admin',
    });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});
