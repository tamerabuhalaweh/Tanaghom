import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import { auditLog } from '@shared/logging';
import { prisma } from '@shared/database';
import { getActiveIntegrationCredential, upsertIntegrationCredential } from '../integration-credentials/service';
import {
  createAccountReferenceSchema,
  createExecutionRequestSchema,
  createPostizConnectorSchema,
  type CreatePostizConnectorInput,
  type CreateExecutionRequestInput,
} from './types';
import * as service from './service';
import { buildPostizChannelGuidance, buildPostizDiagnostics, toSafePostizChannel } from './channel-contract';
import { buildPostizCreatePostPayload, summarizePostizPayload } from './payload';
import { recordCommercialWorkflowAudit } from '../commercial-workflow/evidence';

export const postizIntegrationRouter = Router();

const POSTIZ_SANDBOX_URL = process.env.POSTIZ_SANDBOX_URL || process.env.POSTIZ_BASE_URL || '';
const POSTIZ_API_ROOT = '/api/public/v1';
const POSTIZ_PUBLIC_API_PATH = '/api/public/v1/posts';
const POSTIZ_INTEGRATIONS_API_PATH = '/api/public/v1/integrations';
const POSTIZ_CONNECTION_API_PATH = '/api/public/v1/is-connected';

interface PostizRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  integrationId: string;
  source: 'tenant_vault' | 'environment' | 'missing';
}

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

