import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ExternalServiceError, NotFoundError } from '@shared/errors';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import { buildGhlMappingSet, countMappedStages, countMappedTags, mapGhlLead } from './mapper';
import type { GhlClient } from './client';
import type {
  GhlMappedLead,
  GhlPullResult,
  GhlSyncMode,
  GhlSyncRunSummary,
  GhlSyncStatus,
  GhlSyncStatusSummary,
  GhlWriteBackPreview,
} from './types';

export interface GhlRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  source: 'tenant_vault' | 'missing';
}

function normalizeJsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function credentialConfigured(config: GhlRuntimeConfig): boolean {
  return Boolean(config.apiKey && config.locationId && config.source === 'tenant_vault');
}

export async function resolveGhlSyncRuntimeConfig(tenantKey: string): Promise<GhlRuntimeConfig> {
  const credential = await getActiveIntegrationCredential('gohighlevel', 'api_key', tenantKey);
  if (!credential) {
    return {
      baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
      apiKey: '',
      locationId: '',
      source: 'missing',
    };
  }
  return {
    baseUrl: credential.secrets.baseUrl || process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
    apiKey: credential.secrets.apiKey || '',
    locationId: credential.secrets.locationId || '',
    source: 'tenant_vault',
  };
}

export async function getGhlSyncStatus(tenantKey: string, eventId?: string): Promise<GhlSyncStatusSummary> {
  if (eventId) await assertEventOwnedByTenant(tenantKey, eventId);
  const [config, mappings, lastRun, ghlLeadCount] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    getMappingRecords(tenantKey),
    prisma.ghlLeadSyncRun.findFirst({
      where: { tenant_key: tenantKey, event_id: eventId || undefined },
      orderBy: { started_at: 'desc' },
    }),
    prisma.leadCaptureRecord.count({
      where: {
        tenant_key: tenantKey,
        event_id: eventId || undefined,
        source_of_truth: 'gohighlevel',
      },
    }),
  ]);

  const mappingStatus = summarizeMappingStatus(mappings);
  const requiredActions: string[] = [];
  if (!credentialConfigured(config)) requiredActions.push('Configure tenant-owned GoHighLevel API key and location id.');
  if (mappingStatus !== 'ready') requiredActions.push('Map GoHighLevel tags and pipeline stages to Tanaghum lead statuses/temperatures.');
  if (process.env.GHL_READ_SYNC_ENABLED !== 'true') requiredActions.push('Enable GHL_READ_SYNC_ENABLED=true before live read sync.');
  if (process.env.GHL_WRITE_BACK_ENABLED !== 'true') requiredActions.push('Write-back is disabled by default; enable only after customer authorization.');

  return {
    tenantKey,
    eventId: eventId || null,
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    credentialStatus: credentialConfigured(config) ? 'configured' : 'missing',
    mappingStatus,
    readSyncEnabled: process.env.GHL_READ_SYNC_ENABLED === 'true',
    writeBackEnabled: process.env.GHL_WRITE_BACK_ENABLED === 'true',
    ghlLeadCount,
    lastSyncAt: lastRun?.completed_at ?? null,
    lastRun: lastRun ? mapRun(lastRun) : null,
    requiredActions,
  };
}

export async function previewPull(
  tenantKey: string,
  userId: string,
  eventId: string | undefined,
  limit: number,
  clientFactory: (config: GhlRuntimeConfig) => GhlClient,
): Promise<{ run: GhlSyncRunSummary; contacts: GhlMappedLead[] }> {
  return pullInternal(tenantKey, userId, eventId, limit, 'pull_preview', clientFactory);
}

export async function syncPull(
  tenantKey: string,
  userId: string,
  agentRepId: string,
  eventId: string | undefined,
  limit: number,
  clientFactory: (config: GhlRuntimeConfig) => GhlClient,
): Promise<{ run: GhlSyncRunSummary; upserted: GhlMappedLead[] }> {
  const result = await pullInternal(tenantKey, userId, eventId, limit, 'pull_sync', clientFactory);
  const now = new Date();
  const upserted: GhlMappedLead[] = [];
  for (const mappedLead of result.contacts) {
    await upsertGhlLeadMirror(tenantKey, userId, agentRepId, eventId, mappedLead, now);
    upserted.push(mappedLead);
  }
  const run = await prisma.ghlLeadSyncRun.update({
    where: { id: result.run.id },
    data: {
      status: 'synced',
      leads_upserted: upserted.length,
      completed_at: now,
    },
  });
  return { run: mapRun(run), upserted };
}

