import { createHash, createPublicKey, createVerify, verify } from 'node:crypto';
import { UnauthorizedError } from '@shared/errors';

export const DEFAULT_GHL_WEBHOOK_PUBLIC_KEY = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=',
  '-----END PUBLIC KEY-----',
].join('\n');

export function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function assertValidGhlWebhookSignature(rawBody: Buffer, signatureHeader: string): void {
  const signature = decodeSignature(signatureHeader);
  const publicKey = createPublicKey(
    process.env.GHL_WEBHOOK_PUBLIC_KEY || DEFAULT_GHL_WEBHOOK_PUBLIC_KEY,
  );
  const valid = verify(null, rawBody, publicKey, signature);
  if (!valid) throw new UnauthorizedError('Invalid GoHighLevel webhook signature');
}

export function assertValidLegacyGhlWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
): void {
  const configuredKey = process.env.GHL_LEGACY_WEBHOOK_PUBLIC_KEY;
  if (!configuredKey) {
    throw new UnauthorizedError('Legacy GoHighLevel webhook verification is not configured');
  }
  const verifier = createVerify('SHA256');
  verifier.update(rawBody);
  verifier.end();
  const valid = verifier.verify(configuredKey, signatureHeader.trim(), 'base64');
  if (!valid) throw new UnauthorizedError('Invalid legacy GoHighLevel webhook signature');
}

function decodeSignature(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[a-f0-9]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'base64');
}