async function checkPostizHealth(tenantKey: string): Promise<{
  url: string | null;
  reachable: boolean;
  statusCode: number | null;
  checkedAt: string;
  credentialStatus: 'configured' | 'missing';
  integrationIdStatus: 'configured' | 'missing';
}> {
  const checkedAt = new Date().toISOString();
  const config = await resolvePostizRuntimeConfig(tenantKey);
  const credentialStatus = config.apiKey ? 'configured' : 'missing';
  const integrationIdStatus = config.integrationId ? 'configured' : 'missing';
  if (!config.baseUrl) {
    return { url: null, reachable: false, statusCode: null, checkedAt, credentialStatus, integrationIdStatus };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/auth/login`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    return {
      url: config.baseUrl,
      reachable: response.status < 500,
      statusCode: response.status,
      checkedAt,
      credentialStatus,
      integrationIdStatus,
    };
  } catch {
    return { url: config.baseUrl, reachable: false, statusCode: null, checkedAt, credentialStatus, integrationIdStatus };
  } finally {
    clearTimeout(timer);
  }
}

postizIntegrationRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const health = await checkPostizHealth(session.tenantKey);
    const policy = evaluateExternalExecution({ system: 'postiz', action: 'schedule', executionMode: 'sandbox' });
    res.json({
      name: 'Postiz Scheduling',
      status: health.reachable ? 'Sandbox Connected' : health.url ? 'Sandbox Ready' : 'Requires Credentials',
      health,
      executionPolicy: policy,
      capabilities: {
        draftPreparation: true,
        schedulePayloadGeneration: true,
        channelListing: health.credentialStatus === 'configured',
        channelConnectUrl: health.credentialStatus === 'configured',
        liveScheduling: policy.allowed,
        livePublishing: false,
      },
      _label: 'Postiz sandbox status - publishing and scheduling remain gated',
    });
  } catch (err) {
    next(err);
  }
});

function buildPostizApiUrl(config: PostizRuntimeConfig, path: string): string {
  return `${config.baseUrl.replace(/\/$/, '')}${path}`;
}

async function fetchPostizJson(config: PostizRuntimeConfig, path: string): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const response = await fetch(buildPostizApiUrl(config, path), {
    headers: { Authorization: config.apiKey },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

async function fetchPostizChannels(config: PostizRuntimeConfig): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
  channels: ReturnType<typeof toSafePostizChannel>[];
}> {
  const result = await fetchPostizJson(config, POSTIZ_INTEGRATIONS_API_PATH);
  const channels = result.ok && Array.isArray(result.body)
    ? result.body.map(item => toSafePostizChannel(item as Record<string, unknown>))
    : [];
  return { ...result, channels };
}

function postizConnectPath(platform: string, refresh?: string): string {
  const params = new URLSearchParams();
  if (refresh) params.set('refresh', refresh);
  const query = params.toString();
  return `${POSTIZ_API_ROOT}/social/${encodeURIComponent(platform)}${query ? `?${query}` : ''}`;
}

function safePostizError(body: unknown): { message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { message: 'Postiz returned an unreadable error response.' };
  }
  const record = body as Record<string, unknown>;
  const message = typeof record.message === 'string'
    ? record.message
    : typeof record.error === 'string'
      ? record.error
      : typeof record.statusText === 'string'
        ? record.statusText
        : 'Postiz did not return a specific error message.';
  return { message: message.slice(0, 240) };
}

postizIntegrationRouter.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const missingGuidance = buildPostizChannelGuidance({
      hasBaseUrl: Boolean(config.baseUrl),
      hasApiKey: Boolean(config.apiKey),
      channelCount: 0,
      selectedIntegrationId: config.integrationId || null,
    });
    if (!config.baseUrl || !config.apiKey) {
      res.status(424).json({
        status: 'requires_credentials',
        channels: [],
        required: ['Postiz base URL', 'Postiz API key'],
        guidance: missingGuidance,
        rawTokensReturned: false,
        _label: missingGuidance.message,
      });
      return;
    }

    const result = await fetchPostizChannels(config);
    if (!result.ok) {
      res.status(502).json({
        status: 'failed',
        postizStatus: result.status,
        channels: [],
        response: safePostizError(result.body),
        rawTokensReturned: false,
        _label: 'Postiz channel list failed',
      });
      return;
    }

    const guidance = buildPostizChannelGuidance({
      hasBaseUrl: true,
      hasApiKey: true,
      channelCount: result.channels.length,
      selectedIntegrationId: config.integrationId || null,
    });
    res.json({
      status: 'ok',
      channels: result.channels,
      count: result.channels.length,
      credentialSource: config.source,
      selectedIntegrationId: config.integrationId || null,
      guidance,
      rawTokensReturned: false,
      _label: guidance.message,
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.get('/diagnostics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const platform = typeof req.query.platform === 'string' && req.query.platform.trim()
      ? req.query.platform.trim()
      : 'instagram';
    const refresh = typeof req.query.refresh === 'string' && req.query.refresh.trim()
      ? req.query.refresh.trim()
      : undefined;
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const gate = await sandboxSchedulingGate(config);

    if (!config.baseUrl || !config.apiKey) {
      const diagnostics = buildPostizDiagnostics({
        hasBaseUrl: Boolean(config.baseUrl),
        hasApiKey: Boolean(config.apiKey),
        apiConnected: null,
        channelCount: 0,
        selectedIntegrationId: config.integrationId || null,
        oauthChecked: false,
        platform,
        sandboxSchedulingAllowed: gate.allowed,
      });
      res.status(424).json({
        status: diagnostics.status,
        diagnostics,
        channels: [],
        credentialSource: config.source,
        rawTokensReturned: false,
        _label: diagnostics.summary,
      });
      return;
    }

    const [connectionResult, channelResult, oauthResult] = await Promise.all([
      fetchPostizJson(config, POSTIZ_CONNECTION_API_PATH).catch((error: unknown) => ({
        ok: false,
        status: 0,
        body: { message: error instanceof Error ? error.message : 'Postiz connection check failed' },
      })),
      fetchPostizChannels(config).catch((error: unknown) => ({
        ok: false,
        status: 0,
        body: { message: error instanceof Error ? error.message : 'Postiz channel list failed' },
        channels: [],
      })),
      fetchPostizJson(config, postizConnectPath(platform, refresh)).catch((error: unknown) => ({
        ok: false,
        status: 0,
        body: { message: error instanceof Error ? error.message : 'Postiz OAuth URL check failed' },
      })),
    ]);

    const connectionBody = connectionResult.body as Record<string, unknown>;
    const oauthBody = oauthResult.body as Record<string, unknown>;
    const authorizationUrl = oauthResult.ok && typeof oauthBody.url === 'string' ? oauthBody.url : null;
    const apiConnected = connectionResult.ok
      ? connectionBody.connected === true
      : false;
    const diagnostics = buildPostizDiagnostics({
      hasBaseUrl: true,
      hasApiKey: true,
      apiConnected,
      channelCount: channelResult.channels.length,
      selectedIntegrationId: config.integrationId || null,
      oauthChecked: true,
      oauthUrlReady: Boolean(authorizationUrl),
      oauthFailureReason: oauthResult.ok ? null : safePostizError(oauthResult.body).message,
      platform,
      sandboxSchedulingAllowed: gate.allowed,
    });

    res.status(connectionResult.ok || channelResult.ok || oauthResult.ok ? 200 : 502).json({
      status: diagnostics.status,
      diagnostics,
      channelCount: channelResult.channels.length,
      selectedIntegrationId: config.integrationId || null,
      channels: channelResult.channels,
      authorization: {
        platform,
        refresh: Boolean(refresh),
        urlReady: Boolean(authorizationUrl),
        authorizationUrl,
        postizStatus: oauthResult.status || null,
        error: oauthResult.ok ? null : safePostizError(oauthResult.body),
      },
      connection: {
        connected: apiConnected,
        postizStatus: connectionResult.status || null,
      },
      channelList: {
        postizStatus: channelResult.status || null,
        ok: channelResult.ok,
        error: channelResult.ok ? null : safePostizError(channelResult.body),
      },
      safety: {
        schedulingGate: gate,
        externalSchedulingAllowed: gate.allowed,
        livePublishing: false,
      },
      credentialSource: config.source,
      rawTokensReturned: false,
      _label: diagnostics.summary,
    });
  } catch (err) {
    next(err);
  }
});

const postizConnectChannelSchema = z.object({
  platform: z.enum(['linkedin', 'instagram', 'instagram-standalone', 'facebook', 'x', 'threads', 'tiktok', 'youtube']),
  refresh: z.string().trim().min(1).max(200).optional(),
});

const postizSelectChannelSchema = z.object({
  integrationId: z.string().trim().min(1).max(200),
});

postizIntegrationRouter.post('/connect-channel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = postizConnectChannelSchema.parse(req.body);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    if (!config.baseUrl || !config.apiKey) {
      res.status(424).json({
        status: 'requires_credentials',
        required: ['Postiz base URL', 'Postiz API key'],
        rawTokensReturned: false,
        _label: 'Postiz API key is required before Tanaghum can start channel connection',
      });
      return;
    }

    const response = await fetch(buildPostizApiUrl(config, postizConnectPath(input.platform, input.refresh)), {
      headers: { Authorization: config.apiKey },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({
        status: 'failed',
        postizStatus: response.status,
        response: safePostizError(body),
        rawTokensReturned: false,
        _label: `Postiz could not start ${input.platform} connection`,
      });
      return;
    }

    const responseRecord = body as Record<string, unknown>;
    const authorizationUrl = typeof responseRecord.url === 'string'
      ? responseRecord.url
      : typeof responseRecord.authorizationUrl === 'string'
        ? responseRecord.authorizationUrl
        : typeof responseRecord.redirectUrl === 'string'
          ? responseRecord.redirectUrl
          : null;

    auditLog(
      { actor: `user:${session.humanUserId}`, action: 'postiz_channel_connection_started', object_type: 'postiz_channel', object_id: input.platform, result: 'success' },
      `Postiz channel connection URL requested for ${input.platform}`,
    );

    res.json({
      status: authorizationUrl ? 'authorization_url_ready' : 'postiz_response_received',
      platform: input.platform,
      authorizationUrl,
      response: authorizationUrl ? undefined : body,
      rawTokensReturned: false,
      _label: authorizationUrl ? 'Open this URL to connect the social channel through Postiz' : 'Postiz response did not include a recognized authorization URL',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/select-channel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = postizSelectChannelSchema.parse(req.body);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const credential = await getActiveIntegrationCredential('postiz', 'api_key', session.tenantKey);
    if (!credential || !config.baseUrl || !config.apiKey) {
      res.status(424).json({
        status: 'requires_credentials',
        required: ['Postiz base URL', 'Postiz API key'],
        rawTokensReturned: false,
        _label: 'Save the Postiz API key and base URL before selecting a channel',
      });
      return;
    }

    const result = await fetchPostizChannels(config);
    if (!result.ok) {
      res.status(502).json({
        status: 'failed',
        postizStatus: result.status,
        response: safePostizError(result.body),
        rawTokensReturned: false,
        _label: 'Postiz channel validation failed',
      });
      return;
    }

    const selectedChannel = result.channels.find(channel => channel.id === input.integrationId);
    if (!selectedChannel) {
      res.status(404).json({
        status: 'not_found',
        rawTokensReturned: false,
        _label: 'The selected Postiz channel was not returned by the tenant Postiz account',
      });
      return;
    }

    const saved = await upsertIntegrationCredential(session.role, session.humanUserId, {
      tenantKey: session.tenantKey,
      provider: 'postiz',
      credentialType: 'api_key',
      connectionKey: 'default',
      displayName: credential.displayName,
      secrets: {
        ...credential.secrets,
        integrationId: input.integrationId,
      },
      metadata: {
        ...credential.metadata,
        selectedChannel: selectedChannel,
        selectedAt: new Date().toISOString(),
        source: 'postiz_channel_picker',
      },
    });

    res.json({
      status: 'selected',
      selectedChannel,
      credential: saved,
      rawSecretsReturned: false,
      _label: 'Postiz channel selected for sandbox scheduling packages',
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

const postizPackagePayloadSchema = z.object({
  publishingPackageId: z.string().uuid(),
  platform: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().min(1).default('UTC'),
  integrationId: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
});

async function resolvePostizRuntimeConfig(tenantKey = 'default'): Promise<PostizRuntimeConfig> {
  const credential = await getActiveIntegrationCredential('postiz', 'api_key', tenantKey);
  if (credential) {
    return {
      baseUrl: credential.secrets.baseUrl || POSTIZ_SANDBOX_URL,
      apiKey: credential.secrets.apiKey || '',
      integrationId: credential.secrets.integrationId || process.env.POSTIZ_SANDBOX_INTEGRATION_ID || '',
      source: 'tenant_vault',
    };
  }
  return {
    baseUrl: POSTIZ_SANDBOX_URL,
    apiKey: process.env.POSTIZ_API_KEY || '',
    integrationId: process.env.POSTIZ_SANDBOX_INTEGRATION_ID || '',
    source: process.env.POSTIZ_API_KEY ? 'environment' : 'missing',
  };
}

async function buildPackagePostizPayload(
  input: z.infer<typeof postizPackagePayloadSchema>,
  config: PostizRuntimeConfig,
) {
  const pkg = await prisma.publishingPackage.findUnique({
    where: { id: input.publishingPackageId },
    include: {
      items: true,
      targets: true,
      readiness_checks: true,
      manifest: true,
    },
  });
  if (!pkg) throw new NotFoundError('PublishingPackage', input.publishingPackageId);
  if (pkg.package_status !== 'ready_for_future_execution') {
    throw new ForbiddenError(`Publishing package is ${pkg.package_status}, not ready for scheduling preparation`);
  }

  const target = input.platform
    ? pkg.targets.find(item => item.platform === input.platform)
    : pkg.targets[0];
  const platform = input.platform || target?.platform;
  if (!platform) throw new ForbiddenError('Publishing package has no scheduling target platform');

  const caption =
    pkg.items.find(item => item.item_type === 'platform_caption' && item.platform === platform)
    || pkg.items.find(item => item.item_type === 'platform_caption')
    || pkg.items[0];
  const content = caption?.content_summary || '';
  if (!content.trim()) throw new ForbiddenError('Publishing package has no approved content summary to schedule');

  const scheduledAt = input.scheduledAt
    || target?.proposed_publish_at?.toISOString()
    || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const integrationId = input.integrationId || config.integrationId || undefined;
  const payloadInput = {
    platform,
    content,
    scheduledAt,
    integrationId,
    tags: input.tags,
    type: 'schedule' as const,
  };

  return {
    package: {
      id: pkg.id,
      status: pkg.package_status,
      campaignId: pkg.campaign_id,
      contentItemId: pkg.content_item_id,
      readinessScore: pkg.readiness_score,
      readinessSummary: pkg.readiness_summary,
    },
    target: {
      platform,
      proposedPublishAt: scheduledAt,
      timezone: input.timezone || target?.timezone || 'UTC',
      selectedIntegrationId: integrationId || null,
    },
    contentPreview: content.slice(0, 240),
    payload: buildPostizCreatePostPayload(payloadInput),
    payloadSummary: summarizePostizPayload(payloadInput),
    readinessChecks: pkg.readiness_checks.map(check => ({
      type: check.check_type,
      status: check.check_status,
      severity: check.severity,
      message: check.message,
    })),
    manifest: pkg.manifest ? {
      status: pkg.manifest.manifest_status,
      summary: pkg.manifest.manifest_summary,
      generatedAt: pkg.manifest.generated_at,
    } : null,
  };
}

async function sandboxSchedulingGate(config?: PostizRuntimeConfig): Promise<{ allowed: boolean; reasons: string[] }> {
  const runtimeConfig = config || await resolvePostizRuntimeConfig();
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks real sandbox scheduling');
  if (process.env.EXTERNAL_EXECUTION_ENABLED !== 'true') reasons.push('EXTERNAL_EXECUTION_ENABLED is not true');
  if (process.env.POSTIZ_SANDBOX_SCHEDULING_ENABLED !== 'true') reasons.push('POSTIZ_SANDBOX_SCHEDULING_ENABLED is not true');
  if (process.env.POSTIZ_LIVE_ENABLED !== 'true') reasons.push('POSTIZ_LIVE_ENABLED is not true');
  if (!runtimeConfig.baseUrl) reasons.push('Postiz base URL is missing');
  if (!runtimeConfig.apiKey) reasons.push('Postiz API key is missing');
  if (!runtimeConfig.integrationId) reasons.push('Postiz sandbox integration id is missing');
  return { allowed: reasons.length === 0, reasons };
}

postizIntegrationRouter.post('/schedule-payload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = postizPayloadSchema.parse(req.body);
    const session = getSession(req);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const payload = buildPostizCreatePostPayload({
      ...input,
      integrationId: input.integrationId || config.integrationId || undefined,
    });
    res.json({
      status: 'prepared',
      endpoint: config.baseUrl ? `${config.baseUrl.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}` : null,
      credentialSource: config.source,
      payload,
      payloadSummary: summarizePostizPayload({
        ...input,
        integrationId: input.integrationId || config.integrationId || undefined,
      }),
      safety: {
        executionPerformed: false,
        livePublishing: false,
        schedulingGate: await sandboxSchedulingGate(config),
      },
      _label: 'Postiz-ready scheduling payload prepared - no external call performed',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/package-payload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = postizPackagePayloadSchema.parse(req.body);
    const session = getSession(req);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const packagePayload = await buildPackagePostizPayload(input, config);
    const gate = await sandboxSchedulingGate(config);
    res.json({
      status: 'prepared',
      endpoint: config.baseUrl ? `${config.baseUrl.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}` : null,
      credentialSource: config.source,
      ...packagePayload,
      safety: {
        executionPerformed: false,
        livePublishing: false,
        schedulingGate: gate,
      },
      rawSecretsReturned: false,
      _label: 'Postiz-ready package payload prepared from approved content - no external call performed',
    });
  } catch (err) {
    next(err);
  }
});

postizIntegrationRouter.post('/sandbox-schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = postizPayloadSchema.parse(req.body);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const payload = buildPostizCreatePostPayload({
      ...input,
      integrationId: input.integrationId || config.integrationId || undefined,
    });
    const gate = await sandboxSchedulingGate(config);

    if (!gate.allowed) {
      auditLog(
        { actor: `user:${session.humanUserId}`, action: 'postiz_sandbox_schedule_blocked', object_type: 'system', object_id: undefined, result: 'blocked' },
        `Postiz sandbox schedule blocked: ${gate.reasons.join('; ')}`,
      );
      await recordCommercialWorkflowAudit({
        action: 'postiz_sandbox_schedule_blocked',
        result: 'blocked',
        humanUserId: session.humanUserId,
        agentRepId: session.agentRepId,
        targetObjectType: 'system',
        targetObjectId: undefined,
        sourceModule: 'postiz-integration',
        reason: gate.reasons.join('; '),
        policyMatched: 'external_execution_gate',
        afterState: {
          platform: input.platform,
          scheduledAt: input.scheduledAt,
          executionPerformed: false,
        },
      });
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

    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));

    auditLog(
      { actor: `user:${session.humanUserId}`, action: 'postiz_sandbox_schedule_executed', object_type: 'system', object_id: undefined, result: response.ok ? 'success' : 'failed' },
      `Postiz sandbox schedule API returned ${response.status}`,
    );
    await recordCommercialWorkflowAudit({
      action: 'postiz_sandbox_schedule_executed',
      result: response.ok ? 'success' : 'failure',
      humanUserId: session.humanUserId,
      agentRepId: session.agentRepId,
      targetObjectType: 'system',
      targetObjectId: undefined,
      sourceModule: 'postiz-integration',
      reason: `Postiz sandbox API returned ${response.status}`,
      policyMatched: 'external_execution_gate',
      afterState: {
        platform: input.platform,
        scheduledAt: input.scheduledAt,
        executionPerformed: true,
        livePublishing: false,
      },
    });

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

postizIntegrationRouter.post('/package-sandbox-schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = postizPackagePayloadSchema.parse(req.body);
    const config = await resolvePostizRuntimeConfig(session.tenantKey);
    const packagePayload = await buildPackagePostizPayload(input, config);
    const gate = await sandboxSchedulingGate(config);

    if (!gate.allowed) {
      auditLog(
        { actor: `user:${session.humanUserId}`, action: 'postiz_package_sandbox_schedule_blocked', object_type: 'publishing_package', object_id: input.publishingPackageId, result: 'blocked' },
        `Postiz package sandbox schedule blocked: ${gate.reasons.join('; ')}`,
      );
      await recordCommercialWorkflowAudit({
        action: 'postiz_package_sandbox_schedule_blocked',
        result: 'blocked',
        humanUserId: session.humanUserId,
        agentRepId: session.agentRepId,
        targetObjectType: 'publishing_package',
        targetObjectId: input.publishingPackageId,
        sourceModule: 'postiz-integration',
        reason: gate.reasons.join('; '),
        policyMatched: 'external_execution_gate',
        afterState: {
          platform: packagePayload.target.platform,
          scheduledAt: packagePayload.target.proposedPublishAt,
          executionPerformed: false,
        },
      });
      res.status(403).json({
        status: 'blocked',
        reasons: gate.reasons,
        ...packagePayload,
        safety: {
          executionPerformed: false,
          livePublishing: false,
        },
        rawSecretsReturned: false,
        _label: 'Blocked - package sandbox scheduling requires explicit deployment flags and a selected Postiz channel',
      });
      return;
    }

    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${POSTIZ_PUBLIC_API_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(packagePayload.payload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));

    auditLog(
      { actor: `user:${session.humanUserId}`, action: 'postiz_package_sandbox_schedule_executed', object_type: 'publishing_package', object_id: input.publishingPackageId, result: response.ok ? 'success' : 'failed' },
      `Postiz package sandbox schedule API returned ${response.status}`,
    );
    await recordCommercialWorkflowAudit({
      action: 'postiz_package_sandbox_schedule_executed',
      result: response.ok ? 'success' : 'failure',
      humanUserId: session.humanUserId,
      agentRepId: session.agentRepId,
      targetObjectType: 'publishing_package',
      targetObjectId: input.publishingPackageId,
      sourceModule: 'postiz-integration',
      reason: `Postiz sandbox API returned ${response.status}`,
      policyMatched: 'external_execution_gate',
      afterState: {
        platform: packagePayload.target.platform,
        scheduledAt: packagePayload.target.proposedPublishAt,
        executionPerformed: true,
        livePublishing: false,
      },
    });

    res.status(response.ok ? 200 : 502).json({
      status: response.ok ? 'sandbox_scheduled' : 'failed',
      postizStatus: response.status,
      response: body,
      ...packagePayload,
      safety: {
        executionPerformed: true,
        livePublishing: false,
        sandboxOnly: true,
      },
      rawSecretsReturned: false,
      _label: response.ok ? 'Sandbox schedule created in Postiz test account' : 'Postiz sandbox API call failed',
    });
  } catch (err) {
    next(err);
  }
});
