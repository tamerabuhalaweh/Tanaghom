import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface LogContext {
  actor?: string;
  action?: string;
  object_type?: string;
  object_id?: string;
  result?: string;
  policy_decision?: string;
  [key: string]: unknown;
}

export function auditLog(context: LogContext, message: string): void {
  logger.info(context, message);
}

export function createChildLogger(context: LogContext) {
  return logger.child(context);
}
