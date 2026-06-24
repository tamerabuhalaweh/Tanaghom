import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import {
  createAccountReferenceSchema,
  createExecutionRequestSchema,
  createPostizConnectorSchema,
  type CreatePostizConnectorInput,
  type CreateExecutionRequestInput,
} from './types';
import * as service from './service';

export const postizIntegrationRouter = Router();

const POSTIZ_SANDBOX_URL = process.env.POSTIZ_SANDBOX_URL || process.env.POSTIZ_BASE_URL || '';

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

async function checkPostizHealth(): Promise<{
  url: string | null;
  reachable: boolean;
  statusCode: number | null;
  checkedAt: string;
  credentialStatus: 'configured' | 'missing';
}> {
  const checkedAt = new Date().toISOString();
  const credentialStatus = process.env.POSTIZ_API_KEY ? 'configured' : 'missing';
  if (!POSTIZ_SANDBOX_URL) {
    return { url: null, reachable: false, statusCode: null, checkedAt, credentialStatus };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${POSTIZ_SANDBOX_URL.replace(/\/$/, '')}/auth/login`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    return {
      url: POSTIZ_SANDBOX_URL,
      reachable: response.status < 500,
      statusCode: response.status,
      checkedAt,
      credentialStatus,
    };
  } catch {
    return { url: POSTIZ_SANDBOX_URL, reachable: false, statusCode: null, checkedAt, credentialStatus };
  } finally {
    clearTimeout(timer);
  }
}

postizIntegrationRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getSession(req);
    const health = await checkPostizHealth();
    const policy = evaluateExternalExecution({ system: 'postiz', action: 'schedule', executionMode: 'sandbox' });
    res.json({
      name: 'Postiz Scheduling',
      status: health.reachable ? 'Sandbox Connected' : health.url ? 'Sandbox Ready' : 'Requires Credentials',
      health,
      executionPolicy: policy,
      capabilities: {
        draftPreparation: true,
        schedulePayloadGeneration: true,
        liveScheduling: policy.allowed,
        livePublishing: false,
      },
      _label: 'Postiz sandbox status - publishing and scheduling remain gated',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.get('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const connectors = await service.listPostizConnectors(session.role, {
      connectorStatus: req.query.status as string | undefined,
    });
    res.json(connectors);
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createPostizConnectorSchema, {
      ...req.body,
      targetSystem: req.body.targetSystem ?? 'Postiz',
      supportsDraft: req.body.supportsDraft ?? true,
      supportsSchedule: req.body.supportsSchedule ?? true,
      supportsPublish: req.body.supportsPublish ?? false,
      m4Allowed: req.body.m4Allowed ?? true,
      m5Allowed: req.body.m5Allowed ?? false,
    }) as CreatePostizConnectorInput;
    const connector = await service.createPostizConnector(session.role, input);
    res.status(201).json({
      ...connector,
      _label: 'Postiz connector registered - live activation is not available from UI',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.get('/connectors/:id/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const accounts = await service.listAccountReferences(session.role, req.params.id as string);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/connectors/:id/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createAccountReferenceSchema, {
      ...req.body,
      postizConnectorId: req.params.id,
    });
    const account = await service.createAccountReference(session.role, input);
    res.status(201).json({
      ...account,
      _label: 'Postiz account reference registered - no social account login or publishing performed',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.get('/execution-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const requests = await service.listExecutionRequests(session.role, {
      publishingPackageId: req.query.publishingPackageId as string | undefined,
      requestStatus: req.query.status as string | undefined,
      requestedByUserId: req.query.mine === 'true' ? session.humanUserId : undefined,
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/execution-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createExecutionRequestSchema, {
      ...req.body,
      requestedByUserId: session.humanUserId,
      requestedByAgentRepId: session.agentRepId,
      executionMode: req.body.executionMode ?? 'mock',
      requestedAction: req.body.requestedAction ?? 'prepare_draft',
    }) as CreateExecutionRequestInput;
    const policy = evaluateExternalExecution({
      system: 'postiz',
      action: input.requestedAction === 'publish' ? 'publish' : input.requestedAction === 'prepare_schedule' ? 'schedule' : 'prepare',
      executionMode: input.executionMode === 'live' ? 'live' : input.executionMode === 'simulated' ? 'sandbox' : 'mock',
      approvalId: input.approvalId,
      capabilityResolutionId: input.capabilityResolutionId,
      mcpMediationRequestId: input.mcpMediationRequestId,
      humanApproved: Boolean(input.approvalId),
    });
    const request = await service.createExecutionRequest(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...request,
      executionPolicy: policy,
      _label: 'Postiz execution request recorded - actual external execution remains policy-gated',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/execution-requests/:id/prepare-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(
      z.object({
        platform: z.string().min(1),
        content: z.string().min(1),
        accountReference: z.string().min(1),
      }),
      req.body,
    );
    const job = await service.prepareDraft(
      session.role,
      session.humanUserId,
      session.agentRepId,
      req.params.id as string,
      input.platform,
      input.content,
      input.accountReference,
    );
    res.status(201).json({ ...job, _label: 'Postiz-ready draft prepared - no real scheduling or publishing' });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/execution-requests/:id/prepare-schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(
      z.object({
        platform: z.string().min(1),
        content: z.string().min(1),
        accountReference: z.string().min(1),
        scheduledAt: z.string().datetime(),
        timezone: z.string().min(1).default('UTC'),
      }),
      req.body,
    );
    const job = await service.prepareSchedule(
      session.role,
      session.humanUserId,
      session.agentRepId,
      req.params.id as string,
      input.platform,
      input.content,
      input.accountReference,
      new Date(input.scheduledAt),
      input.timezone ?? 'UTC',
    );
    res.status(201).json({ ...job, _label: 'Postiz-ready schedule payload prepared - no real scheduling' });
  } catch (err) {
    next(err);
  }
});
