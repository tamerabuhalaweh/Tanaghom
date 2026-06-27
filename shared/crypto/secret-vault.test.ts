import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, secretFingerprint } from './secret-vault';

const previousKey = process.env.LLM_CREDENTIAL_ENCRYPTION_KEY;
const previousSecretKey = process.env.SECRET_VAULT_ENCRYPTION_KEY;

afterEach(() => {
  process.env.LLM_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  process.env.SECRET_VAULT_ENCRYPTION_KEY = previousSecretKey;
});

describe('secret vault', () => {
  it('encrypts and decrypts without storing plaintext', () => {
    process.env.LLM_CREDENTIAL_ENCRYPTION_KEY = 'test-master-key-with-at-least-32-characters';
    const secret = 'sk-test-user-owned-provider-key';
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('requires a strong master key', () => {
    delete process.env.SECRET_VAULT_ENCRYPTION_KEY;
    process.env.LLM_CREDENTIAL_ENCRYPTION_KEY = 'short';
    expect(() => encryptSecret('secret-value')).toThrow(/SECRET_VAULT_ENCRYPTION_KEY/);
  });

  it('uses the general secret vault key when configured', () => {
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'general-secret-vault-key-with-at-least-32-characters';
    process.env.LLM_CREDENTIAL_ENCRYPTION_KEY = 'short';
    const encrypted = encryptSecret('tenant-integration-secret');
    expect(decryptSecret(encrypted)).toBe('tenant-integration-secret');
  });

  it('creates a stable non-secret fingerprint', () => {
    expect(secretFingerprint('same-secret')).toBe(secretFingerprint('same-secret'));
    expect(secretFingerprint('same-secret')).not.toBe(secretFingerprint('different-secret'));
  });
});
