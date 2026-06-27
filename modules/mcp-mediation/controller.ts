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
import { discoverRemoteMcpTools, listDiscoveredTools, probeRemoteMcpEndpoint } from './discovery';

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

async function handleConnectorHealthCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const session = getSession(req);
    const connector = await service.getMcpConnector(session.role, req.params.id as string);
    const remoteEndpoint = parseRemoteMcpEndpoint(connector.ownerSubstrate);
    if (remoteEndpoint) {
      const probe = await probeRemoteMcpEndpoint(remoteEndpoint);
      res.json({
        connectorId: connector.id,
        name: connector.name,
        status: connector.status,
        checkedAt: new Date().toISOString(),
        result: probe.reachable ? 'reachable' : 'not_reachable',
        toolCount: probe.toolCount,
        error: probe.error,
        executionPerformed: false,
        sourceOfTruth: 'STITCH',
        _label: probe.reachable
          ? 'Remote MCP endpoint responded to tools/list. No tool execution was performed.'
          : 'Remote MCP endpoint probe failed. No tool execution was performed.',
      });
      return;
    }
    res.json({
      connectorId: connector.id,
      name: connector.name,
      status: connector.status,
      checkedAt: new Date().toISOString(),
      result: connector.status === 'active' ? 'registry_active' : 'not_active',
      executionPerformed: false,
      sourceOfTruth: 'STITCH',
      _label: 'Registry readiness check only. Add a remote MCP endpoint to run a live MCP tools/list probe.',
    });
  } catch (err) {
    next(err);
  }
}

mcpMediationRouter.post('/connectors/:id/health-check', handleConnectorHealthCheck);
mcpMediationRouter.post('/connectors/:id/mock-health-check', handleConnectorHealthCheck);

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

mcpMediationRouter.post('/discover', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireAdmin(session.role);
    const input = validateOrThrow(
      z.object({
        name: z.string().min(1).max(200),
        endpointUrl: z.string().url(),
        targetSystem: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
      }),
      req.body,
    );
    const result = await discoverRemoteMcpTools({
      requesterRole: session.role,
      requesterUserId: session.humanUserId,
      name: input.name,
      endpointUrl: input.endpointUrl,
      targetSystem: input.targetSystem,
      description: input.description,
    });
    res.status(201).json({
      ...result,
      _label: 'Remote MCP tools discovered and stored - no tool execution performed',
    });
  } catch (err) {
    next(err);
  }
});

mcpMediationRouter.get('/connectors/:id/discovered-tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    await service.getMcpConnector(session.role, req.params.id as string);
    const tools = await listDiscoveredTools(req.params.id as string);
    res.json({
      connectorId: req.params.id,
      tools,
      executionPerformed: false,
      sourceOfTruth: 'STITCH',
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

function parseRemoteMcpEndpoint(ownerSubstrate: string | null): string | null {
  if (!ownerSubstrate?.startsWith('remote_mcp:')) return null;
  return ownerSubstrate.slice('remote_mcp:'.length);
}
