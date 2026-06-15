import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@shared/logging';
import { connectDatabase, disconnectDatabase } from '@shared/database';
import { closeQueue } from '@shared/queue';
import { healthCheck } from './routes/health';
import { errorHandler } from './routes/errorHandler';
import { authRouter } from '../modules/auth/controller';
import { usersDepartmentsRouter } from '../modules/users-departments/controller';
import { campaignsRouter } from '../modules/campaigns/controller';
import { aiGenerationRouter } from '../modules/ai-generation/controller';
import { algoRouter } from '../modules/algorithm-intelligence/controller';
import { approvalsRouter } from '../modules/approvals/controller';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', healthCheck);
app.use('/auth', authRouter);
app.use('/', usersDepartmentsRouter);
app.use('/campaigns', campaignsRouter);
app.use('/ai-generation', aiGenerationRouter);
app.use('/algo', algoRouter);
app.use('/approvals', approvalsRouter);

// Error handler (must be last)
app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await connectDatabase();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
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