async function pullInternal(
  tenantKey: string,
  userId: string,
  eventId: string | undefined,
  limit: number,
  mode: Extract<GhlSyncMode, 'pull_preview' | 'pull_sync'>,
  clientFactory: (config: GhlRuntimeConfig) => GhlClient,
): Promise<{ run: GhlSyncRunSummary; contacts: GhlMappedLead[]; pull: GhlPullResult }> {
  if (eventId) await assertEventOwnedByTenant(tenantKey, eventId);
  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  const mappings = await getMappingRecords(tenantKey);
  const mappingSet = buildGhlMappingSet(mappings);
  const mappingStatus = summarizeMappingStatus(mappings);
  const baseRun = {
    tenant_key: tenantKey,
    event_id: eventId || null,
    mode,
    source_of_truth: 'gohighlevel' as const,
    created_by_user_id: userId,
    raw_payload_returned: false,
  };

  if (!credentialConfigured(config)) {
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'requires_credentials',
        errors: ['Tenant-owned GoHighLevel API key and location id are required.'],
        completed_at: new Date(),
      },
    });
    return { run: mapRun(run), contacts: [], pull: { contacts: [], opportunities: [], rawReturned: false } };
  }

  if (process.env.GHL_READ_SYNC_ENABLED !== 'true') {
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'blocked',
        errors: ['GHL_READ_SYNC_ENABLED is not true.'],
        completed_at: new Date(),
      },
    });
    return { run: mapRun(run), contacts: [], pull: { contacts: [], opportunities: [], rawReturned: false } };
  }

  try {
    const pull = await clientFactory(config).pull(limit);
    const mapped = pull.contacts.map(contact => mapGhlLead(
      contact,
      pull.opportunities.filter(opportunity => opportunity.contactId === contact.id),
      mappingSet,
    ));
    const tagsMapped = pull.contacts.reduce((total, contact) => total + countMappedTags(contact, mappingSet), 0);
    const stagesMapped = countMappedStages(pull.opportunities, mappingSet);
    const warnings = mappingStatus === 'ready' ? [] : ['GHL mapping is incomplete. Contacts were mirrored with conservative fallback status/temperature.'];
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: mode === 'pull_preview' ? 'previewed' : 'previewed',
        contacts_pulled: pull.contacts.length,
        opportunities_pulled: pull.opportunities.length,
        tags_mapped: tagsMapped,
        stages_mapped: stagesMapped,
        warnings,
        completed_at: mode === 'pull_preview' ? new Date() : null,
      },
    });
    return { run: mapRun(run), contacts: mapped, pull };
  } catch (err) {
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'failed',
        errors: [err instanceof Error ? err.message : 'GoHighLevel pull failed.'],
        completed_at: new Date(),
      },
    });
    return { run: mapRun(run), contacts: [], pull: { contacts: [], opportunities: [], rawReturned: false } };
  }
}

export async function buildWriteBackPreview(tenantKey: string, userId: string, leadId: string): Promise<GhlWriteBackPreview> {
  const [config, lead, mappings] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    prisma.leadCaptureRecord.findFirst({ where: { id: leadId, tenant_key: tenantKey } }),
    getMappingRecords(tenantKey),
  ]);
  if (!lead) throw new NotFoundError('LeadCaptureRecord', leadId);
  const mappedTags = outboundTagsForLead(String(lead.lead_status), String(lead.lead_temperature), mappings);
  const reasons: string[] = [];
  if (!credentialConfigured(config)) reasons.push('Tenant-owned GoHighLevel credentials are missing.');
  if (!lead.external_source_id) reasons.push('Lead is not linked to a GoHighLevel contact id.');
  if (process.env.GHL_WRITE_BACK_ENABLED !== 'true') reasons.push('GHL_WRITE_BACK_ENABLED is not true.');

  await prisma.ghlLeadSyncRun.create({
    data: {
      tenant_key: tenantKey,
      event_id: lead.event_id,
      mode: 'write_back_preview',
      status: reasons.length ? 'blocked' : 'previewed',
      source_of_truth: 'gohighlevel',
      write_backs_prepared: 1,
      warnings: reasons,
      raw_payload_returned: false,
      created_by_user_id: userId,
      completed_at: new Date(),
    },
  });

  return {
    leadId,
    ghlContactId: lead.external_source_id,
    ghlOpportunityId: lead.external_opportunity_id,
    endpoint: `${config.baseUrl}/contacts/upsert`,
    payload: {
      locationId: config.locationId || '<tenant configured location id>',
      contactId: lead.external_source_id || undefined,
      tags: mappedTags,
      customFields: [
        { key: 'tanaghum_lead_status', field_value: String(lead.lead_status) },
        { key: 'tanaghum_lead_temperature', field_value: String(lead.lead_temperature) },
        { key: 'tanaghum_next_action', field_value: String(lead.next_action || '') },
      ],
    },
    execution: reasons.length ? 'blocked' : 'preview_only',
    reasons,
  };
}

