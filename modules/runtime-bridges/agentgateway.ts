import { AppError, ForbiddenError } from '@shared/errors';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

export interface AgentgatewayDryRunMediation {
  provider: 'agentgateway';
  operation: 'connector_import.dry_run';
  enabled: boolean;
  mediated: boolean;
  decision: 'not_enabled' | 'allowed' | 'denied';
  reason: string;
  statusCode: number | null;
  dryRunOnly: true;
  externalWritesAllowed: false;
  rawSecretsReturned: false;
}

interface MediateConnectorDryRunInput {
  tenantKey: string;
  userId: string;
  role: string;
  connectorId: string;
  eventId?: string;
}

export async function mediateConnectorDryRunPolicy(input: MediateConnectorDryRunInput): Promise<AgentgatewayDryRunMediation> {
  if (process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED !== 'true') {
    return {
      provider: 'agentgateway',
      operation: 'connector_import.dry_run',
      enabled: false,
      mediated: false,
      decision: 'not_enabled',
      reason: 'agentgateway dry-run policy mediation is disabled. Set AGENTGATEWAY_DRY_RUN_POLICY_ENABLED=true only after the gateway policy endpoint is deployed and approved.',
      statusCode: null,
      dryRunOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    };
  }

  const credential = await getActiveIntegrationCredential('agentgateway', 'runtime_endpoint', input.tenantKey);
  if (!credential) {
    throw new AppError('agentgateway dry-run mediation is enabled, but the runtime endpoint credential is missing.', 424, 'AGENTGATEWAY_CREDENTIAL_MISSING');
  }

  const baseUrl = requiredSecret(credential.secrets, 'baseUrl');
  const apiKey = credential.secrets.apiKey;
  const policyPath = credential.secrets.connectorDryRunPolicyPath || credential.secrets.policyPath || '/policy/connector-dry-run';
  const endpoint = new URL(policyPath, baseUrl);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      operation: 'connector_import.dry_run',
      connectorId: input.connectorId,
      eventId: input.eventId ?? null,
      authority: {
        sourceOfTruth: 'STITCH',
        tenantKey: input.tenantKey,
        humanUserId: input.userId,
        role: input.role,
      },
      safety: {
        dryRunOnly: true,
        externalWritesAllowed: false,
        importWritesAllowed: false,
      },
    }),
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError(`agentgateway dry-run policy check failed with HTTP ${response.status}.`, 502, 'AGENTGATEWAY_POLICY_FAILED');
  }

  const rawDecision = String(body.decision ?? (body.allowed === true ? 'allow' : 'deny')).toLowerCase();
  const allowed = ['allow', 'allowed', 'approve', 'approved'].includes(rawDecision);
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason
    : allowed
      ? 'agentgateway allowed this connector dry-run policy check.'
      : 'agentgateway denied this connector dry-run policy check.';

  if (!allowed) {
    throw new ForbiddenError(reason);
  }

  return {
    provider: 'agentgateway',
    operation: 'connector_import.dry_run',
    enabled: true,
    mediated: true,
    decision: 'allowed',
    reason,
    statusCode: response.status,
    dryRunOnly: true,
    externalWritesAllowed: false,
    rawSecretsReturned: false,
  };
}

function requiredSecret(secrets: Record<string, string>, key: string): string {
  const value = secrets[key];
  if (!value) throw new AppError(`agentgateway runtime credential field is missing: ${key}`, 424, 'AGENTGATEWAY_CREDENTIAL_INCOMPLETE');
  return value;
}
