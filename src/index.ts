import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { logger } from '@shared/logging';
import { connectDatabase, disconnectDatabase } from '@shared/database';
import { closeQueue, getRedisConnection } from '@shared/queue';
import { verifyToken } from '@shared/auth';
import { assertTokenNotRevoked } from '@shared/auth/token-revocation';
import { validateEnvironment, isDemoMode, assertDemoSafe } from './env-validation';
import { healthCheck } from './routes/health';
import { AppError } from '../shared/errors';
import { authRouter } from '../modules/auth/controller';
import { usersDepartmentsRouter } from '../modules/users-departments/controller';
import { campaignsRouter } from '../modules/campaigns/controller';
import { aiGenerationRouter } from '../modules/ai-generation/controller';
import { algoRouter } from '../modules/algorithm-intelligence/controller';
import { approvalsRouter } from '../modules/approvals/controller';
import { publishingPrepRouter } from '../modules/publishing-preparation/controller';
import { analyticsRouter } from '../modules/analytics-reporting/controller';
import { spineRouter } from '../modules/spine/controller';
import { observabilityRouter } from '../modules/observability/controller';
import { aiProviderRouter } from '../modules/ai-provider/controller';
import { mcpMediationRouter } from '../modules/mcp-mediation/controller';
import { demoRouter } from '../modules/demo/controller';
import { publishingPackageRouter } from '../modules/publishing-package/controller';
import { crmConversionRouter } from '../modules/crm-conversion/controller';
import { postizIntegrationRouter } from '../modules/postiz-integration/controller';
import { integrationStatusRouter } from '../modules/integration-status/controller';
import { adminUsersRouter } from '../modules/admin-users/controller';
import { integrationsRouter } from '../modules/integrations/controller';
import { ghlRouter } from '../modules/ghl-connector/controller';
import { ideasRouter } from '../modules/ideas/controller';
import { integrationCredentialsRouter } from '../modules/integration-credentials/controller';
import { socialOAuthRouter } from '../modules/social-oauth/controller';
import { runtimeBridgesRouter } from '../modules/runtime-bridges/controller';
import { commercialWorkflowRouter } from '../modules/commercial-workflow/controller';
import { tenantAdminRouter } from '../modules/tenant-admin/controller';
import { operationsRouter } from '../modules/operations/controller';
import { smartLabsVoiceRouter } from '../modules/smartlabs-voice/controller';
import { socialGrowthRouter } from '../modules/social-growth/controller';
import { commercialEventsRouter } from '../modules/commercial-events/controller';
import { eventCampaignPlannerRouter } from '../modules/event-campaign-planner/controller';
import { leadLifecycleRouter } from '../modules/lead-lifecycle/controller';
import { masterEventAggregationRouter } from '../modules/master-event-aggregation/controller';
import { eventProblemLogRouter } from '../modules/event-problem-log/controller';
import { eventCloseoutRouter } from '../modules/event-closeout/controller';
import { connectorImportsRouter } from '../modules/connector-imports/controller';
import { learningRecommendationsRouter } from '../modules/learning-recommendations/controller';
import { connectorFieldMappingRouter } from '../modules/connector-field-mapping/controller';
import { csvImportRouter } from '../modules/csv-import/controller';
import { connectorReadinessRouter } from '../modules/connector-readiness/controller';
import { postizChannelRouter } from '../modules/postiz-channel-selection/controller';

const envValidation = validateEnvironment();
if (!envValidation.valid) {
  logger.error({ errors: envValidation.errors }, 'Environment validation failed');
  process.exit(1);
}
if (envValidation.warnings.length > 0) {
  logger.warn({ warnings: envValidation.warnings }, 'Environment warnings');
}

assertDemoSafe();

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';
const RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const allowedCorsOrigins = CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);

const app = express();

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

function requestIdMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && /^[a-zA-Z0-9._:-]{8,120}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }, 'HTTP request completed');
  });
  next();
}

function enforceOrigin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.header('origin');
  if (origin && !allowedCorsOrigins.includes(origin)) {
    res.status(403).json({
      error: 'Request origin is not allowed',
      code: 'ORIGIN_NOT_ALLOWED',
      requestId: req.requestId,
    });
    return;
  }
  next();
}

const memoryRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function memoryRateLimit(key: string, now: number): { allowed: boolean; retryAfterSeconds: number } {
  const limit = memoryRateLimitMap.get(key);
  if (!limit || now > limit.resetAt) {
    memoryRateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 });
    return { allowed: true, retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS };
  }
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((limit.resetAt - now) / 1000) };
  }
  limit.count++;
  return { allowed: true, retryAfterSeconds: Math.ceil((limit.resetAt - now) / 1000) };
}