export async function executeWriteBack(
  tenantKey: string,
  userId: string,
  leadId: string,
  clientFactory: (config: GhlRuntimeConfig) => GhlClient,
): Promise<GhlWriteBackPreview> {
  const preview = await buildWriteBackPreview(tenantKey, userId, leadId);
  if (preview.reasons.length > 0) return preview;

  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  const lead = await prisma.leadCaptureRecord.findFirst({ where: { id: leadId, tenant_key: tenantKey } });
  if (!lead) throw new NotFoundError('LeadCaptureRecord', leadId);

  const response = await clientFactory(config).upsertContact(preview.payload);
  if (!response.ok) {
    await prisma.ghlLeadSyncRun.create({
      data: {
        tenant_key: tenantKey,
        event_id: lead.event_id,
        mode: 'write_back',
        status: 'failed',
        source_of_truth: 'gohighlevel',
        write_backs_prepared: 1,
        errors: [`GoHighLevel write-back failed with status ${response.status}.`],
        raw_payload_returned: false,
        created_by_user_id: userId,
        completed_at: new Date(),
      },
    });
    throw new ExternalServiceError('GoHighLevel', `Write-back failed with status ${response.status}`);
  }

  await prisma.ghlLeadSyncRun.create({
    data: {
      tenant_key: tenantKey,
      event_id: lead.event_id,
      mode: 'write_back',
      status: 'synced',
      source_of_truth: 'gohighlevel',
      write_backs_prepared: 1,
      raw_payload_returned: false,
      created_by_user_id: userId,
      completed_at: new Date(),
    },
  });

  return {
    ...preview,
    execution: 'executed',
    reasons: [],
  };
}

async function upsertGhlLeadMirror(
  tenantKey: string,
  userId: string,
  agentRepId: string,
  eventId: string | undefined,
  mappedLead: GhlMappedLead,
  syncedAt: Date,
): Promise<void> {
  const existing = await prisma.leadCaptureRecord.findFirst({
    where: {
      tenant_key: tenantKey,
      OR: [
        { external_source_provider: 'gohighlevel', external_source_id: mappedLead.ghlContactId },
        ...(mappedLead.leadEmail ? [{ lead_email_placeholder: mappedLead.leadEmail }] : []),
        ...(mappedLead.leadPhone ? [{ lead_phone_placeholder: mappedLead.leadPhone }] : []),
      ],
    },
  });
  const data = {
    event_id: eventId || existing?.event_id || null,
    lead_status: mappedLead.leadStatus,
    lead_temperature: mappedLead.leadTemperature,
    channel_attribution: 'manual' as const,
    lead_source: mappedLead.leadSource,
    platform: 'gohighlevel',
    lead_name_placeholder: mappedLead.leadName,
    lead_email_placeholder: mappedLead.leadEmail,
    lead_phone_placeholder: mappedLead.leadPhone,
    purchase_amount: mappedLead.purchaseAmount == null ? null : new Prisma.Decimal(mappedLead.purchaseAmount),
    purchase_reference: mappedLead.purchaseReference,
    meeting_outcome: mappedLead.meetingOutcome,
    source_of_truth: 'gohighlevel' as const,
    external_source_provider: 'gohighlevel',
    external_source_id: mappedLead.ghlContactId,
    external_opportunity_id: mappedLead.ghlOpportunityId,
    external_pipeline_id: mappedLead.pipelineId,
    external_stage_id: mappedLead.stageId,
    external_tags: mappedLead.tags,
    external_last_synced_at: syncedAt,
    external_sync_fingerprint: mappedLead.syncFingerprint,
  };
  if (existing) {
    await prisma.leadCaptureRecord.update({ where: { id: existing.id }, data });
    if (existing.lead_status !== mappedLead.leadStatus || existing.lead_temperature !== mappedLead.leadTemperature) {
      await prisma.leadLifecycleEvent.create({
        data: {
          tenant_key: tenantKey,
          lead_id: existing.id,
          from_status: existing.lead_status,
          to_status: mappedLead.leadStatus,
          from_temperature: existing.lead_temperature,
          to_temperature: mappedLead.leadTemperature,
          actor_user_id: userId,
          reason: 'GoHighLevel source-of-truth sync',
          metadata: { provider: 'gohighlevel', contactId: mappedLead.ghlContactId, opportunityId: mappedLead.ghlOpportunityId },
        },
      });
    }
    return;
  }

  const created = await prisma.leadCaptureRecord.create({
    data: {
      ...data,
      tenant_key: tenantKey,
      consent_status: 'pending',
      created_by_user_id: userId,
      created_by_agent_rep_id: agentRepId,
    },
  });
  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: created.id,
      to_status: mappedLead.leadStatus,
      to_temperature: mappedLead.leadTemperature,
      actor_user_id: userId,
      reason: 'GoHighLevel source-of-truth lead imported',
      metadata: { provider: 'gohighlevel', contactId: mappedLead.ghlContactId, opportunityId: mappedLead.ghlOpportunityId },
    },
  });
}

