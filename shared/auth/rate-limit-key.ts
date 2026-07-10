import { verifyToken } from './index';

function keySegment(value: string): string {
  return encodeURIComponent(value.trim() || 'unknown');
}

export function resolveRateLimitKey(authorization: string | undefined, remoteAddress: string | undefined): string {
  if (authorization?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authorization.substring(7));
      if (payload.sub) {
        return `rate-limit:user:${keySegment(payload.tenantKey || 'default')}:${keySegment(payload.sub)}`;
      }
    } catch {
      // Invalid sessions stay in the public IP bucket and are rejected by auth middleware.
    }
  }

  return `rate-limit:ip:${keySegment(remoteAddress || 'unknown')}`;
}

export function resolveRateLimitCapacity(key: string, publicCapacity: number, authenticatedCapacity: number): number {
  return key.startsWith('rate-limit:user:') ? authenticatedCapacity : publicCapacity;
}
