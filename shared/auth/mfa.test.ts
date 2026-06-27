import { describe, expect, it } from 'vitest';
import { buildTotpOtpAuthUrl, generateTotpSecret, verifyTotpCode } from './mfa';

describe('TOTP MFA utilities', () => {
  it('generates base32 TOTP secrets', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]+$/);
  });

  it('builds otpauth URLs without exposing anything except the one-time setup secret', () => {
    const url = buildTotpOtpAuthUrl({
      issuer: 'Tanaghum',
      accountName: 'admin@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('issuer=Tanaghum');
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
  });

  it('verifies RFC 6238 compatible TOTP codes', () => {
    // Base32 for "12345678901234567890"; expected code at Unix time 59 is 287082.
    expect(verifyTotpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true);
    expect(verifyTotpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000)).toBe(false);
  });
});
