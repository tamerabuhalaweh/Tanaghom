import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import {
  createMcpAccessPolicySchema,
  createMcpConnectorSchema,
  createMcpMediationDecisionSchema,
  createMcpMediationRequestSchema,
  type CreateMcpAccessPolicyInput,
  type CreateMcpConnectorInput,
  type CreateMcpMediationDecisionInput,
  type CreateMcpMediationRequestInput,
} from './types';
import * as service from './service';

export const mcpMediationRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

function requireAdmin(role: string): void {
  if (role !== 'admin' && role !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required');
  }
}

function mapSystem(targetSystem: string) {
  const value = targetSystem.toLowerCase();
  if (value.includes('postiz')) return 'postiz' as const;
  if (value.includes('gohigh') || value.includes('crm')) return 'gohighlevel' as const;
  if (value.includes('whatsapp')) return 'whatsapp' as const;
  if (value.includes('telegram')) return 'telegram' as const;
  if (value.includes('voice') || value.includes('chat')) return 'voice_chat' as const;
  return 'social_api' as const;
}

mcpMediationRouter.get('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const connectors = await service.listMcpConnectors(session.role, {
      status: req.query.status as string | undefined,
      connectorType: req.query.connectorType as string | undefined,
    });
    res.json(connectors.map((connector) => ({
      ...connector,
      sourceOfTruth: 'STITCH',
      credentialStatus: connector.credentialRequired ? 'requires_credentials' : 'not_required',
      executionPolicy: evaluateExternalExecution({
        system: mapSystem(connector.targetSystem),
        action: connector.supportsWrite ? 'write' : 'read',
        executionMode: 'sandbox',
      }),
    })));
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireAdmin(session.role);
    const input = validateOrThrow(createMcpConnectorSchema, {
      ...req.body,
      status: req.body.status ?? 'planned',
      isExternal: req.body.isExternal ?? true,
      supportsRead: req.body.supportsRead ?? true,
      supportsWrite: req.body.supportsWrite ?? false,
      m4Allowed: req.body.m4Allowed ?? true,
      m5Allowed: req.body.m5Allowed ?? false,
      credentialRequired: req.body.credentialRequired ?? true,
    }) as CreateMcpConnectorInput;

    if (input.supportsWrite && !input.m5Allowed) {
      input.status = 'planned';
    }

    const connector = await service.createMcpConnector(session.role, input);
    res.status(201).json({
      ...connector,
      sourceOfTruth: 'STITCH',
      _label: 'MCP connector registered - execution still requires mediation and approval',
    });
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/connectors/:id/mock-health-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const connector = await service.getMcpConnector(session.role, req.params.id as string);
    res.json({
      connectorId: connector.id,
      name: connector.name,
      status: connector.status,
      checkedAt: new Date().toISOString(),
      result: connector.status === 'active' ? 'reachable' : 'not_active',
      executionPerformed: false,
      sourceOfTruth: 'STITCH',
      _label: 'Mock health check only - no MCP tool invoked',
    });
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/connectors/:id/tool-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(
      z.object({
        toolName: z.string().min(1),
        operation: z.string().min(1).default('read'),
        payloadSchema: z.record(z.unknown()).optional(),
      }),
      req.body,
    );
    const connector = await service.getMcpConnector(session.role, req.params.id as string);
    res.json({
      connectorId: connector.id,
      toolName: input.toolName,
      operation: input.operation,
      payloadSchema: input.payloadSchema || null,
      executable: false,
      sourceOfTruth: 'STITCH',
      _label: 'Tool preview registered for UI planning only - no MCP execution',
    });
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.get('/mediation-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const requests = await service.listMcpMediationRequests(session.role, {
      mcpConnectorId: req.query.mcpConnectorId as string | undefined,
      humanUserId: req.query.mine === 'true' ? session.humanUserId : undefined,
      requestStatus: req.query.status as string | undefined,
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/mediation-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createMcpMediationRequestSchema, {
      ...req.body,
      humanUserId: session.humanUserId,
      agentRepId: session.agentRepId,
      actingAgentType: req.body.actingAgentType ?? 'human',
      resourceIds: req.body.resourceIds ?? [],
    }) as CreateMcpMediationRequestInput;
    const request = await service.createMcpMediationRequest(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...request,
      _label: 'MCP mediation request created - connector execution still blocked until decision',
    });
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/mediation-decisions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createMcpMediationDecisionSchema, {
      ...req.body,
      decidedByUserId: session.humanUserId,
      decidedByAgentRepId: session.agentRepId,
    }) as CreateMcpMediationDecisionInput;
    const decision = await service.createMcpMediationDecision(
      session.role,
      session.humanUserId,
      session.agentRepId,
      'human',
      input,
    );
    res.status(201).json(decision);
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.get('/access-policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const policies = await service.listMcpAccessPolicies(session.role, {
      connectorType: req.query.connectorType as string | undefined,
    });
    res.json(policies);
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.post('/access-policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireAdmin(session.role);
    const input = validateOrThrow(createMcpAccessPolicySchema, {
      ...req.body,
      allowed: req.body.allowed ?? true,
      requiresM4: req.body.requiresM4 ?? true,
      requiresM5: req.body.requiresM5 ?? false,
      requiresSaifDecision: req.body.requiresSaifDecision ?? false,
      requiresApproval: req.body.requiresApproval ?? false,
    }) as CreateMcpAccessPolicyInput;
    const policy = await service.createMcpAccessPolicy(session.role, input);
    res.status(201).json({
      ...policy,
      _label: 'MCP access policy registered - STITCH remains source of truth',
    });
  } catch (err) {
    next(err);
  }
});
