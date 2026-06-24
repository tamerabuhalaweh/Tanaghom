import { ForbiddenError } from '@shared/errors';

export type ExternalSystem =
  | 'postiz'
  | 'social_api'
  | 'gohighlevel'
  | 'whatsapp'
  | 'telegram'
  | 'voice_chat'
  | 'rendering'
  | 'resourcespace'
  | 'paperclip';

export type ExternalAction =
  | 'read'
  | 'prepare'
  | 'validate_connection'
  | 'schedule'
  | 'publish'
  | 'write'
  | 'send_message'
  | 'trigger_call'
  | 'render';

export interface ExternalExecutionInput {
  system: ExternalSystem;
  action: ExternalAction;
  executionMode?: 'mock' | 'sandbox' | 'live';
  approvalId?: string | null;
  capabilityResolutionId?: string | null;
  mcpMediationRequestId?: string | null;
  humanApproved?: boolean;
}

export interface ExternalExecutionDecision {
  allowed: boolean;
  label: 'Working' | 'Sandbox Ready' | 'Requires Credentials' | 'Requires Authorization' | 'Blocked' | 'M5 Disabled';
  reasons: string[];
  requiredFlags: string[];
  requiresM5: boolean;
}

const SYSTEM_FLAGS: Partial<Record<ExternalSystem, string>> = {
  postiz: 'POSTIZ_LIVE_ENABLED',
  social_api: 'SOCIAL_API_LIVE_ENABLED',
  gohighlevel: 'CRM_LIVE_ENABLED',
  whatsapp: 'WHATSAPP_LIVE_ENABLED',
  telegram: 'TELEGRAM_LIVE_ENABLED',
  voice_chat: 'VOICE_CHAT_LIVE_ENABLED',
  rendering: 'RENDERING_LIVE_ENABLED',
  resourcespace: 'RESOURCESPACE_LIVE_ENABLED',
  paperclip: 'PAPERCLIP_SYNC_ENABLED',
};

const WRITE_ACTIONS = new Set<ExternalAction>([
  'schedule',
  'publish',
  'write',
  'send_message',
  'trigger_call',
  'render',
]);

function envEnabled(name: string): boolean {
  return process.env[name] === 'true';
}

export function isExternalWriteAction(action: ExternalAction): boolean {
  return WRITE_ACTIONS.has(action);
}

export function evaluateExternalExecution(input: ExternalExecutionInput): ExternalExecutionDecision {
  const reasons: string[] = [];
  const requiredFlags: string[] = [];
  const executionMode = input.executionMode ?? 'mock';
  const isWrite = isExternalWriteAction(input.action);
  const requiresM5 = isWrite;

  if (!isWrite) {
    return {
      allowed: true,
      label: executionMode === 'sandbox' ? 'Sandbox Ready' : 'Working',
      reasons: [],
      requiredFlags: [],
      requiresM5: false,
    };
  }

  requiredFlags.push('EXTERNAL_EXECUTION_ENABLED', 'M5_WRITE_EXECUTION_ENABLED');
  const systemFlag = SYSTEM_FLAGS[input.system];
  if (systemFlag) requiredFlags.push(systemFlag);

  if (!envEnabled('EXTERNAL_EXECUTION_ENABLED')) {
    reasons.push('External execution kill switch is disabled');
  }
  if (!envEnabled('M5_WRITE_EXECUTION_ENABLED')) {
    reasons.push('M5 write execution is disabled');
  }
  if (systemFlag && !envEnabled(systemFlag)) {
    reasons.push(`${systemFlag} is disabled`);
  }
  if (!input.humanApproved || !input.approvalId) {
    reasons.push('Human approval is required');
  }
  if (!input.capabilityResolutionId) {
    reasons.push('Capability resolution is required');
  }
  if (!input.mcpMediationRequestId) {
    reasons.push('MCP mediation is required');
  }
  if (executionMode === 'live' && process.env.DEMO_MODE === 'true') {
    reasons.push('Live execution is blocked while DEMO_MODE=true');
  }

  return {
    allowed: reasons.length === 0,
    label: reasons.some((reason) => reason.includes('M5')) ? 'M5 Disabled' : 'Blocked',
    reasons,
    requiredFlags,
    requiresM5,
  };
}

export function assertExternalExecutionAllowed(input: ExternalExecutionInput): void {
  const decision = evaluateExternalExecution(input);
  if (!decision.allowed) {
    throw new ForbiddenError(`External execution blocked: ${decision.reasons.join('; ')}`);
  }
}
