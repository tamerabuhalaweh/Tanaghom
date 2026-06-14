import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logging';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
    connection.on('connect', () => {
      logger.info('Redis connected');
    });
  }
  return connection;
}

export function checkRedisHealth(): Promise<boolean> {
  try {
    const conn = getRedisConnection();
    return conn.ping().then((result) => result === 'PONG');
  } catch {
    return Promise.resolve(false);
  }
}

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getRedisConnection() });
}

export function createWorker(
  name: string,
  processor: (job: unknown) => Promise<unknown>,
): Worker {
  return new Worker(name, processor, {
    connection: getRedisConnection(),
    concurrency: 5,
  });
}

export async function closeQueue(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
