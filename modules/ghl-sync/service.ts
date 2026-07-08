import { UnauthorizedError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { LeadConnectorClient } from './client';
import { checkGhlSyncPermission } from './policy';
import {
  buildWriteBackPreview,
  executeWriteBack,
  getGhlSyncStatus,
  previewPull,
  syncPull,
  type GhlRuntimeConfig,
} from './repository';
import type { GhlPullInput, GhlWriteBackInput } from './types';

function clientFactory(config: GhlRuntimeConfig) {
  return new LeadConnectorClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    locationId: config.locationId,
    version: process.env.GHL_API_VERSION || '2021-07-28',
  });
}

export async function status(role: string, tenantKey: string, eventId?: string) {
  checkGhlSyncPermission(role, 'ghl_sync:read');
  return getGhlSyncStatus(tenantKey, eventId);
}

export async function pullPreview(role: string, tenantKey: string, userId: string, input: GhlPullInput) {
  checkGhlSyncPermission(role, 'ghl_sync:pull');
  const result = await previewPull(tenantKey, userId, input.eventId, input.limit, clientFactory);
  auditLog(
    { actor: `user:${userId}`, action: 'ghl_pull_preview', object_type: 'ghl_sync', object_id: result.run.id, result: result.run.status },
    `GHL pull preview completed with status ${result.run.status}`,
  );
  return {
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    run: result.run,
    previewLeads: result.contacts,
    rawPayloadReturned: false,
  };
}

export async function pullSync(role: string, tenantKey: string, userId: string, agentRepId: string | undefined, input: GhlPullInput) {
  checkGhlSyncPermission(role, 'ghl_sync:pull');
  if (!agentRepId) throw new UnauthorizedError('Session context incomplete: agentRepId missing');
  const result = await syncPull(tenantKey, userId, agentRepId, input.eventId, input.limit, clientFactory);
  auditLog(
    { actor: `user:${userId}`, action: 'ghl_pull_sync', object_type: 'ghl_sync', object_id: result.run.id, result: result.run.status },
    `GHL pull sync completed with ${result.run.leadsUpserted} lead mirrors`,
  );
  return {
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    run: result.run,
    upsertedLeads: result.upserted,
    rawPayloadReturned: false,
  };
}

export async function writeBackPreview(role: string, tenantKey: string, userId: string, input: GhlWriteBackInput) {
  checkGhlSyncPermission(role, 'ghl_sync:write_back');
  const preview = await buildWriteBackPreview(tenantKey, userId, input.leadId);
  auditLog(
    { actor: `user:${userId}`, action: 'ghl_write_back_preview', object_type: 'lead', object_id: input.leadId, result: preview.execution },
    `GHL write-back preview ${preview.execution}`,
  );
  return {
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    preview,
    rawPayloadReturned: false,
  };
}

export async function writeBack(role: string, tenantKey: string, userId: string, input: GhlWriteBackInput) {
  checkGhlSyncPermission(role, 'ghl_sync:write_back');
  const preview = await executeWriteBack(tenantKey, userId, input.leadId, clientFactory);
  auditLog(
    { actor: `user:${userId}`, action: 'ghl_write_back', object_type: 'lead', object_id: input.leadId, result: preview.execution },
    `GHL write-back ${preview.execution}`,
  );
  return {
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    preview,
    rawPayloadReturned: false,
  };
}
