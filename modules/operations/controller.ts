import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { checkDatabaseHealth } from '@shared/database';
import { checkRedisHealth } from '@shared/queue';
import { getEmailDeliveryStatus } from '@shared/notifications/email';
import { getTenantMfaCoverage } from '@modules/auth/mfa-service';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
    const tenantKey = payload.tenantKey || 'default';
    const [databaseHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    const email = getEmailDeliveryStatus();
    const mfaCoverage = await getTenantMfaCoverage(tenantKey);
    const backupStatus = getBackupStatus();
    const checks = [
      check('database', databaseHealthy, 'Database connection is healthy.'),
      check('redis', redisHealthy, 'Redis connection is healthy for queues, rate limiting, and token revocation.'),
      check('secret_vault_key', Boolean(process.env.SECRET_VAULT_ENCRYPTION_KEY || process.env.LLM_CREDENTIAL_ENCRYPTION_KEY), 'Secret vault encryption key is configured.'),
      check('jwt_secret', Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32), 'JWT secret is configured with minimum length.'),
      check('cors_origin', Boolean(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'), 'CORS origin is explicitly configured.'),
      check('request_body_limit', Boolean(process.env.REQUEST_BODY_LIMIT || true), `Request body limit is ${process.env.REQUEST_BODY_LIMIT || '1mb default'}.`),
      check('email_delivery', !process.env.EMAIL_DELIVERY_ENABLED || email.configured, email.configured ? 'Email delivery is configured.' : 'Email delivery is not configured.'),
      check('backup_target', backupStatus.configured, 'Database backup target is configured.'),
      check('backup_manifest', backupStatus.latestBackupFound, backupStatus.latestBackupFound ? 'Latest database backup manifest exists.' : 'No local backup manifest found yet.'),
      check('alert_webhook', Boolean(process.env.ALERT_WEBHOOK_URL || process.env.OPERATIONS_ALERT_EMAIL), 'Alert destination is configured.'),
      check('admin_mfa_coverage', mfaCoverage.coveragePct === 100, `Admin MFA coverage is ${mfaCoverage.coveragePct}%.`),
      check('ops_metrics_token', Boolean(process.env.OPERATIONS_METRICS_TOKEN && process.env.OPERATIONS_METRICS_TOKEN.length >= 24), 'Prometheus metrics scrape token is configured.'),
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
      tenantSecurity: {
        tenantKey,
        mfaCoverage,
      },
      backup: backupStatus,
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

operationsRouter.get('/backup/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    res.json({
      ...getBackupStatus(),
      rawSecretsReturned: false,
      _label: 'Database backup status. A scheduled job and restore drill are required before production go-live.',
    });
  } catch (err) {
    next(err);
  }
});

operationsRouter.get('/monitoring/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const hasMetricsToken = Boolean(process.env.OPERATIONS_METRICS_TOKEN && process.env.OPERATIONS_METRICS_TOKEN.length >= 24);
    const hasAlertDestination = Boolean(process.env.ALERT_WEBHOOK_URL || process.env.OPERATIONS_ALERT_EMAIL);
    res.json({
      prometheusMetrics: hasMetricsToken ? 'token_configured' : 'requires_token',
      alertDestination: hasAlertDestination ? 'configured' : 'missing',
      uptimeCheckTarget: process.env.PUBLIC_HEALTH_URL ? 'configured' : 'missing',
      expectedHealthPath: '/health',
      expectedReadinessPath: '/ops/readiness',
      expectedMetricsPath: '/ops/prometheus',
      rawSecretsReturned: false,
      _label: 'Monitoring configuration status. Deploy Prometheus/Grafana or an equivalent stack before production go-live.',
    });
  } catch (err) {
    next(err);
  }
});

