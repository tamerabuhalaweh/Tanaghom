import type { CredentialReadiness, ReadinessState, ValidationSummary } from './types';

export function assessCredentialReadiness(input: {
  configured: boolean;
  source: 'tenant_vault' | 'missing';
  apiKey: string;
  baseUrl: string;
  agentId: string;
  voiceId: string;
  ttsBackend: string;
}): CredentialReadiness {
  const fieldState = (value: string, hasDefault = false): ReadinessState => {
    if (value) return 'ready';
    return hasDefault ? 'degraded' : 'not_ready';
  };

  return {
    state: input.configured && input.apiKey ? 'ready' : 'not_ready',
    configured: input.configured,
    source: input.source,
    fields: {
      apiKey: fieldState(input.apiKey),
      baseUrl: fieldState(input.baseUrl, true),
      agentId: fieldState(input.agentId),
      voiceId: fieldState(input.voiceId, true),
      ttsBackend: fieldState(input.ttsBackend, true),
    },
  };
}

export function deriveValidationSummary(input: {
  tenantKey: string;
  credential: CredentialReadiness;
  agentId: string;
  voiceId: string;
  ttsBackend: string;
}): ValidationSummary {
  const blockers: string[] = [];

  if (!input.credential.configured) {
    blockers.push('SmartLabs tenant credentials are not configured');
  }
  if (input.credential.fields.apiKey === 'not_ready') {
    blockers.push('SmartLabs API key is missing');
  }
  if (input.credential.fields.agentId === 'not_ready') {
    blockers.push('SmartLabs agentId is missing');
  }

  const apiReady: ReadinessState =
    input.credential.state === 'ready' && input.credential.fields.agentId !== 'not_ready'
      ? 'ready'
      : 'not_ready';

  const agentIdReady: ReadinessState = input.agentId ? 'ready' : 'not_ready';

  const voiceReady: ReadinessState =
    input.credential.state === 'ready' && input.agentId ? 'ready' : 'not_ready';

  const ttsReady: ReadinessState =
    input.credential.state === 'ready' && input.agentId
      ? input.ttsBackend && input.voiceId
        ? 'ready'
        : 'degraded'
      : 'not_ready';

  return {
    tenantKey: input.tenantKey,
    apiReady,
    agentIdReady,
    voiceReady,
    ttsReady,
    credential: input.credential,
    blockers,
    safety: {
      rawSecretsReturned: false,
      executionPolicyGated: true,
      customerOwnedCredentialRequired: true,
    },
    _label: 'SmartLabs voice validation status for this tenant',
  };
}
