import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { AppError, ForbiddenError, UnauthorizedError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

export const runtimeBridgesRouter = Router();

type RuntimeProvider = 'openclaw' | 'agentgateway' | 'agentscope';
type RuntimeFlag = { name: string; enabled: boolean; purpose: string };

const RUNTIME_METADATA: Record<RuntimeProvider, {
  displayName: string;
  intendedRole: string;
  activeExecutionLabel: string;
  productionGate: string;
  flags: RuntimeFlag[];
}> = {
  openclaw: {
    displayName: 'OpenClaw',
    intendedRole: 'Adjacent channel/orchestration bridge that must call STITCH APIs and cannot own business state.',
    activeExecutionLabel: 'Workflow orchestration',
    productionGate: 'Deploy runtime, configure tenant endpoint, prove one read-only or approval-gated workflow end to end.',
    flags: [
      {
        name: 'OPENCLAW_ORCHESTRATION_ENABLED',
        enabled: process.env.OPENCLAW_ORCHESTRATION_ENABLED === 'true',
        purpose: 'Allows the STITCH backend bridge to call OpenClaw orchestration endpoint.',
      },
    ],
  },
  agentgateway: {
    displayName: 'agentgateway',
    intendedRole: 'Network mediation/proxy for approved tool calls. No Tanaghum production traffic is routed through it yet.',
    activeExecutionLabel: 'Gateway traffic routing',
    productionGate: 'Deploy gateway, route one low-risk connector through policy, prove audit and deny behavior.',
    flags: [
      {
        name: 'AGENTGATEWAY_TRAFFIC_ENABLED',
        enabled: process.env.AGENTGATEWAY_TRAFFIC_ENABLED === 'true',
        purpose: 'Reserved gate for future policy-routed connector traffic.',
      },
      {
        name: 'AGENTGATEWAY_DRY_RUN_POLICY_ENABLED',
        enabled: process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED === 'true',
        purpose: 'Routes connector dry-run policy checks through agentgateway before STITCH executes the dry-run.',
      },
    ],
  },
  agentscope: {
    displayName: 'AgentScope',
    intendedRole: 'Optional agent runtime/session isolation layer. It is not executing production agents yet.',
    activeExecutionLabel: 'Agent session processing',
    productionGate: 'Deploy runtime, define tenant/session boundary, prove one governed agent session with audit.',
    flags: [
      {
        name: 'AGENTSCOPE_PROCESS_ENABLED',
        enabled: process.env.AGENTSCOPE_PROCESS_ENABLED === 'true',
        purpose: 'Allows the STITCH backend bridge to call AgentScope processing endpoint.',
      },
    ],
  },
};

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireRuntimeOpsRole(role: string) {
  if (!['admin', 'cco'].includes(role)) {
    throw new ForbiddenError('Admin/Ops runtime infrastructure evidence requires admin or CCO access');
  }
}

runtimeBridgesRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireRuntimeOpsRole(payload.role);
    const session = resolveSessionContext(payload);
    const providers: RuntimeProvider[] = ['openclaw', 'agentgateway', 'agentscope'];
    const statuses = await Promise.all(providers.map((provider) => getRuntimeStatus(provider, session.tenantKey)));
    res.json({
      sourceOfTruth: 'STITCH',
      customerFacing: false,
      productionActive: statuses.some(status => status.productionActive === true),
      statuses,
      _label: 'Admin/Ops runtime infrastructure evidence loaded from tenant credentials, environment gates, and live health checks',
    });
  } catch (err) {
    next(err);
  }
});

runtimeBridgesRouter.post('/openclaw/orchestrate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireRuntimeOpsRole(payload.role);
    const session = resolveSessionContext(payload);
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
    const payload = getPayload(req);
    requireRuntimeOpsRole(payload.role);
    const session = resolveSessionContext(payload);
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
  const metadata = RUNTIME_METADATA[provider];
  const lastCheckedAt = new Date().toISOString();
  const credential = await getActiveIntegrationCredential(provider, 'runtime_endpoint', tenantKey);
  if (!credential) {
    return {
      provider,
      displayName: metadata.displayName,
      intendedRole: metadata.intendedRole,
      configured: false,
      reachable: false,
      statusCode: null,
      productionActive: false,
      activeExecutionLabel: metadata.activeExecutionLabel,
      flags: metadata.flags,
      lastCheckedAt,
      blocker: 'Runtime endpoint credential is missing.',
      productionGate: metadata.productionGate,
      label: 'Requires Credentials',
      rawSecretsReturned: false,
    };
  }
  const baseUrl = credential.secrets.baseUrl;
  const healthPath = credential.secrets.healthPath || '/health';
  const flagsEnabled = metadata.flags.every(flag => flag.enabled);
  if (!baseUrl) {
    return {
      provider,
      displayName: metadata.displayName,
      intendedRole: metadata.intendedRole,
      configured: true,
      reachable: false,
      statusCode: null,
      productionActive: false,
      activeExecutionLabel: metadata.activeExecutionLabel,
      flags: metadata.flags,
      lastCheckedAt,
      blocker: 'Runtime credential exists but baseUrl is missing.',
      productionGate: metadata.productionGate,
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
    const reachable = response.ok;
    return {
      provider,
      displayName: metadata.displayName,
      intendedRole: metadata.intendedRole,
      configured: true,
      reachable,
      statusCode: response.status,
      productionActive: reachable && flagsEnabled,
      activeExecutionLabel: metadata.activeExecutionLabel,
      flags: metadata.flags,
      lastCheckedAt,
      blocker: reachable
        ? flagsEnabled
          ? 'Runtime is reachable and execution flag is enabled. A governed production pilot is still required before customer use.'
          : 'Runtime is reachable, but execution flag is disabled.'
        : 'Runtime credential exists, but health check failed.',
      productionGate: metadata.productionGate,
      label: reachable ? 'Runtime Reachable' : 'Runtime Health Failed',
      rawSecretsReturned: false,
    };
  } catch (err) {
    return {
      provider,
      displayName: metadata.displayName,
      intendedRole: metadata.intendedRole,
      configured: true,
      reachable: false,
      statusCode: null,
      productionActive: false,
      activeExecutionLabel: metadata.activeExecutionLabel,
      flags: metadata.flags,
      lastCheckedAt,
      blocker: 'Runtime credential exists, but health check could not reach the service.',
      productionGate: metadata.productionGate,
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
