import { Prisma, type GhlPlanAttributionMapping } from '@prisma/client';
import { prisma } from '@shared/database';
import { ExternalServiceError, NotFoundError } from '@shared/errors';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import { getGhlMappingReadiness } from '../ghl-setup/repository';
import { getApprovedMappingForEvent } from '../ghl-plan-attribution/repository';
import { evaluateGhlAttribution, readGhlCustomField } from '../ghl-plan-attribution/matcher';
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

const GHL_READ_PROVIDER_ENDPOINT = [
  'POST /contacts/search',
  'GET /opportunities/search',
  'GET /contacts/{contactId}/appointments',
].join(' + ');

const REQUIRED_PIPELINE_OUTCOMES = [
  ['meeting_booked', 'Meeting booked'],
  ['meeting_attended', 'Meeting attended'],
  ['no_show', 'No-show'],
  ['purchased', 'Purchased'],
  ['lost', 'Lost'],
  ['follow_up_needed', 'Follow-up needed'],
] as const;

const REQUIRED_TEMPERATURE_OUTCOMES = [
  ['warm', 'Warm lead'],
  ['hot', 'Hot lead'],
  ['buyer', 'Buyer'],
] as const;

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
  const [config, mappings, mappingReadiness, attributionMapping, lastRun, ghlLeadCount] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    getMappingRecords(tenantKey),
    getGhlMappingReadiness(tenantKey),
    eventId ? getApprovedMappingForEvent(tenantKey, eventId) : Promise.resolve(null),
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

  const mappingBlockers = productionMappingBlockers(mappingReadiness);
  if (eventId && !attributionMapping) {
    mappingBlockers.push('Approve a plan-specific GHL attribution mapping for this event.');
  }
  const mappingStatus = summarizeProductionMappingStatus(mappings, mappingReadiness, mappingBlockers);
  const readSyncEnabled = process.env.GHL_READ_SYNC_ENABLED === 'true';
  const writeBackEnabled = process.env.GHL_WRITE_BACK_ENABLED === 'true';
  const requiredActions: string[] = [];
  if (!credentialConfigured(config)) requiredActions.push('Configure tenant-owned GoHighLevel API key and location id.');
  if (mappingStatus !== 'ready') requiredActions.push(...mappingBlockers);
  if (!readSyncEnabled) requiredActions.push('Enable GHL_READ_SYNC_ENABLED=true before live read sync.');
  if (!writeBackEnabled) requiredActions.push('Write-back is disabled by default; enable only after customer authorization.');
  const acceptance = buildGhlAcceptance({
    credentialConfigured: credentialConfigured(config),
    mappingStatus,
    readSyncEnabled,
    lastRun: lastRun ? mapRun(lastRun) : null,
  });

  return {
    tenantKey,
    eventId: eventId || null,
    sourceOfTruth: 'gohighlevel',
    tanaghumRole: 'operating_reporting_layer',
    credentialStatus: credentialConfigured(config) ? 'configured' : 'missing',
    mappingStatus,
    readSyncEnabled,
    writeBackEnabled,
    acceptance,
    ghlLeadCount,
    lastSyncAt: lastRun?.completed_at ?? null,
    lastRun: lastRun ? mapRun(lastRun) : null,
    requiredActions,
  };
}

