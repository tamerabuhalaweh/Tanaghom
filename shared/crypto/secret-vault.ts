import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(cipherText: string): string {
  const key = getEncryptionKey();
  const [version, ivValue, tagValue, encryptedValue] = cipherText.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted secret format');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function secretFingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

function getEncryptionKey(): Buffer {
  const raw = process.env.SECRET_VAULT_ENCRYPTION_KEY || process.env.LLM_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('SECRET_VAULT_ENCRYPTION_KEY or LLM_CREDENTIAL_ENCRYPTION_KEY must be configured and at least 32 characters');
  }
  return createHash('sha256').update(raw).digest();
}