operationsRouter.get('/prometheus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertMetricsToken(req);
    const [databaseHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    const memory = process.memoryUsage();
    const lines = [
      '# HELP tanaghum_backend_up Backend process availability.',
      '# TYPE tanaghum_backend_up gauge',
      'tanaghum_backend_up 1',
      '# HELP tanaghum_database_up Database health status.',
      '# TYPE tanaghum_database_up gauge',
      `tanaghum_database_up ${databaseHealthy ? 1 : 0}`,
      '# HELP tanaghum_redis_up Redis health status.',
      '# TYPE tanaghum_redis_up gauge',
      `tanaghum_redis_up ${redisHealthy ? 1 : 0}`,
      '# HELP tanaghum_process_uptime_seconds Node process uptime.',
      '# TYPE tanaghum_process_uptime_seconds gauge',
      `tanaghum_process_uptime_seconds ${Math.round(process.uptime())}`,
      '# HELP tanaghum_node_heap_used_bytes Node heap used.',
      '# TYPE tanaghum_node_heap_used_bytes gauge',
      `tanaghum_node_heap_used_bytes ${memory.heapUsed}`,
      '# HELP tanaghum_backup_latest_age_seconds Latest local backup age in seconds, or -1 if not found.',
      '# TYPE tanaghum_backup_latest_age_seconds gauge',
      `tanaghum_backup_latest_age_seconds ${getBackupStatus().latestBackupAgeSeconds ?? -1}`,
    ];
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(`${lines.join('\n')}\n`);
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

function getBackupStatus() {
  const backupDir = process.env.DATABASE_BACKUP_DIR || './backups/postgres';
  const storageTargetConfigured = Boolean(process.env.BACKUP_STORAGE_TARGET);
  const latestManifestPath = join(backupDir, 'latest.json');
  const latestManifest = readJsonIfExists(latestManifestPath);
  const latestDump = findLatestDump(backupDir);
  const latestBackupAt = stringOrNull(latestManifest?.timestamp) || latestDump?.createdAt || null;
  const latestBackupAgeSeconds = latestBackupAt ? Math.max(0, Math.round((Date.now() - new Date(latestBackupAt).getTime()) / 1000)) : null;
  return {
    configured: Boolean(process.env.DATABASE_BACKUP_DIR || process.env.BACKUP_STORAGE_TARGET),
    backupDirConfigured: Boolean(process.env.DATABASE_BACKUP_DIR),
    storageTargetConfigured,
    scheduleConfigured: Boolean(process.env.DATABASE_BACKUP_CRON),
    restoreDrillEvidenceConfigured: Boolean(process.env.LATEST_RESTORE_DRILL_AT),
    latestBackupFound: Boolean(latestManifest || latestDump),
    latestBackupAt,
    latestBackupAgeSeconds,
    latestManifestPath: latestManifest ? latestManifestPath : null,
    latestChecksumFound: Boolean(latestManifest?.checksumFile || latestDump?.checksumFile),
  };
}

function readJsonIfExists(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function findLatestDump(backupDir: string): { createdAt: string; checksumFile: string | null } | null {
  try {
    if (!existsSync(backupDir)) return null;
    const files = readdirSync(backupDir)
      .filter(file => file.endsWith('.dump'))
      .map(file => {
        const fullPath = join(backupDir, file);
        const stat = statSync(fullPath);
        return {
          file,
          createdAt: stat.mtime.toISOString(),
          mtimeMs: stat.mtimeMs,
          checksumFile: existsSync(`${fullPath}.sha256`) ? `${file}.sha256` : null,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files[0] || null;
  } catch {
    return null;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function assertMetricsToken(req: Request): void {
  const configured = process.env.OPERATIONS_METRICS_TOKEN;
  if (!configured || configured.length < 24) {
    throw new ForbiddenError('Operations metrics token is not configured');
  }
  const headerValue = req.header('x-ops-metrics-token') || '';
  const bearer = req.header('authorization')?.startsWith('Bearer ') ? req.header('authorization')?.substring(7) : '';
  if (headerValue !== configured && bearer !== configured) {
    throw new ForbiddenError('Invalid operations metrics token');
  }
}