function buildGhlAcceptance(input: {
  credentialConfigured: boolean;
  mappingStatus: 'missing' | 'partial' | 'ready';
  readSyncEnabled: boolean;
  lastRun: GhlSyncRunSummary | null;
}): GhlSyncStatusSummary['acceptance'] {
  if (!input.credentialConfigured) {
    return {
      status: 'requires_credentials',
      readyForReadSync: false,
      customerAction: 'Save the customer-owned GHL API key and location ID.',
      systemAction: 'After credentials are saved, validate read-only CRM access before syncing leads.',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    };
  }

  if (input.mappingStatus !== 'ready') {
    return {
      status: 'requires_mapping',
      readyForReadSync: false,
      customerAction: 'Map GHL tags and pipeline stages to lead status, temperature, meetings, no-shows, and purchases.',
      systemAction: 'Use mapping validation before running a production pull sync.',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    };
  }

  if (!input.readSyncEnabled) {
    return {
      status: 'blocked_by_environment',
      readyForReadSync: false,
      customerAction: 'No customer action needed after credentials and mappings are ready.',
      systemAction: 'Enable GHL_READ_SYNC_ENABLED=true in the environment after customer approval.',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    };
  }

  if (input.lastRun?.status === 'synced') {
    return {
      status: 'synced',
      readyForReadSync: true,
      customerAction: 'Review mirrored CRM leads in the event dashboard.',
      systemAction: 'Continue scheduled or manual read syncs using GHL as the source of truth.',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    };
  }

  return {
    status: 'ready_for_read_sync',
    readyForReadSync: true,
    customerAction: 'Approve a read-only GHL pull preview or sync for the selected event.',
    systemAction: 'Pull contacts, opportunities, appointments, purchases, tags, and stages from GHL without writing back.',
    readOnly: true,
    externalWritesAllowed: false,
    rawSecretsReturned: false,
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
    await upsertGhlLeadMirror(
      tenantKey,
      userId,
      agentRepId,
      eventId,
      result.attributionMapping,
      mappedLead,
      now,
    );
    upserted.push(mappedLead);
  }
  const run = await prisma.ghlLeadSyncRun.update({
    where: { id: result.run.id },
    data: {
      status: 'synced',
      leads_upserted: upserted.length,
      appointments_pulled: result.run.appointmentsPulled,
      attribution_mapping_id: result.run.attributionMappingId,
      warnings: result.run.warnings,
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
): Promise<{
  run: GhlSyncRunSummary;
  contacts: GhlMappedLead[];
  pull: GhlPullResult;
  attributionMapping: GhlPlanAttributionMapping | null;
}> {
  if (eventId) await assertEventOwnedByTenant(tenantKey, eventId);
  const [config, mappings, mappingReadiness, attributionMapping] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    getMappingRecords(tenantKey),
    getGhlMappingReadiness(tenantKey),
    eventId ? getApprovedMappingForEvent(tenantKey, eventId) : Promise.resolve(null),
  ]);
  const mappingSet = buildGhlMappingSet(mappings);
  const mappingBlockers = productionMappingBlockers(mappingReadiness);
  const startedAt = new Date();
  const baseRun = {
    tenant_key: tenantKey,
    event_id: eventId || null,
    attribution_mapping_id: attributionMapping?.id || null,
    mode,
    source_of_truth: 'gohighlevel' as const,
    created_by_user_id: userId,
    raw_payload_returned: false,
    provider_endpoint: GHL_READ_PROVIDER_ENDPOINT,
    started_at: startedAt,
  };

  if (!credentialConfigured(config)) {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'requires_credentials',
        errors: ['Tenant-owned GoHighLevel API key and location id are required.'],
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping,
    };
  }

  if (mappingBlockers.length > 0) {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'mapping_required',
        errors: mappingBlockers,
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping,
    };
  }

  if (eventId && !attributionMapping) {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'mapping_required',
        errors: ['Approve a plan-specific GHL attribution mapping for this event.'],
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping: null,
    };
  }

  if (attributionMapping && attributionMapping.location_id !== config.locationId) {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'mapping_required',
        errors: ['The approved plan attribution mapping belongs to a different GHL location.'],
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping,
    };
  }

  if (process.env.GHL_READ_SYNC_ENABLED !== 'true') {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'blocked',
        errors: ['GHL_READ_SYNC_ENABLED is not true.'],
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping,
    };
  }

  try {
    const pull = await clientFactory(config).pull(limit);
    const attribution = filterPullByAttribution(pull, attributionMapping);
    const mapped = attribution.contacts.map((contact) => {
      const contactOpportunities = pull.opportunities.filter(
        (opportunity) => opportunity.contactId === contact.id,
      );
      const mappedLead = mapGhlLead(
        contact,
        contactOpportunities,
        pull.appointments.filter((appointment) => appointment.contactId === contact.id),
        mappingSet,
      );
      return applyPaymentEvidence(mappedLead, contact.customFields ?? {}, attributionMapping);
    });
    const tagsMapped = attribution.contacts.reduce(
      (total, contact) => total + countMappedTags(contact, mappingSet),
      0,
    );
    const matchedContactIds = new Set(attribution.contacts.map((contact) => contact.id));
    const stagesMapped = countMappedStages(
      pull.opportunities.filter((opportunity) => matchedContactIds.has(opportunity.contactId)),
      mappingSet,
    );
    const warnings = [
      ...pull.warnings,
      ...attribution.warnings,
      ...unresolvedPaymentWarnings(attributionMapping),
    ];
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: mode === 'pull_preview' ? 'previewed' : 'previewed',
        contacts_pulled: pull.contacts.length,
        opportunities_pulled: pull.opportunities.length,
        appointments_pulled: pull.appointments.length,
        tags_mapped: tagsMapped,
        stages_mapped: stagesMapped,
        warnings,
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: mode === 'pull_preview' ? completedAt : null,
      },
    });
    return { run: mapRun(run), contacts: mapped, pull, attributionMapping };
  } catch (err) {
    const completedAt = new Date();
    const run = await prisma.ghlLeadSyncRun.create({
      data: {
        ...baseRun,
        status: 'failed',
        errors: [err instanceof Error ? err.message : 'GoHighLevel pull failed.'],
        duration_ms: durationMs(startedAt, completedAt),
        completed_at: completedAt,
      },
    });
    return {
      run: mapRun(run),
      contacts: [],
      pull: emptyPull(),
      attributionMapping,
    };
  }
}

