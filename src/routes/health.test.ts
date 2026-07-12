import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const healthMocks = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn(),
  checkRedisHealth: vi.fn(),
}));

vi.mock('@shared/database', () => ({ checkDatabaseHealth: healthMocks.checkDatabaseHealth }));
vi.mock('@shared/queue', () => ({ checkRedisHealth: healthMocks.checkRedisHealth }));

import { healthCheck } from './health';

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('Health Check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports healthy only when both required stores are available', async () => {
    healthMocks.checkDatabaseHealth.mockResolvedValue(true);
    healthMocks.checkRedisHealth.mockResolvedValue(true);
    const res = response();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'healthy',
      services: { app: 'up', database: 'up', redis: 'up' },
    }));
  });

  it.each([
    [false, true, { database: 'down', redis: 'up' }],
    [true, false, { database: 'up', redis: 'down' }],
    [false, false, { database: 'down', redis: 'down' }],
  ])('reports degraded when database=%s and redis=%s', async (databaseHealthy, redisHealthy, services) => {
    healthMocks.checkDatabaseHealth.mockResolvedValue(databaseHealthy);
    healthMocks.checkRedisHealth.mockResolvedValue(redisHealthy);
    const res = response();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'degraded',
      services: { app: 'up', ...services },
    }));
  });
});
