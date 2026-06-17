import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@shared/logging';
import { connectDatabase, disconnectDatabase } from '@shared/database';
import { closeQueue } from '@shared/queue';
import { validateEnvironment, isDemoMode } from './env-validation';
import { healthCheck } from './routes/health';
import { authRouter } from '../modules/auth/controller';
import { usersDepartmentsRouter } from '../modules/users-departments/controller';
import { campaignsRouter } from '../modules/campaigns/controller';
import { aiGenerationRouter } from '../modules/ai-generation/controller';
import { algoRouter } from '../modules/algorithm-intelligence/controller';

// Validate environment before startup
const envValidation = validateEnvironment();
if (!envValidation.valid) {
  logger.error({ errors: envValidation.errors }, 'Environment validation failed');
  process.exit(1);
}
if (envValidation.warnings.length > 0) {
  logger.warn({ warnings: envValidation.warnings }, 'Environment warnings');
}

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting (simple in-memory for demo)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    next();
    return;
  }

  if (limit.count >= 100) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  limit.count++;
  next();
}
app.use(rateLimit);

// Demo mode header
if (isDemoMode()) {
  app.use((req, res, next) => {
    res.setHeader('X-Demo-Mode', 'true');
    res.setHeader('X-M5-Blocked', 'true');
    res.setHeader('X-External-Execution', 'disabled');
    next();
  });
}

// Routes
app.get('/health', healthCheck);
app.use('/auth', authRouter);
app.use('/', usersDepartmentsRouter);
app.use('/campaigns', campaignsRouter);
app.use('/ai-generation', aiGenerationRouter);
app.use('/algo', algoRouter);

// Error handler (must be last) — no stack traces in production/demo
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

async function start(): Promise<void> {
  try {
    await connectDatabase();
    logger.info('Database connected');

    if (isDemoMode()) {
      logger.info('DEMO MODE — All live integrations disabled, M5 execution blocked');
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
