import { describe, expect, it } from 'vitest';
import { signToken } from './index';
import { resolveRateLimitCapacity, resolveRateLimitKey } from './rate-limit-key';

function token(sub: string, tenantKey: string): string {
  return signToken({
    sub,
    tenantKey,
    email: `${sub}@example.com`,
    role: 'marketing_manager',
  });
}

describe('rate limit key resolution', () => {
  it('isolates authenticated users sharing one public address', () => {
    const first = resolveRateLimitKey(`Bearer ${token('user-one', 'tenant-a')}`, '203.0.113.10');
    const second = resolveRateLimitKey(`Bearer ${token('user-two', 'tenant-a')}`, '203.0.113.10');

    expect(first).toBe('rate-limit:user:tenant-a:user-one');
    expect(second).toBe('rate-limit:user:tenant-a:user-two');
    expect(first).not.toBe(second);
  });

  it('isolates the same user identifier across tenants', () => {
    const first = resolveRateLimitKey(`Bearer ${token('manager', 'tenant-a')}`, '203.0.113.10');
    const second = resolveRateLimitKey(`Bearer ${token('manager', 'tenant-b')}`, '203.0.113.10');

    expect(first).not.toBe(second);
  });

  it('keeps unauthenticated and invalid sessions in the IP bucket', () => {
    expect(resolveRateLimitKey(undefined, '203.0.113.10')).toBe('rate-limit:ip:203.0.113.10');
    expect(resolveRateLimitKey('Bearer invalid-token', '203.0.113.10')).toBe('rate-limit:ip:203.0.113.10');
  });

  it('uses separate public and authenticated request capacities', () => {
    expect(resolveRateLimitCapacity('rate-limit:ip:203.0.113.10', 300, 1000)).toBe(300);
    expect(resolveRateLimitCapacity('rate-limit:user:tenant-a:user-one', 300, 1000)).toBe(1000);
  });
});
