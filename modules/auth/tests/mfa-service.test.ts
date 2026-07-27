import { describe, expect, it } from 'vitest';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  privilegedMfaDisableAllowed,
  requiresPrivilegedMfaEnrollment,
} from '../mfa-service';

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

  it('requires privileged production roles to enroll when MFA is missing', () => {
    const production = { NODE_ENV: 'production', MFA_ENFORCE_PRIVILEGED_ENROLLMENT: undefined };

    expect(requiresPrivilegedMfaEnrollment('admin', false, production)).toBe(true);
    expect(requiresPrivilegedMfaEnrollment('cco', false, production)).toBe(true);
    expect(requiresPrivilegedMfaEnrollment('department_head', false, production)).toBe(true);
    expect(requiresPrivilegedMfaEnrollment('specialist', false, production)).toBe(false);
    expect(requiresPrivilegedMfaEnrollment('admin', true, production)).toBe(false);
  });

  it('supports an explicit non-production enrollment rollout flag', () => {
    const rollout = { NODE_ENV: 'test', MFA_ENFORCE_PRIVILEGED_ENROLLMENT: 'true' };
    const disabled = { NODE_ENV: 'production', MFA_ENFORCE_PRIVILEGED_ENROLLMENT: 'false' };

    expect(requiresPrivilegedMfaEnrollment('admin', false, rollout)).toBe(true);
    expect(requiresPrivilegedMfaEnrollment('admin', false, disabled)).toBe(false);
  });

  it('blocks privileged MFA disable in production without an emergency override', () => {
    expect(privilegedMfaDisableAllowed('admin', { NODE_ENV: 'production', MFA_ALLOW_PRIVILEGED_DISABLE: undefined })).toBe(false);
    expect(privilegedMfaDisableAllowed('cco', { NODE_ENV: 'production', MFA_ALLOW_PRIVILEGED_DISABLE: 'true' })).toBe(true);
    expect(privilegedMfaDisableAllowed('specialist', { NODE_ENV: 'production', MFA_ALLOW_PRIVILEGED_DISABLE: undefined })).toBe(true);
  });
});
