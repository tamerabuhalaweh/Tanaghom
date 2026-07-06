import type { LeadStatus, LeadTemperature } from '../lead-lifecycle/types';

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

export const GHL_CONNECTION_ACCEPTANCE_STATUSES = [
  'requires_credentials',
  'needs_test',
  'accepted',
  'failed',
] as const;

export type GhlConnectionAcceptanceStatus = (typeof GHL_CONNECTION_ACCEPTANCE_STATUSES)[number];

export const GHL_MAPPING_ACCEPTANCE_STATUSES = [
  'not_ready',
  'partial',
  'ready',
] as const;

export type GhlMappingAcceptanceStatus = (typeof GHL_MAPPING_ACCEPTANCE_STATUSES)[number];

export type GhlTagTarget = LeadStatus | LeadTemperature;

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

export interface GhlConnectionAcceptance {
  status: GhlConnectionAcceptanceStatus;
  canReadContacts: boolean;
  checkedContacts: number;
  lastValidatedAt: string | null;
  requiredActions: string[];
  rawSecretsReturned: false;
  rawPayloadReturned: false;
}

export const GHL_LIVE_VALIDATION_STATUSES = [
  'requires_credentials',
  'failed',
  'validated',
  'validated_with_warnings',
] as const;

export type GhlLiveValidationStatus = (typeof GHL_LIVE_VALIDATION_STATUSES)[number];

export interface GhlMissingRemoteMapping {
  type: 'tag' | 'pipeline_stage';
  id: string;
  name: string;
  reason: string;
}

export interface GhlLiveValidation {
  status: GhlLiveValidationStatus;
  canReadContacts: boolean;
  checkedContacts: number;
  canReadOpportunities: boolean;
  checkedOpportunities: number;
  canReadTags: boolean;
  tagsFound: number;
  canReadPipelines: boolean;
  pipelinesFound: number;
  stagesFound: number;
  missingSavedMappings: GhlMissingRemoteMapping[];
  warnings: string[];
  requiredActions: string[];
  lastValidatedAt: string | null;
  rawSecretsReturned: false;
  rawPayloadReturned: false;
}

export interface GhlMappingOutcome {
  key: string;
  label: string;
  category: 'pipeline_stage' | 'lead_temperature';
  covered: boolean;
}

export interface GhlMappingAcceptance {
  status: GhlMappingAcceptanceStatus;
  readyForReadSync: boolean;
  coveredOutcomes: GhlMappingOutcome[];
  missingRequiredOutcomes: GhlMappingOutcome[];
  warnings: string[];
  rawSecretsReturned: false;
}

export interface GhlSetupWizardState {
  tenantKey: string;
  currentStep: GhlWizardStep;
  credentialStatus: GhlCredentialStatus;
  mappingReadiness: GhlMappingReadiness;
  connectionAcceptance: GhlConnectionAcceptance;
  mappingAcceptance: GhlMappingAcceptance;
  liveWriteBlocked: true;
  blockReason: string;
  completedSteps: GhlWizardStep[];
}