async function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const key = `rate-limit:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  const now = Date.now();
  try {
    if (process.env.NODE_ENV === 'test' || process.env.REDIS_RATE_LIMIT_DISABLED === 'true') {
      const decision = memoryRateLimit(key, now);
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED', requestId: req.requestId });
        return;
      }
      next();
      return;
    }

    const redis = getRedisConnection();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > RATE_LIMIT_MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      res.setHeader('Retry-After', String(Math.max(ttl, 1)));
      res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED', requestId: req.requestId });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err, requestId: req.requestId }, 'Rate limiter unavailable');
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'Rate limiter unavailable', code: 'RATE_LIMIT_UNAVAILABLE', requestId: req.requestId });
      return;
    }
    const decision = memoryRateLimit(key, now);
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED', requestId: req.requestId });
      return;
    }
    next();
  }
}

async function enforceTokenRevocation(req: express.Request, _res: express.Response, next: express.NextFunction): Promise<void> {
  try {
    if (req.path === '/ops/prometheus') {
      next();
      return;
    }
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.substring(7));
      await assertTokenNotRevoked(payload);
    }
    next();
  } catch (err) {
    next(err);
  }
}

app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(cors({
  origin: allowedCorsOrigins.length > 1 ? allowedCorsOrigins : CORS_ORIGIN,
  credentials: true,
}));
app.use(enforceOrigin);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(rateLimit);
app.use(enforceTokenRevocation);

if (isDemoMode()) {
  app.use((req, res, next) => {
    res.setHeader('X-Demo-Mode', 'true');
    res.setHeader('X-M5-Blocked', 'true');
    res.setHeader('X-External-Execution', 'disabled');
    next();
  });
}

app.get('/health', healthCheck);
app.use('/auth', authRouter);
app.use('/', usersDepartmentsRouter);
app.use('/campaigns', campaignsRouter);
app.use('/ai-generation', aiGenerationRouter);
app.use('/algo', algoRouter);
app.use('/approvals', approvalsRouter);
app.use('/publishing-prep', publishingPrepRouter);
app.use('/analytics', analyticsRouter);
app.use('/spine', spineRouter);
app.use('/observability', observabilityRouter);
app.use('/ai-provider', aiProviderRouter);
app.use('/mcp-runtime', mcpMediationRouter);
app.use('/demo', demoRouter);
app.use('/publishing-package', publishingPackageRouter);
app.use('/crm-conversion', crmConversionRouter);
app.use('/postiz', postizIntegrationRouter);
app.use('/integration-status', integrationStatusRouter);
app.use('/integration-credentials', integrationCredentialsRouter);
app.use('/social-oauth', socialOAuthRouter);
app.use('/runtime-bridges', runtimeBridgesRouter);
app.use('/commercial-workflow', commercialWorkflowRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/tenant', tenantAdminRouter);
app.use('/ops', operationsRouter);
app.use('/smartlabs', smartLabsVoiceRouter);
app.use('/social-growth', socialGrowthRouter);
app.use('/integrations', integrationsRouter);
app.use('/ghl', ghlRouter);
app.use('/ideas', ideasRouter);
app.use('/events', commercialEventsRouter);
app.use('/commercial-events', commercialEventsRouter);
app.use('/planner', eventCampaignPlannerRouter);
app.use('/leads', leadLifecycleRouter);
app.use('/master-events', masterEventAggregationRouter);
app.use('/event-problems', eventProblemLogRouter);
app.use('/closeout', eventCloseoutRouter);
app.use('/connector-imports', connectorImportsRouter);
app.use('/learning-recommendations', learningRecommendationsRouter);
app.use('/connector-mappings', connectorFieldMappingRouter);
app.use('/csv-import', csvImportRouter);
app.use('/connector-readiness', connectorReadinessRouter);
app.use('/postiz-channels', postizChannelRouter);

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    const logPayload = { code: err.code, statusCode: err.statusCode, path: req.path, requestId: req.requestId };
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, requestId: req.requestId }, 'Operational server error');
    } else {
      logger.warn(logPayload, 'Request blocked by application policy');
    }
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId: req.requestId,
    });
    return;
  }

  logger.error({ err, path: req.path, requestId: req.requestId }, 'Unhandled server error');
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
  });
});

async function start(): Promise<void> {
  try {
    await connectDatabase();
    logger.info('Database connected');

    if (isDemoMode()) {
      logger.info('DEMO MODE - All live integrations disabled, M5 execution blocked');
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  await disconnectDatabase();
  await closeQueue();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export default app;
