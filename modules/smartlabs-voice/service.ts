import { ExternalServiceError, ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { evaluateExternalExecution } from '@shared/policy';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

const DEFAULT_BASE_URL = 'https://api.thesmartlabs.net';
const DEFAULT_TTS_BACKEND = 'omnivoice';
const DEFAULT_VOICE_ID = 'smarttts2-xms-default';

export interface SmartLabsConfig {
  configured: boolean;
  source: 'tenant_vault' | 'missing';
  baseUrl: string;
  apiKey: string;
  agentId: string;
  voiceId: string;
  ttsBackend: string;
}

export interface SmartLabsGate {
  allowed: boolean;
  reasons: string[];
}

export interface SmartLabsConversationInput {
  agentId?: string;
  message: string;
  conversationHistory?: Array<Record<string, unknown>>;
}

export interface SmartLabsTextToSpeechInput {
  agentId?: string;
  text: string;
  ttsBackend?: string;
  voiceId?: string;
}

export async function resolveSmartLabsConfig(tenantKey = 'default'): Promise<SmartLabsConfig> {
  const credential = await getActiveIntegrationCredential('smartlabs_voice', 'api_key', tenantKey);
  if (!credential) {
    return {
      configured: false,
      source: 'missing',
      baseUrl: DEFAULT_BASE_URL,
      apiKey: '',
      agentId: '',
      voiceId: DEFAULT_VOICE_ID,
      ttsBackend: DEFAULT_TTS_BACKEND,
    };
  }
  return {
    configured: true,
    source: 'tenant_vault',
    baseUrl: credential.secrets.baseUrl || DEFAULT_BASE_URL,
    apiKey: credential.secrets.apiKey || '',
    agentId: credential.secrets.agentId || '',
    voiceId: credential.secrets.voiceId || DEFAULT_VOICE_ID,
    ttsBackend: credential.secrets.ttsBackend || DEFAULT_TTS_BACKEND,
  };
}

export function smartLabsReadGate(config: SmartLabsConfig): SmartLabsGate {
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks SmartLabs API reads');
  if (process.env.SMARTLABS_READ_ENABLED !== 'true') reasons.push('SMARTLABS_READ_ENABLED is not true');
  if (!config.configured || !config.apiKey) reasons.push('SmartLabs tenant API key is missing');
  return { allowed: reasons.length === 0, reasons };
}

export function smartLabsExecutionGate(config: SmartLabsConfig, input: {
  confirmExternalExecution?: boolean;
  approvalId?: string;
  capabilityResolutionId?: string;
  mcpMediationRequestId?: string;
}): SmartLabsGate & { executionPolicy: ReturnType<typeof evaluateExternalExecution> } {
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks SmartLabs execution');
  if (process.env.SMARTLABS_LIVE_ENABLED !== 'true') reasons.push('SMARTLABS_LIVE_ENABLED is not true');
  if (process.env.VOICE_CHAT_LIVE_ENABLED !== 'true') reasons.push('VOICE_CHAT_LIVE_ENABLED is not true');
  if (!config.configured || !config.apiKey) reasons.push('SmartLabs tenant API key is missing');
  if (!input.confirmExternalExecution) reasons.push('confirmExternalExecution must be true');
  const executionPolicy = evaluateExternalExecution({
    system: 'voice_chat',
    action: 'trigger_call',
    executionMode: 'sandbox',
    approvalId: input.approvalId,
    capabilityResolutionId: input.capabilityResolutionId,
    mcpMediationRequestId: input.mcpMediationRequestId,
    humanApproved: Boolean(input.approvalId),
  });
  return {
    allowed: reasons.length === 0 && executionPolicy.allowed,
    reasons: [...reasons, ...executionPolicy.reasons],
    executionPolicy,
  };
}

export function buildConversationPayload(config: SmartLabsConfig, input: SmartLabsConversationInput) {
  return {
    agent_id: input.agentId || config.agentId,
    message: input.message,
    conversation_history: Array.isArray(input.conversationHistory) ? input.conversationHistory : [],
  };
}

export function buildTextToSpeechPayload(config: SmartLabsConfig, input: SmartLabsTextToSpeechInput) {
  return {
    agent_id: input.agentId || config.agentId,
    text: input.text,
    tts_backend: input.ttsBackend || config.ttsBackend,
    voice_id: input.voiceId || config.voiceId,
  };
}

export function summarizeSmartLabsConfig(config: SmartLabsConfig) {
  return {
    configured: config.configured,
    source: config.source,
    baseUrlStatus: config.baseUrl ? 'configured' : 'missing',
    apiKeyStatus: config.apiKey ? 'configured' : 'missing',
    agentIdStatus: config.agentId ? 'configured' : 'missing',
    voiceIdStatus: config.voiceId ? 'configured' : 'default',
    ttsBackendStatus: config.ttsBackend ? 'configured' : 'default',
    rawSecretsReturned: false,
  };
}

export function sanitizeSmartLabsResponse(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(item => sanitizeSmartLabsResponse(item));
  const record = body as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !['api_key', 'apiKey', 'token', 'access_token', 'secret', 'x-api-key'].includes(key))
      .map(([key, value]) => [key, sanitizeSmartLabsResponse(value)]),
  );
}

export async function callSmartLabsJson(input: {
  config: SmartLabsConfig;
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = new URL(input.path, input.config.baseUrl);
  const response = await fetch(url, {
    method: input.method || 'GET',
    headers: {
      'x-api-key': input.config.apiKey,
      'Content-Type': 'application/json',
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const body = await response.json().catch(() => ({ statusText: response.statusText }));
  return { ok: response.ok, status: response.status, body: sanitizeSmartLabsResponse(body) };
}

export async function callSmartLabsAudio(input: {
  config: SmartLabsConfig;
  body: unknown;
}): Promise<{ ok: boolean; status: number; contentType: string; audioBase64?: string; sizeBytes: number; body?: unknown }> {
  const url = new URL('/v1/text-to-speech', input.config.baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': input.config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.body),
  });
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  if (!response.ok || contentType.includes('application/json')) {
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    return { ok: response.ok, status: response.status, contentType, sizeBytes: 0, body: sanitizeSmartLabsResponse(body) };
  }
  const audio = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    status: response.status,
    contentType,
    audioBase64: audio.toString('base64'),
    sizeBytes: audio.length,
  };
}

export function assertSmartLabsGate(gate: SmartLabsGate): void {
  if (!gate.allowed) throw new ForbiddenError(gate.reasons.join('; '));
}

export function auditSmartLabsAction(input: {
  userId: string;
  tenantKey: string;
  action: string;
  result: 'success' | 'blocked' | 'failed';
  objectId?: string;
}) {
  auditLog(
    {
      actor: `user:${input.userId}`,
      action: input.action,
      object_type: 'smartlabs_voice',
      object_id: input.objectId,
      result: input.result,
    },
    `SmartLabs voice action ${input.action} for tenant ${input.tenantKey}`,
  );
}

export function requireAgentId(payload: { agent_id?: string }): void {
  if (!payload.agent_id) {
    throw new ForbiddenError('SmartLabs agentId is required. Save agentId in tenant credentials or provide it in the request.');
  }
}

export function externalFailure(service: string, result: { status: number; body?: unknown }): ExternalServiceError {
  return new ExternalServiceError(service, `status ${result.status}: ${JSON.stringify(result.body ?? {})}`);
}