async function assertEventOwnedByTenant(tenantKey: string, eventId: string): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey }, select: { id: true } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
}

async function getMappingRecords(tenantKey: string) {
  return prisma.connectorFieldMapping.findMany({
    where: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel',
    },
    select: {
      field_mappings: true,
      validation_status: true,
    },
  });
}

function summarizeMappingStatus(records: Array<{ field_mappings: unknown; validation_status: string }>): 'missing' | 'partial' | 'ready' {
  const valid = records.filter(record => record.validation_status === 'valid');
  const hasTag = valid.some(record => {
    const fields = record.field_mappings as Record<string, unknown> | null;
    return fields?.mappingType === 'tag';
  });
  const hasPipeline = valid.some(record => {
    const fields = record.field_mappings as Record<string, unknown> | null;
    return fields?.mappingType === 'pipeline';
  });
  if (hasTag && hasPipeline) return 'ready';
  if (hasTag || hasPipeline || records.length > 0) return 'partial';
  return 'missing';
}

function outboundTagsForLead(status: string, temperature: string, mappings: Array<{ field_mappings: unknown; validation_status: string }>): string[] {
  const tags = new Set<string>();
  for (const mapping of mappings) {
    if (mapping.validation_status !== 'valid') continue;
    const fields = mapping.field_mappings as Record<string, unknown> | null;
    if (!fields || fields.mappingType !== 'tag') continue;
    if (fields.direction === 'inbound') continue;
    const internal = String(fields.internalTag || '');
    if (internal === status || internal === temperature) {
      tags.add(String(fields.ghlTagName || fields.ghlTagId || '').trim());
    }
  }
  return Array.from(tags).filter(Boolean);
}

function mapRun(run: {
  id: string;
  tenant_key: string;
  event_id: string | null;
  mode: GhlSyncMode;
  status: GhlSyncStatus;
  contacts_pulled: number;
  opportunities_pulled: number;
  leads_upserted: number;
  tags_mapped: number;
  stages_mapped: number;
  write_backs_prepared: number;
  errors: unknown;
  warnings: unknown;
  raw_payload_returned: boolean;
  started_at: Date;
  completed_at: Date | null;
}): GhlSyncRunSummary {
  return {
    id: run.id,
    tenantKey: run.tenant_key,
    eventId: run.event_id,
    mode: run.mode,
    status: run.status,
    sourceOfTruth: 'gohighlevel',
    contactsPulled: run.contacts_pulled,
    opportunitiesPulled: run.opportunities_pulled,
    leadsUpserted: run.leads_upserted,
    tagsMapped: run.tags_mapped,
    stagesMapped: run.stages_mapped,
    writeBacksPrepared: run.write_backs_prepared,
    errors: normalizeJsonArray(run.errors),
    warnings: normalizeJsonArray(run.warnings),
    rawPayloadReturned: false,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  };
}
