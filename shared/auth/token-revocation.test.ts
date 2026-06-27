import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@shared/queue', () => ({
  getRedisConnection: () => redisMock,
}));

vi.mock('@shared/logging', () => ({
  logger: { error: vi.fn() },
}));

import { signToken, verifyToken } from './index';
import { assertTokenNotRevoked, isTokenRevoked, revokeToken } from './token-revocation';

describe('JWT token revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.set.mockResolvedValue('OK');
    redisMock.get.mockResolvedValue(null);
  });

  it('signs tokens with a revocable token id', () => {
    const token = signToken({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      tenantKey: 'tenant-a',
      agentRepId: 'agent-1',
    });

    expect(verifyToken(token).jti).toBeTruthy();
  });

  it('stores revoked token ids in Redis until token expiry', async () => {
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      jti: 'token-id-1',
      exp: Math.floor(Date.now() / 1000) + 300,
    };

    await expect(revokeToken(payload)).resolves.toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith('tanaghum:auth:revoked:token-id-1', '1', 'EX', expect.any(Number));
  });

  it('blocks a revoked token', async () => {
    redisMock.get.mockResolvedValue('1');
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      jti: 'token-id-2',
    };

    await expect(isTokenRevoked(payload)).resolves.toBe(true);
    await expect(assertTokenNotRevoked(payload)).rejects.toThrow(/revoked/);
  });
});
