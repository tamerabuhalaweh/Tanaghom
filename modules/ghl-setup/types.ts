export const GHL_WIZARD_STEPS = [
  'credentials',
  'location',
  'tags',
  'pipeline',
  'review',
] as const;

export type GhlWizardStep = (typeof GHL_WIZARD_STEPS)[number];

export const CREDENTIAL_STATUS = [
  'missing',
  'configured',
  'validated',
  'expired',
] as const;

export type CredentialStatus = (typeof CREDENTIAL_STATUS)[number];

export const MAPPING_READINESS_STATES = [
  'not_started',
  'partial',
  'ready',
  'blocked',
] as const;

export type MappingReadinessState = (typeof MAPPING_READINESS_STATES)[number];

export interface GhlCredentialStatus {
  provider: 'gohighlevel';
  credentialType: 'api_key';
  status: CredentialStatus;
  hasApiKey: boolean;
  hasLocationId: boolean;
  secretFields: string[];
  lastValidatedAt: string | null;
  rawSecretsReturned: false;
}

export interface GhlLocationMapping {
  ghlLocationId: string;
  displayName: string;
  status: 'pending' | 'mapped' | 'blocked';
}

export interface GhlTagMapping {
  ghlTagId: string;
  ghlTagName: string;
  internalTag: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  status: 'pending' | 'mapped' | 'blocked';
}

export interface GhlPipelineMapping {
  ghlPipelineId: string;
  ghlPipelineName: string;
  ghlStageId: string;
  ghlStageName: string;
  internalStage: string;
  status: 'pending' | 'mapped' | 'blocked';
}

export interface GhlMappingReadiness {
  tags: {
    state: MappingReadinessState;
    mappedCount: number;
    totalCount: number;
    items: GhlTagMapping[];
  };
  pipelines: {
    state: MappingReadinessState;
    mappedCount: number;
    totalCount: number;
    items: GhlPipelineMapping[];
  };
  location: {
    state: MappingReadinessState;
    mapping: GhlLocationMapping | null;
  };
}

export interface GhlSetupWizardState {
  tenantKey: string;
  currentStep: GhlWizardStep;
  credentialStatus: GhlCredentialStatus;
  mappingReadiness: GhlMappingReadiness;
  liveWriteBlocked: true;
  blockReason: string;
  completedSteps: GhlWizardStep[];
}
