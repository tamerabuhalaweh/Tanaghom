import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { prisma } from '@shared/database';

export const integrationsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireAdmin(role: string): void {
  if (role !== 'admin' && role !== 'owner') {
    throw new ForbiddenError('Admin or owner access required');
  }
}

const CONNECTOR_DEFINITIONS = [
  { name: 'Postiz', type: 'publishing', description: 'Social media scheduling and publishing', allowedActions: ['create_draft', 'schedule_post', 'get_status'], requiresApproval: true, externalWrite: true },
  { name: 'GoHighLevel', type: 'crm', description: 'CRM lead capture and management', allowedActions: ['create_contact', 'create_opportunity', 'get_status'], requiresApproval: true, externalWrite: true },
  { name: 'WhatsApp Cloud API', type: 'messaging', description: 'WhatsApp messaging via Cloud API', allowedActions: ['send_template', 'send_message', 'get_status'], requiresApproval: true, externalWrite: true },
  { name: 'Telegram Bot API', type: 'messaging', description: 'Telegram bot messaging', allowedActions: ['send_message', 'get_status'], requiresApproval: true, externalWrite: true },
  { name: 'Voice/Chat Agent API', type: 'voice', description: 'AI voice and chat agent handoff', allowedActions: ['trigger_voice', 'trigger_chat', 'get_status'], requiresApproval: true, externalWrite: true },
  { name: 'Social Analytics APIs', type: 'analytics', description: 'Social media analytics ingestion', allowedActions: ['ingest_metrics', 'get_performance'], requiresApproval: false, externalWrite: false },
  { name: 'MCP Server', type: 'mcp', description: 'Model Context Protocol connector', allowedActions: ['invoke_tool', 'get_status'], requiresApproval: true, externalWrite: false },
];

integrationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);

    const connectors = await prisma.mcpConnector.findMany({
      orderBy: { name: 'asc' },
    });

    const connectorMap = new Map(connectors.map((c: Record<string, unknown>) => [c.name, c]));

    const result = CONNECTOR_DEFINITIONS.map(def => {
      const dbConnector = connectorMap.get(def.name) as Record<string, unknown> | undefined;
      return {
        name: def.name,
        type: def.type,
        description: def.description,
        status: dbConnector?.status || 'not_configured',
        credentialStatus: dbConnector ? 'configured' : 'missing',
        sandboxMode: true,
        lastHealthCheck: null,
        allowedActions: def.allowedActions,
        requiresApproval: def.requiresApproval,
        externalWrite: def.externalWrite,
        _label: !dbConnector ? 'Not configured — requires setup' : dbConnector.status === 'active' ? 'Connected' : 'Configured',
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

integrationsRouter.get('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const name = req.params.name as string;

    const def = CONNECTOR_DEFINITIONS.find(d => d.name.toLowerCase() === (name as string).toLowerCase());
    if (!def) {
      res.status(404).json({ error: 'Connector not found' });
      return;
    }

    const connector = await prisma.mcpConnector.findFirst({
      where: { name: def.name },
    }) as Record<string, unknown> | null;

    res.json({
      name: def.name,
      type: def.type,
      description: def.description,
      status: connector?.status || 'not_configured',
      credentialStatus: connector ? 'configured' : 'missing',
      sandboxMode: true,
      lastHealthCheck: null,
      allowedActions: def.allowedActions,
      requiresApproval: def.requiresApproval,
      externalWrite: def.externalWrite,
    });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.post('/:name/health-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const name = req.params.name as string;
    const connector = await prisma.mcpConnector.findFirst({
      where: { name: name as string },
    }) as Record<string, unknown> | null;

    if (!connector) {
      res.status(404).json({ error: 'Connector not configured' });
      return;
    }

    await prisma.mcpConnector.update({
      where: { id: connector.id as string },
      data: { updated_at: new Date() },
    });
  } catch (err) {
    next(err);
  }
});
