import { describe, expect, it } from 'vitest';
import { generateRecoveryCodes, hashRecoveryCode } from '../mfa-service';

describe('auth/mfa-service recovery code helpers', () => {
  it('generates one-time recovery codes in a user-readable format', () => {
    const codes = generateRecoveryCodes(3);

    expect(codes).toHaveLength(3);
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    }
  });

  it('hashes recovery codes without depending on case', () => {
    const upper = hashRecoveryCode('user-1', 'AB12-CD34-EF56');
    const lower = hashRecoveryCode('user-1', 'ab12-cd34-ef56');

    expect(upper).toBe(lower);
    expect(upper).not.toContain('AB12');
  });
});
