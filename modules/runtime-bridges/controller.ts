import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { AppError, UnauthorizedError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

export const runtimeBridgesRouter = Router();

type RuntimeProvider = 'openclaw' | 'agentgateway' | 'agentscope';

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

runtimeBridgesRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const providers: RuntimeProvider[] = ['openclaw', 'agentgateway', 'agentscope'];
    const statuses = await Promise.all(providers.map((provider) => getRuntimeStatus(provider, session.tenantKey)));
    res.json({
      sourceOfTruth: 'STITCH',
      statuses,
      _label: 'Runtime bridge status loaded from tenant credentials and live health checks',
    });
  } catch (err) {
    next(err);
  }
});

runtimeBridgesRouter.post('/openclaw/orchestrate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    if (process.env.OPENCLAW_ORCHESTRATION_ENABLED !== 'true') {
      throw new AppError('OpenClaw orchestration is disabled. Set OPENCLAW_ORCHESTRATION_ENABLED=true after runtime credentials and approval policy are configured.', 424, 'OPENCLAW_ORCHESTRATION_DISABLED');
    }
    const input = z.object({
      workflowType: z.string().min(1).max(120),
      stitchRunId: z.string().optional(),
      payload: z.record(z.unknown()).default({}),
    }).parse(req.body);
    const credential = await getActiveIntegrationCredential('openclaw', 'runtime_endpoint', session.tenantKey);
    if (!credential) throw new AppError('OpenClaw runtime endpoint credential is missing.', 424, 'OPENCLAW_CREDENTIAL_MISSING');
    const baseUrl = requiredSecret(credential.secrets, 'baseUrl');
    const apiKey = requiredSecret(credential.secrets, 'apiKey');
    const endpoint = new URL(credential.secrets.orchestrationPath || '/orchestrate', baseUrl);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowType: input.workflowType,
        stitchRunId: input.stitchRunId,
        payload: input.payload,
        authority: {
          sourceOfTruth: 'STITCH',
          humanUserId: session.humanUserId,
          agentRepId: session.agentRepId,
          tenantKey: session.tenantKey,
        },
      }),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    auditLog(
      { actor: `user:${session.humanUserId}`, action: 'openclaw_orchestration_requested', object_type: 'runtime_bridge', object_id: input.workflowType, result: response.ok ? 'success' : 'failure' },
      `OpenClaw orchestration returned ${response.status}`,
    );
    res.status(response.ok ? 200 : 502).json({
      status: response.ok ? 'accepted' : 'failed',
      openClawStatus: response.status,
      response: body,
      sourceOfTruth: 'STITCH',
      _label: response.ok ? 'OpenClaw orchestration request accepted through STITCH bridge' : 'OpenClaw runtime call failed',
    });
  } catch (err) {
    next(err);
  }
});

runtimeBridgesRouter.post('/agentscope/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    if (process.env.AGENTSCOPE_PROCESS_ENABLED !== 'true') {
      throw new AppError('AgentScope processing is disabled. Set AGENTSCOPE_PROCESS_ENABLED=true after runtime deployment and policy approval.', 424, 'AGENTSCOPE_PROCESS_DISABLED');
    }
    const input = z.object({
      sessionId: z.string().min(1).max(200),
      text: z.string().min(1).max(4000),
    }).parse(req.body);
    const credential = await getActiveIntegrationCredential('agentscope', 'runtime_endpoint', session.tenantKey);
    if (!credential) throw new AppError('AgentScope runtime endpoint credential is missing.', 424, 'AGENTSCOPE_CREDENTIAL_MISSING');
    const baseUrl = requiredSecret(credential.secrets, 'baseUrl');
    const apiKey = requiredSecret(credential.secrets, 'apiKey');
    const endpoint = new URL(credential.secrets.processPath || '/process', baseUrl);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [{ role: 'user', content: [{ type: 'text', text: input.text }] }],
        session_id: input.sessionId,
      }),
    });
    const body = await response.text();
    res.status(response.ok ? 200 : 502).json({
      status: response.ok ? 'completed' : 'failed',
      agentScopeStatus: response.status,
      responseText: body,
      sourceOfTruth: 'STITCH',
      _label: response.ok ? 'AgentScope runtime processed request through STITCH bridge' : 'AgentScope runtime call failed',
    });
  } catch (err) {
    next(err);
  }
});

async function getRuntimeStatus(provider: RuntimeProvider, tenantKey: string) {
  const credential = await getActiveIntegrationCredential(provider, 'runtime_endpoint', tenantKey);
  if (!credential) {
    return {
      provider,
      configured: false,
      reachable: false,
      statusCode: null,
      label: 'Requires Credentials',
      rawSecretsReturned: false,
    };
  }
  const baseUrl = credential.secrets.baseUrl;
  const healthPath = credential.secrets.healthPath || '/health';
  if (!baseUrl) {
    return {
      provider,
      configured: true,
      reachable: false,
      statusCode: null,
      label: 'Missing baseUrl',
      rawSecretsReturned: false,
    };
  }
  try {
    const url = new URL(healthPath, baseUrl);
    const response = await fetch(url, {
      method: 'GET',
      headers: credential.secrets.apiKey ? { Authorization: `Bearer ${credential.secrets.apiKey}` } : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return {
      provider,
      configured: true,
      reachable: response.ok,
      statusCode: response.status,
      label: response.ok ? 'Runtime Reachable' : 'Runtime Health Failed',
      rawSecretsReturned: false,
    };
  } catch (err) {
    return {
      provider,
      configured: true,
      reachable: false,
      statusCode: null,
      label: err instanceof Error ? err.message : 'Runtime health check failed',
      rawSecretsReturned: false,
    };
  }
}

function requiredSecret(secrets: Record<string, string>, key: string): string {
  const value = secrets[key];
  if (!value) throw new AppError(`Runtime credential field is missing: ${key}`, 424, 'RUNTIME_CREDENTIAL_INCOMPLETE');
  return value;
}
