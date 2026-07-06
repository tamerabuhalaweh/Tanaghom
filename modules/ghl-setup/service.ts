import { auditLog } from '@shared/logging';
import { LeadConnectorClient, type GhlConnectionTestResult } from '../ghl-sync/client';
import { checkGhlSetupReadPermission, checkGhlSetupWritePermission } from './policy';
import * as repo from './repository';
import type {
  GhlConnectionAcceptance,
  GhlCredentialStatus,
  GhlMappingAcceptance,
  GhlSetupWizardState,
  GhlWizardStep,
  GhlTagMapping,
  GhlPipelineMapping,
  GhlLocationMapping,
  GhlMappingReadiness,
} from './types';

const LIVE_WRITE_BLOCK_REASON = 'GHL live writes are not authorized in this environment. All CRM operations are read-only or dry-run.';

const REQUIRED_PIPELINE_OUTCOMES = [
  { key: 'meeting_booked', label: 'Meeting booked' },
  { key: 'meeting_attended', label: 'Meeting attended' },
  { key: 'no_show', label: 'No-show' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'lost', label: 'Lost' },
  { key: 'follow_up_needed', label: 'Follow-up needed' },
] as const;

const REQUIRED_TEMPERATURE_OUTCOMES = [
  { key: 'warm', label: 'Warm lead' },
  { key: 'hot', label: 'Hot lead' },
  { key: 'buyer', label: 'Buyer' },
] as const;

interface GhlConnectionTestClient {
  testConnection(): Promise<GhlConnectionTestResult>;
}

function defaultClientFactory(config: repo.GhlSetupRuntimeConfig): GhlConnectionTestClient {
  return new LeadConnectorClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    locationId: config.locationId,
    version: process.env.GHL_API_VERSION || '2021-07-28',
  });
}

export async function getWizardState(role: string, tenantKey: string): Promise<GhlSetupWizardState> {
  checkGhlSetupReadPermission(role);

  const credentialStatus = await repo.getGhlCredentialStatus(tenantKey);
  const mappingReadiness = await repo.getGhlMappingReadiness(tenantKey);
  const connectionAcceptance = buildConnectionAcceptance(credentialStatus);
  const mappingAcceptance = buildMappingAcceptance(mappingReadiness);

  const completedSteps: GhlWizardStep[] = [];
  if (credentialStatus.status !== 'missing') {
    completedSteps.push('credentials');
  }
  if (credentialStatus.hasApiKey && credentialStatus.hasLocationId) {
    completedSteps.push('location');
  }
  if (mappingReadiness.tags.state !== 'not_started') {
    completedSteps.push('tags');
  }
  if (mappingReadiness.pipelines.state !== 'not_started') {
    completedSteps.push('pipeline');
  }

  let currentStep: GhlWizardStep = 'credentials';
  if (!credentialStatus.hasApiKey || !credentialStatus.hasLocationId) {
    currentStep = 'credentials';
  } else if (mappingReadiness.location.state === 'not_started') {
    currentStep = 'location';
  } else if (mappingReadiness.tags.state === 'not_started') {
    currentStep = 'tags';
  } else if (mappingReadiness.pipelines.state === 'not_started') {
    currentStep = 'pipeline';
  } else {
    currentStep = 'review';
  }

  return {
    tenantKey,
    currentStep,
    credentialStatus,
    mappingReadiness,
    connectionAcceptance,
    mappingAcceptance,
    liveWriteBlocked: true,
    blockReason: LIVE_WRITE_BLOCK_REASON,
    completedSteps,
  };
}

