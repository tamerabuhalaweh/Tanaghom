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

export interface IdentityLineage {
  humanUserId: string;
  agentRepId: string;
  actingAgentType: 'functional' | 'governance' | 'human';
  actingAgentId: string | null;
  action: string;
  targetObjectType: string;
  targetObjectId: string;
  timestamp: Date;
  result: 'success' | 'failure' | 'denied' | 'blocked';
  metadata?: Record<string, unknown>;
}

export function auditLog(context: LogContext, message: string): void {
  logger.info(context, message);
}

export function logIdentityLineage(lineage: IdentityLineage): void {
  logger.info({
    type: 'identity_lineage',
    humanUserId: lineage.humanUserId,
    agentRepId: lineage.agentRepId,
    actingAgentType: lineage.actingAgentType,
    actingAgentId: lineage.actingAgentId,
    action: lineage.action,
    targetObjectType: lineage.targetObjectType,
    targetObjectId: lineage.targetObjectId,
    timestamp: lineage.timestamp.toISOString(),
    result: lineage.result,
    metadata: lineage.metadata,
  }, `Identity lineage: ${lineage.action} on ${lineage.targetObjectType}/${lineage.targetObjectId} by ${lineage.actingAgentType}:${lineage.actingAgentId || lineage.agentRepId} -> ${lineage.result}`);
}

export function createIdentityLineage(
  humanUserId: string,
  agentRepId: string,
  actingAgentType: 'functional' | 'governance' | 'human',
  actingAgentId: string | null,
  action: string,
  targetObjectType: string,
  targetObjectId: string,
  result: 'success' | 'failure' | 'denied' | 'blocked',
  metadata?: Record<string, unknown>,
): IdentityLineage {
  const lineage: IdentityLineage = {
    humanUserId,
    agentRepId,
    actingAgentType,
    actingAgentId,
    action,
    targetObjectType,
    targetObjectId,
    timestamp: new Date(),
    result,
    metadata,
  };
  logIdentityLineage(lineage);
  return lineage;
}

export function createChildLogger(context: LogContext) {
  return logger.child(context);
}