export async function buildWriteBackPreview(tenantKey: string, userId: string, leadId: string): Promise<GhlWriteBackPreview> {
  const [config, lead, mappings] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    prisma.leadCaptureRecord.findFirst({ where: { id: leadId, tenant_key: tenantKey } }),
    getMappingRecords(tenantKey),
  ]);
  if (!lead) throw new NotFoundError('LeadCaptureRecord', leadId);
  const startedAt = new Date();
  const completedAt = new Date();
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
      provider_endpoint: `${config.baseUrl}/contacts/upsert`,
      duration_ms: durationMs(startedAt, completedAt),
      created_by_user_id: userId,
      completed_at: completedAt,
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
    const startedAt = new Date();
    const completedAt = new Date();
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
        provider_endpoint: `${config.baseUrl}/contacts/upsert`,
        duration_ms: durationMs(startedAt, completedAt),
        created_by_user_id: userId,
        completed_at: completedAt,
      },
    });
    throw new ExternalServiceError('GoHighLevel', `Write-back failed with status ${response.status}`);
  }

  const startedAt = new Date();
  const completedAt = new Date();
  await prisma.ghlLeadSyncRun.create({
    data: {
      tenant_key: tenantKey,
      event_id: lead.event_id,
      mode: 'write_back',
      status: 'synced',
      source_of_truth: 'gohighlevel',
      write_backs_prepared: 1,
      raw_payload_returned: false,
      provider_endpoint: `${config.baseUrl}/contacts/upsert`,
      duration_ms: durationMs(startedAt, completedAt),
      created_by_user_id: userId,
      completed_at: completedAt,
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
  attributionMapping: GhlPlanAttributionMapping | null,
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
    payment_status: mappedLead.paymentStatus,
    sale_value: mappedLead.saleValue == null ? null : new Prisma.Decimal(mappedLead.saleValue),
    amount_paid: mappedLead.amountPaid == null ? null : new Prisma.Decimal(mappedLead.amountPaid),
    outstanding_balance:
      mappedLead.outstandingBalance == null
        ? null
        : new Prisma.Decimal(mappedLead.outstandingBalance),
    ticket_quantity: mappedLead.ticketQuantity,
    payment_source: mappedLead.paymentSource,
    commercial_plan_id: attributionMapping?.commercial_plan_id || existing?.commercial_plan_id || null,
    ghl_attribution_mapping_id: attributionMapping?.id || existing?.ghl_attribution_mapping_id || null,
    purchase_reference: mappedLead.purchaseReference,
    meeting_date: mappedLead.meetingDate,
    meeting_type: mappedLead.meetingType,
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

type GhlMappingReadinessShape = Awaited<ReturnType<typeof getGhlMappingReadiness>>;

function summarizeProductionMappingStatus(
  records: Array<{ field_mappings: unknown; validation_status: string }>,
  readiness: GhlMappingReadinessShape,
  blockers: string[],
): 'missing' | 'partial' | 'ready' {
  if (blockers.length === 0) return 'ready';
  const hasAnyMappedData = readiness.location.mapping !== null
    || readiness.tags.totalCount > 0
    || readiness.pipelines.totalCount > 0
    || records.length > 0;
  return hasAnyMappedData ? 'partial' : 'missing';
}

function productionMappingBlockers(readiness: GhlMappingReadinessShape): string[] {
  const blockers: string[] = [];
  if (readiness.location.state !== 'ready') {
    blockers.push('Map the customer GoHighLevel location before read sync.');
  }

  const pipelineTargets = new Set(
    readiness.pipelines.items
      .filter(item => item.status === 'mapped')
      .map(item => String(item.internalStage)),
  );
  const temperatureTargets = new Set(
    readiness.tags.items
      .filter(item => item.status === 'mapped')
      .map(item => String(item.internalTag)),
  );

  for (const [key, label] of REQUIRED_PIPELINE_OUTCOMES) {
    if (!pipelineTargets.has(key)) {
      blockers.push(`Map a GoHighLevel pipeline stage for ${label}.`);
    }
  }
  for (const [key, label] of REQUIRED_TEMPERATURE_OUTCOMES) {
    if (!temperatureTargets.has(key)) {
      blockers.push(`Map a GoHighLevel tag for ${label}.`);
    }
  }
  return blockers;
}

function durationMs(startedAt: Date, completedAt: Date): number {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function emptyPull(): GhlPullResult {
  return {
    contacts: [],
    opportunities: [],
    appointments: [],
    warnings: [],
    rawReturned: false,
  };
}

function filterPullByAttribution(
  pull: GhlPullResult,
  mapping: GhlPlanAttributionMapping | null,
): { contacts: GhlPullResult['contacts']; warnings: string[] } {
  if (!mapping) return { contacts: pull.contacts, warnings: [] };
  const missingCustomFields = new Set<string>();
  const contacts = pull.contacts.filter((contact) => {
    const evaluation = evaluateGhlAttribution(mapping, {
      pipelineIds: pull.opportunities
        .filter((opportunity) => opportunity.contactId === contact.id)
        .map((opportunity) => opportunity.pipelineId || '')
        .filter(Boolean),
      tags: contact.tags,
      source: contact.source ?? null,
      customFields: contact.customFields ?? {},
    });
    evaluation.missingCustomFields.forEach((field) => missingCustomFields.add(field));
    return evaluation.matched;
  });
  const warnings: string[] = [];
  const excluded = pull.contacts.length - contacts.length;
  if (excluded > 0) {
    warnings.push(
      `${excluded} GHL contact(s) were excluded because they did not match the approved plan attribution rules.`,
    );
  }
  if (missingCustomFields.size > 0) {
    warnings.push(
      `GHL did not return configured attribution field(s): ${Array.from(missingCustomFields).sort().join(', ')}.`,
    );
  }
  return { contacts, warnings };
}

function applyPaymentEvidence(
  mappedLead: GhlMappedLead,
  customFields: Record<string, unknown>,
  mapping: GhlPlanAttributionMapping | null,
): GhlMappedLead {
  if (!mapping) return mappedLead;
  const configuredSaleValue = nonNegativeNumber(
    readGhlCustomField(customFields, mapping.sale_value_field),
  );
  const amountPaid = nonNegativeNumber(
    readGhlCustomField(customFields, mapping.payment_amount_field),
  );
  const ticketQuantity = positiveInteger(
    readGhlCustomField(customFields, mapping.ticket_quantity_field),
  );
  const saleValue = configuredSaleValue ?? mappedLead.saleValue;
  const explicitPaymentStatus = normalizePaymentStatus(
    readGhlCustomField(customFields, mapping.payment_status_field),
  );
  const paymentStatus =
    explicitPaymentStatus ??
    (mappedLead.leadStatus === 'purchased' && amountPaid !== null
      ? saleValue !== null && amountPaid >= saleValue
        ? 'paid_in_full'
        : amountPaid > 0
          ? 'partial'
          : 'unknown'
      : 'unknown');
  return {
    ...mappedLead,
    saleValue,
    amountPaid,
    outstandingBalance:
      saleValue !== null && amountPaid !== null ? Math.max(0, saleValue - amountPaid) : null,
    ticketQuantity,
    paymentStatus,
    paymentSource: mappedLead.leadStatus === 'purchased' ? 'gohighlevel' : null,
  };
}

function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = nonNegativeNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePaymentStatus(
  value: unknown,
): GhlMappedLead['paymentStatus'] | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['partial', 'partially_paid', 'deposit_paid'].includes(normalized)) return 'partial';
  if (['paid', 'paid_in_full', 'fully_paid', 'complete'].includes(normalized)) {
    return 'paid_in_full';
  }
  if (['refunded', 'refund'].includes(normalized)) return 'refunded';
  if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
  return null;
}

function unresolvedPaymentWarnings(mapping: GhlPlanAttributionMapping | null): string[] {
  if (!mapping) return [];
  const warnings: string[] = [];
  if (!mapping.payment_amount_field) {
    warnings.push(
      'Customer payment amount field is not defined; amount paid and outstanding balance remain unknown.',
    );
  }
  if (!mapping.ticket_quantity_field) {
    warnings.push(
      'Customer ticket quantity field is not defined; imported ticket quantity remains unknown.',
    );
  }
  return warnings;
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
  attribution_mapping_id?: string | null;
  mode: GhlSyncMode;
  status: GhlSyncStatus;
  contacts_pulled: number;
  opportunities_pulled: number;
  appointments_pulled: number;
  leads_upserted: number;
  tags_mapped: number;
  stages_mapped: number;
  write_backs_prepared: number;
  errors: unknown;
  warnings: unknown;
  raw_payload_returned: boolean;
  provider_endpoint?: string | null;
  duration_ms?: number | null;
  started_at: Date;
  completed_at: Date | null;
}): GhlSyncRunSummary {
  return {
    id: run.id,
    tenantKey: run.tenant_key,
    eventId: run.event_id,
    attributionMappingId: run.attribution_mapping_id ?? null,
    mode: run.mode,
    status: run.status,
    sourceOfTruth: 'gohighlevel',
    contactsPulled: run.contacts_pulled,
    opportunitiesPulled: run.opportunities_pulled,
    appointmentsPulled: run.appointments_pulled,
    leadsUpserted: run.leads_upserted,
    tagsMapped: run.tags_mapped,
    stagesMapped: run.stages_mapped,
    writeBacksPrepared: run.write_backs_prepared,
    errors: normalizeJsonArray(run.errors),
    warnings: normalizeJsonArray(run.warnings),
    rawPayloadReturned: false,
    providerEndpoint: run.provider_endpoint ?? null,
    durationMs: run.duration_ms ?? null,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  };
}
