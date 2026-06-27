import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { checkDatabaseHealth } from '@shared/database';
import { checkRedisHealth } from '@shared/queue';
import { getEmailDeliveryStatus } from '@shared/notifications/email';

export const operationsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireAdmin(role: string): void {
  if (role !== 'admin' && role !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required');
  }
}

operationsRouter.get('/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const [databaseHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    const email = getEmailDeliveryStatus();
    const checks = [
      check('database', databaseHealthy, 'Database connection is healthy.'),
      check('redis', redisHealthy, 'Redis connection is healthy for queues, rate limiting, and token revocation.'),
      check('secret_vault_key', Boolean(process.env.SECRET_VAULT_ENCRYPTION_KEY || process.env.LLM_CREDENTIAL_ENCRYPTION_KEY), 'Secret vault encryption key is configured.'),
      check('jwt_secret', Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32), 'JWT secret is configured with minimum length.'),
      check('cors_origin', Boolean(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'), 'CORS origin is explicitly configured.'),
      check('request_body_limit', Boolean(process.env.REQUEST_BODY_LIMIT || true), `Request body limit is ${process.env.REQUEST_BODY_LIMIT || '1mb default'}.`),
      check('email_delivery', !process.env.EMAIL_DELIVERY_ENABLED || email.configured, email.configured ? 'Email delivery is configured.' : 'Email delivery is not configured.'),
      check('backup_target', Boolean(process.env.DATABASE_BACKUP_DIR || process.env.BACKUP_STORAGE_TARGET), 'Database backup target is configured.'),
      check('alert_webhook', Boolean(process.env.ALERT_WEBHOOK_URL || process.env.OPERATIONS_ALERT_EMAIL), 'Alert destination is configured.'),
    ];
    const failed = checks.filter(item => !item.passed);
    const criticalFailed = failed.filter(item => ['database', 'redis', 'secret_vault_key', 'jwt_secret', 'cors_origin'].includes(item.id));
    res.status(criticalFailed.length ? 503 : 200).json({
      status: criticalFailed.length ? 'not_ready' : failed.length ? 'needs_attention' : 'ready',
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        passed: checks.length - failed.length,
        failed: failed.length,
        criticalFailed: criticalFailed.length,
      },
      _label: 'Production operations readiness report',
    });
  } catch (err) {
    next(err);
  }
});

operationsRouter.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const memory = process.memoryUsage();
    res.json({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      nodeEnv: process.env.NODE_ENV || 'development',
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
      _label: 'Backend runtime metrics snapshot',
    });
  } catch (err) {
    next(err);
  }
});

function check(id: string, passed: boolean, message: string) {
  return {
    id,
    passed,
    status: passed ? 'passed' : 'attention_required',
    message,
  };
}
