import { UnauthorizedError } from '@shared/errors';
import { logger } from '@shared/logging';
import { getRedisConnection } from '@shared/queue';
import type { JwtPayload } from './index';

const REVOCATION_PREFIX = 'tanaghum:auth:revoked:';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function shouldFailClosed(): boolean {
  return process.env.NODE_ENV === 'production';
}

function secondsUntilExpiry(payload: JwtPayload): number {
  if (!payload.exp) return DEFAULT_TTL_SECONDS;
  return Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
}

export async function revokeToken(payload: JwtPayload): Promise<boolean> {
  if (!payload.jti) return false;
  try {
    const redis = getRedisConnection();
    await redis.set(`${REVOCATION_PREFIX}${payload.jti}`, '1', 'EX', secondsUntilExpiry(payload));
    return true;
  } catch (err) {
    logger.error({ err, tokenIdPresent: true }, 'Failed to revoke JWT token');
    if (shouldFailClosed()) {
      throw new UnauthorizedError('Token revocation store is unavailable');
    }
    return false;
  }
}

export async function isTokenRevoked(payload: JwtPayload): Promise<boolean> {
  if (!payload.jti) return false;
  try {
    const redis = getRedisConnection();
    return await redis.get(`${REVOCATION_PREFIX}${payload.jti}`) === '1';
  } catch (err) {
    logger.error({ err, tokenIdPresent: true }, 'Failed to check JWT revocation state');
    if (shouldFailClosed()) {
      throw new UnauthorizedError('Token revocation store is unavailable');
    }
    return false;
  }
}

export async function assertTokenNotRevoked(payload: JwtPayload): Promise<void> {
  if (await isTokenRevoked(payload)) {
    throw new UnauthorizedError('Token has been revoked');
  }
}
