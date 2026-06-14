import { describe, it, expect } from 'vitest';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { signToken, verifyToken, hashPassword, comparePassword, requireRole } from '@shared/auth';
import type { JwtPayload } from '@shared/auth';

describe('auth service logic', () => {
  const testPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 'specialist',
    departmentId: 'dept-123',
  };

  describe('JWT token', () => {
    it('signs and verifies a token', () => {
      const token = signToken(testPayload);
      const decoded = verifyToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('specialist');
    });

    it('rejects invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow(UnauthorizedError);
    });
  });

  describe('password hashing', () => {
    it('hashes and compares password', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).not.toBe('mypassword');
      const match = await comparePassword('mypassword', hash);
      expect(match).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await hashPassword('mypassword');
      const match = await comparePassword('wrong', hash);
      expect(match).toBe(false);
    });
  });

  describe('requireRole middleware', () => {
    it('allows matching role', () => {
      const check = requireRole('admin', 'specialist');
      expect(() => check(testPayload)).not.toThrow();
    });

    it('blocks non-matching role', () => {
      const check = requireRole('admin', 'cco');
      expect(() => check(testPayload)).toThrow(ForbiddenError);
    });
  });
});