export async function testGhlConnection(
  role: string,
  userId: string,
  tenantKey: string,
  clientFactory = defaultClientFactory,
): Promise<GhlConnectionAcceptance> {
  checkGhlSetupWritePermission(role);

  const config = await repo.resolveGhlSetupRuntimeConfig(tenantKey);
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') {
    return {
      status: 'requires_credentials',
      canReadContacts: false,
      checkedContacts: 0,
      lastValidatedAt: null,
      requiredActions: ['Save the customer-owned GoHighLevel API key and location ID first.'],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }

  try {
    const result = await clientFactory(config).testConnection();
    const validatedAt = new Date();
    await repo.markGhlCredentialValidated(tenantKey, validatedAt);
    auditLog(
      { actor: `user:${userId}`, action: 'ghl_credential_accepted', object_type: 'ghl_setup', object_id: tenantKey, result: 'success' },
      `GHL credential accepted for tenant ${tenantKey} through a read-only contact search.`,
    );
    return {
      status: 'accepted',
      canReadContacts: true,
      checkedContacts: result.checkedContacts,
      lastValidatedAt: validatedAt.toISOString(),
      requiredActions: [],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  } catch (err) {
    auditLog(
      { actor: `user:${userId}`, action: 'ghl_credential_acceptance_failed', object_type: 'ghl_setup', object_id: tenantKey, result: 'failed' },
      `GHL credential acceptance failed for tenant ${tenantKey}: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
    return {
      status: 'failed',
      canReadContacts: false,
      checkedContacts: 0,
      lastValidatedAt: null,
      requiredActions: ['Check the GoHighLevel API key, location ID, location access, and API version, then test again.'],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }
}

export async function validateMappingAcceptance(role: string, tenantKey: string): Promise<GhlMappingAcceptance> {
  checkGhlSetupReadPermission(role);
  const readiness = await repo.getGhlMappingReadiness(tenantKey);
  return buildMappingAcceptance(readiness);
}

export async function saveTagMappings(
  role: string,
  userId: string,
  tenantKey: string,
  mappings: Omit<GhlTagMapping, 'status'>[],
): Promise<{ saved: number; liveWriteBlocked: true }> {
  checkGhlSetupWritePermission(role);

  for (const mapping of mappings) {
    await repo.saveTagMapping(tenantKey, userId, mapping);
  }

  auditLog(
    { actor: `user:${userId}`, action: 'ghl_tag_mappings_saved', object_type: 'ghl_setup', object_id: tenantKey, result: 'success' },
    `${mappings.length} GHL tag mappings saved for tenant ${tenantKey}`,
  );

  return { saved: mappings.length, liveWriteBlocked: true };
}

export async function savePipelineMappings(
  role: string,
  userId: string,
  tenantKey: string,
  mappings: Omit<GhlPipelineMapping, 'status'>[],
): Promise<{ saved: number; liveWriteBlocked: true }> {
  checkGhlSetupWritePermission(role);

  for (const mapping of mappings) {
    await repo.savePipelineMapping(tenantKey, userId, mapping);
  }

  auditLog(
    { actor: `user:${userId}`, action: 'ghl_pipeline_mappings_saved', object_type: 'ghl_setup', object_id: tenantKey, result: 'success' },
    `${mappings.length} GHL pipeline mappings saved for tenant ${tenantKey}`,
  );

  return { saved: mappings.length, liveWriteBlocked: true };
}

export async function saveLocationMapping(
  role: string,
  userId: string,
  tenantKey: string,
  mapping: Omit<GhlLocationMapping, 'status'>,
): Promise<{ saved: boolean; liveWriteBlocked: true }> {
  checkGhlSetupWritePermission(role);

  await repo.saveLocationMapping(tenantKey, userId, mapping);

  auditLog(
    { actor: `user:${userId}`, action: 'ghl_location_mapping_saved', object_type: 'ghl_setup', object_id: tenantKey, result: 'success' },
    `GHL location mapping saved for tenant ${tenantKey}`,
  );

  return { saved: true, liveWriteBlocked: true };
}

export async function attemptLiveWrite(
  role: string,
  tenantKey: string,
): Promise<{ allowed: false; reason: string }> {
  checkGhlSetupReadPermission(role);

  auditLog(
    { actor: `tenant:${tenantKey}`, action: 'ghl_live_write_blocked', object_type: 'ghl_setup', object_id: tenantKey, result: 'denied' },
    `GHL live write blocked for tenant ${tenantKey}: ${LIVE_WRITE_BLOCK_REASON}`,
  );

  return { allowed: false, reason: LIVE_WRITE_BLOCK_REASON };
}

function buildConnectionAcceptance(credentialStatus: GhlCredentialStatus): GhlConnectionAcceptance {
  if (!credentialStatus.hasApiKey || !credentialStatus.hasLocationId) {
    return {
      status: 'requires_credentials',
      canReadContacts: false,
      checkedContacts: 0,
      lastValidatedAt: credentialStatus.lastValidatedAt,
      requiredActions: ['Save the customer-owned GoHighLevel API key and location ID.'],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }

  if (credentialStatus.status === 'validated') {
    return {
      status: 'accepted',
      canReadContacts: true,
      checkedContacts: 0,
      lastValidatedAt: credentialStatus.lastValidatedAt,
      requiredActions: [],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }

  return {
    status: 'needs_test',
    canReadContacts: false,
    checkedContacts: 0,
    lastValidatedAt: credentialStatus.lastValidatedAt,
    requiredActions: ['Run the read-only GHL connection test to accept this credential.'],
    rawSecretsReturned: false,
    rawPayloadReturned: false,
  };
}

function buildMappingAcceptance(readiness: GhlMappingReadiness): GhlMappingAcceptance {
  const pipelineTargets = new Set(
    readiness.pipelines.items
      .filter(item => item.status === 'mapped')
      .map(item => item.internalStage),
  );
  const temperatureTargets = new Set(
    readiness.tags.items
      .filter(item => item.status === 'mapped')
      .map(item => item.internalTag),
  );

  const pipelineOutcomes = REQUIRED_PIPELINE_OUTCOMES.map(outcome => ({
    ...outcome,
    category: 'pipeline_stage' as const,
    covered: pipelineTargets.has(outcome.key),
  }));
  const temperatureOutcomes = REQUIRED_TEMPERATURE_OUTCOMES.map(outcome => ({
    ...outcome,
    category: 'lead_temperature' as const,
    covered: temperatureTargets.has(outcome.key),
  }));
  const coveredOutcomes = [...pipelineOutcomes, ...temperatureOutcomes];
  const missingRequiredOutcomes = coveredOutcomes.filter(outcome => !outcome.covered);
  const hasAnyMapping = readiness.tags.totalCount > 0 || readiness.pipelines.totalCount > 0 || readiness.location.mapping !== null;
  const warnings: string[] = [];

  if (readiness.location.state !== 'ready') {
    warnings.push('Map the customer GoHighLevel location before read sync is production-ready.');
  }
  if (missingRequiredOutcomes.length) {
    warnings.push('Complete lead-status and temperature mappings so meetings, no-shows, purchases, and buyer intent are reported correctly.');
  }
  if (process.env.GHL_READ_SYNC_ENABLED !== 'true') {
    warnings.push('GHL_READ_SYNC_ENABLED is off. Read sync will remain blocked until the environment is authorized.');
  }

  const readyForReadSync = readiness.location.state === 'ready'
    && missingRequiredOutcomes.length === 0
    && process.env.GHL_READ_SYNC_ENABLED === 'true';

  return {
    status: readyForReadSync ? 'ready' : hasAnyMapping ? 'partial' : 'not_ready',
    readyForReadSync,
    coveredOutcomes,
    missingRequiredOutcomes,
    warnings,
    rawSecretsReturned: false,
  };
}
