import { auditLog } from '@shared/logging';
import { checkGhlSetupReadPermission, checkGhlSetupWritePermission } from './policy';
import * as repo from './repository';
import type {
  GhlSetupWizardState,
  GhlWizardStep,
  GhlTagMapping,
  GhlPipelineMapping,
  GhlLocationMapping,
} from './types';

const LIVE_WRITE_BLOCK_REASON = 'GHL live writes are not authorized in this environment. All CRM operations are read-only or dry-run.';

export async function getWizardState(role: string, tenantKey: string): Promise<GhlSetupWizardState> {
  checkGhlSetupReadPermission(role);

  const credentialStatus = await repo.getGhlCredentialStatus(tenantKey);
  const mappingReadiness = await repo.getGhlMappingReadiness(tenantKey);

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
    liveWriteBlocked: true,
    blockReason: LIVE_WRITE_BLOCK_REASON,
    completedSteps,
  };
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
