export type ReadinessState = 'ready' | 'not_ready' | 'degraded';

export interface CredentialReadiness {
  state: ReadinessState;
  configured: boolean;
  source: 'tenant_vault' | 'missing';
  fields: {
    apiKey: ReadinessState;
    baseUrl: ReadinessState;
    agentId: ReadinessState;
    voiceId: ReadinessState;
    ttsBackend: ReadinessState;
  };
}

export interface ValidationSummary {
  tenantKey: string;
  apiReady: ReadinessState;
  agentIdReady: ReadinessState;
  voiceReady: ReadinessState;
  ttsReady: ReadinessState;
  credential: CredentialReadiness;
  blockers: string[];
  safety: {
    rawSecretsReturned: false;
    executionPolicyGated: true;
    customerOwnedCredentialRequired: true;
  };
  _label: string;
}
