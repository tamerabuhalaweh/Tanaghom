import { logger } from '@shared/logging';
import { processApprovedQueue } from './service';

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startGhlOperationsWorker(): void {
  if (process.env.GHL_OPERATION_WORKER_ENABLED !== 'true' || timer) return;
  const intervalMs = Number(process.env.GHL_OPERATION_WORKER_INTERVAL_MS || 10_000);
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processApprovedQueue();
      if (result.attempted || result.recovered) {
        logger.info(result, 'GHL operation worker completed a queue pass');
      }
    } catch (error) {
      logger.error({ error }, 'GHL operation worker queue pass failed');
    } finally {
      running = false;
    }
  };
  timer = setInterval(() => void tick(), Math.max(5_000, intervalMs));
  timer.unref();
  void tick();
}

export function stopGhlOperationsWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
