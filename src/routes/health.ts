import { Request, Response } from 'express';
import { checkDatabaseHealth } from '@shared/database';
import { checkRedisHealth } from '@shared/queue';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await checkRedisHealth();

  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      app: 'up',
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
}
