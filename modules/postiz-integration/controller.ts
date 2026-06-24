import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import { auditLog } from '@shared/logging';
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
const POSTIZ_PUBLIC_API_PATH = '/api/public/v1/posts';

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

const postizPayloadSchema = z.object({
  platform: z.string().min(1),
  content: z.string().min(1),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1).default('UTC'),
  integrationId: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
});

function buildPostizCreatePostPayload(input: z.infer<typeof postizPayloadSchema>) {
  return {
    type: 'schedule',
    date: input.scheduledAt,
    shortLink: false,
    tags: input.tags.map((tag) => ({ value: tag })),
    posts: [
      {
        integration: {
          id: input.integrationId || process.env.POSTIZ_SANDBOX_INTEGRATION_ID || '<configured sandbox integration id>',
        },
        value: [
          {
            content: input.content,
            image: [],
          },
        ],
        settings: {
          __type: input.platform,
        },
      },
    ],
  };
}

function sandboxSchedulingGate(): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks real sandbox scheduling');
  if (process.env.EXTERNAL_EXECUTION_ENABLED !== 'true') reasons.push('EXTERNAL_EXECUTION_ENABLED is not true');
  if (process.env.POSTIZ_SANDBOX_SCHEDULING_ENABLED !== 'true') reasons.push('POSTIZ_SANDBOX_SCHEDULING_ENABLED is not true');
  if (process.env.POSTIZ_LIVE_ENABLED !== 'true') reasons.push('POSTIZ_LIVE_ENABLED is not true');
  if (!POSTIZ_SANDBOX_URL) reasons.push('POSTIZ_SANDBOX_URL or POSTIZ_BASE_URL is missing');
  if (!process.env.POSTIZ_API_KEY) reasons.push('POSTIZ_API_KEY is missing');
  if (!process.env.POSTIZ_SANDBOX_INTEGRATION_ID) reasons.push('POSTIZ_SANDBOX_INTEGRATION_ID is missing');
  return { allowed: reasons.length === 0, reasons };
}

postizIntegrationRouter.post('/schedule-payload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getSession(req);
    const input = postizPayloadSchema.parse(req.body);
    const payload = buildPostizCreatePostPayload(input);
    res.json({
      status: 'prepared',
      endpoint: POSTIZ_SANDBOX_URL ? `${POSTIZ_SANDBOX_URL.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}` : null,
      payload,
      safety: {
        executionPerformed: false,
        livePublishing: false,
        schedulingGate: sandboxSchedulingGate(),
      },
      _label: 'Postiz-ready scheduling payload prepared - no external call performed',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/sandbox-schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = postizPayloadSchema.parse(req.body);
    const payload = buildPostizCreatePostPayload(input);
    const gate = sandboxSchedulingGate();

    if (!gate.allowed) {
      auditLog(
        { actor: `user:${session.humanUserId}`, action: 'postiz_sandbox_schedule_blocked', object_type: 'system', object_id: undefined, result: 'blocked' },
        `Postiz sandbox schedule blocked: ${gate.reasons.join('; ')}`,
      );
      res.status(403).json({
        status: 'blocked',
        reasons: gate.reasons,
        payload,
        safety: {
          executionPerformed: false,
          livePublishing: false,
        },
        _label: 'Blocked - sandbox scheduling requires explicit deployment flags and credentials',
      });
      return;
    }

    const response = await fetch(`${POSTIZ_SANDBOX_URL.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: process.env.POSTIZ_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));

    auditLog(
      { actor: `user:${session.humanUserId}`, action: 'postiz_sandbox_schedule_executed', object_type: 'system', object_id: undefined, result: response.ok ? 'success' : 'failed' },
      `Postiz sandbox schedule API returned ${response.status}`,
    );

    res.status(response.ok ? 200 : 502).json({
      status: response.ok ? 'sandbox_scheduled' : 'failed',
      postizStatus: response.status,
      response: body,
      payload,
      safety: {
        executionPerformed: true,
        livePublishing: false,
        sandboxOnly: true,
      },
      _label: response.ok ? 'Sandbox schedule created in Postiz test account' : 'Postiz sandbox API call failed',
    });
  } catch (err) {
    next(err);
  }
});
