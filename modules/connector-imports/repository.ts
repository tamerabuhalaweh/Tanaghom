import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateImportJobInput, ConnectorImportJobSummary,
  ConnectorReadiness, ReadinessSummary,
  ImportJobState, CredentialState, ConnectorId,
  DryRunResult, DryRunKpiRow, ImportResult,
  ConnectorSyncStatus, ConnectorSyncStatusSummary,
} from './types';
import { CONNECTOR_REQUIREMENTS, SUPPORTED_CONNECTORS, VALID_TRANSITIONS } from './types';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import { runPostizReadOnlyDryRun } from './adapters/postiz';
import {
  runFormalooReadOnlyDryRun,
  runKajabiReadOnlyDryRun,
  runMetaAnalyticsDryRun,
  runYouTubeAnalyticsDryRun,
} from './adapters/read-only-providers';

type IntegrationProvider = Parameters<typeof getActiveIntegrationCredential>[0];
type CredentialType = Parameters<typeof getActiveIntegrationCredential>[1];
type CredentialLookup = { provider: IntegrationProvider; credentialType: CredentialType; connectionKey: string };

const CONNECTOR_CREDENTIAL_MAP: Record<string, CredentialLookup[]> = {
  postiz: [{ provider: 'postiz', credentialType: 'api_key', connectionKey: 'default' }],
  gohighlevel: [{ provider: 'gohighlevel', credentialType: 'api_key', connectionKey: 'default' }],
  formaloo: [{ provider: 'formaloo', credentialType: 'api_key', connectionKey: 'default' }],
  kajabi: [{ provider: 'kajabi', credentialType: 'oauth_client', connectionKey: 'default' }],
  meta_analytics: [
    { provider: 'meta_analytics', credentialType: 'api_key', connectionKey: 'default' },
    { provider: 'social_oauth', credentialType: 'oauth_client', connectionKey: 'meta' },
  ],
  youtube_analytics: [
    { provider: 'youtube_analytics', credentialType: 'oauth_token', connectionKey: 'default' },
    { provider: 'youtube', credentialType: 'api_key', connectionKey: 'default' },
  ],
  whatsapp_provider: [{ provider: 'whatsapp', credentialType: 'api_key', connectionKey: 'default' }],
  telegram_provider: [{ provider: 'telegram', credentialType: 'bot_token', connectionKey: 'default' }],
  smartlabs_voice: [{ provider: 'smartlabs_voice', credentialType: 'api_key', connectionKey: 'default' }],
};

export function getRequirements() {
  return Object.entries(CONNECTOR_REQUIREMENTS).map(([id, req]) => ({
    connectorId: id,
    ...req,
  }));
}

async function resolveCredentialState(tenantKey: string, connectorId: string): Promise<CredentialState> {
  const lookups = CONNECTOR_CREDENTIAL_MAP[connectorId] ?? [{ provider: connectorId as IntegrationProvider, credentialType: 'api_key', connectionKey: 'default' }];
  for (const lookup of lookups) {
    const credential = await prisma.integrationCredential.findFirst({
      where: {
        tenant_key: tenantKey,
        provider: lookup.provider,
        credential_type: lookup.credentialType,
        connection_key: lookup.connectionKey,
        is_active: true,
      },
      select: { id: true, last_validated_at: true },
    });

    if (credential?.last_validated_at) return 'test_passed';
    if (credential) return 'configured';
  }
  return 'customer_credential_missing';
}

async function resolveConnectorCredential(tenantKey: string, connectorId: string) {
  const lookups = CONNECTOR_CREDENTIAL_MAP[connectorId] ?? [];
  for (const lookup of lookups) {
    const credential = await getActiveIntegrationCredential(
      lookup.provider,
      lookup.credentialType,
      tenantKey,
      lookup.connectionKey,
    );
    if (credential) return credential;
  }
  return null;
}

export async function getReadiness(tenantKey: string): Promise<ReadinessSummary> {
  const jobs = await prisma.connectorImportJob.findMany({
    where: { tenant_key: tenantKey },
  });

  const connectors: ConnectorReadiness[] = [];
  let totalConfigured = 0;
  let totalMissing = 0;
  let totalBlocked = 0;

  for (const connectorId of SUPPORTED_CONNECTORS) {
    const req = CONNECTOR_REQUIREMENTS[connectorId];
    const job = jobs.find(j => j.connector_id === connectorId);
    const credentialState = await resolveCredentialState(tenantKey, connectorId);

    if (credentialState === 'configured' || credentialState === 'test_passed') totalConfigured++;
    else if (credentialState === 'customer_credential_missing') totalMissing++;
    else if (credentialState === 'blocked_by_provider_approval') totalBlocked++;

    connectors.push({
      connectorId,
      label: req.label,
      jobState: (job?.state as ImportJobState) ?? null,
      credentialState,
      purpose: req.purpose,
      requiredCredentialFields: req.requiredCredentialFields,
      optionalCredentialFields: req.optionalCredentialFields,
      jobId: job?.id ?? null,
    });
  }

  return { tenantKey, connectors, totalConfigured, totalMissing, totalBlocked };
}

export async function listJobs(tenantKey: string, eventId?: string): Promise<ConnectorImportJobSummary[]> {
  const where: Prisma.ConnectorImportJobWhereInput = { tenant_key: tenantKey };
  if (eventId) where.event_id = eventId;

  const jobs = await prisma.connectorImportJob.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return jobs.map(mapJob);
}

export async function getSyncStatus(tenantKey: string, eventId?: string): Promise<ConnectorSyncStatusSummary> {
  if (eventId) {
    const event = await prisma.commercialEvent.findFirst({
      where: { id: eventId, tenant_key: tenantKey },
      select: { id: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', eventId);
  }

  const [jobs, kpiRecords] = await Promise.all([
    prisma.connectorImportJob.findMany({
      where: eventId ? { tenant_key: tenantKey, event_id: eventId } : { tenant_key: tenantKey },
      orderBy: [{ last_sync_at: 'desc' }, { updated_at: 'desc' }],
    }),
    prisma.eventKpiRecord.findMany({
      where: eventId ? { tenant_key: tenantKey, event_id: eventId } : { tenant_key: tenantKey },
      select: { source_type: true, source_name: true },
    }),
  ]);

  const sourceTotals = summarizeSourceTotals(kpiRecords);
  const mappedJobs = jobs.map(mapJob);
  const connectorErrors = mappedJobs
    .filter(job => job.lastSyncError)
    .map(job => `${CONNECTOR_REQUIREMENTS[job.connectorId as ConnectorId]?.label || job.connectorId}: ${job.lastSyncError}`);
  const lastConnectorSyncAt = mappedJobs.reduce<Date | null>((latest, job) => {
    if (!job.lastSyncAt) return latest;
    if (!latest || job.lastSyncAt > latest) return job.lastSyncAt;
    return latest;
  }, null);
  const primarySource = sourceTotals.connectorRecords > 0
    ? 'connector'
    : sourceTotals.importedRecords > 0
      ? 'imported'
      : sourceTotals.manualRecords > 0
        ? 'manual'
        : 'none';

  return {
    tenantKey,
    eventId: eventId ?? null,
    primarySource,
    manualFallbackActive: primarySource === 'manual' || (sourceTotals.manualRecords > 0 && sourceTotals.connectorRecords === 0),
    sourceTotals,
    jobTotals: {
      totalJobs: mappedJobs.length,
      readyForSync: mappedJobs.filter(job => job.syncStatus === 'ready_for_sync').length,
      synced: mappedJobs.filter(job => job.syncStatus === 'synced').length,
      failed: mappedJobs.filter(job => job.syncStatus === 'failed').length,
      blocked: mappedJobs.filter(job => job.syncStatus === 'blocked').length,
      requiresCredentials: mappedJobs.filter(job => job.syncStatus === 'requires_credentials').length,
    },
    lastConnectorSyncAt,
    connectorRowsImported: mappedJobs.reduce((sum, job) => sum + job.lastSyncRows, 0),
    connectorErrors,
    jobs: mappedJobs.map(job => ({
      id: job.id,
      connectorId: job.connectorId,
      displayName: job.displayName,
      eventId: job.eventId,
      state: job.state,
      credentialState: job.credentialState,
      syncStatus: job.syncStatus,
      lastDryRunAt: job.lastDryRunAt,
      lastSyncAt: job.lastSyncAt,
      lastSyncRows: job.lastSyncRows,
      lastSyncError: job.lastSyncError,
      lastSyncAuditRecordId: job.lastSyncAuditRecordId,
    })),
  };
}

export async function getJobById(tenantKey: string, id: string): Promise<ConnectorImportJobSummary> {
  const job = await prisma.connectorImportJob.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!job) throw new NotFoundError('ConnectorImportJob', id);
  return mapJob(job);
}

export async function createJob(
  tenantKey: string, userId: string, input: CreateImportJobInput,
): Promise<ConnectorImportJobSummary> {
  if (!SUPPORTED_CONNECTORS.includes(input.connectorId as ConnectorId)) {
    throw new ValidationError(`Unsupported connector: ${input.connectorId}`);
  }

  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({ where: { id: input.eventId, tenant_key: tenantKey } });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
  }

  const credentialState = await resolveCredentialState(tenantKey, input.connectorId);
  const initialState: ImportJobState = credentialState === 'customer_credential_missing' ? 'requires_credentials' : 'draft';
  const initialSyncStatus: ConnectorSyncStatus = credentialState === 'customer_credential_missing' ? 'requires_credentials' : 'not_started';

  const job = await prisma.connectorImportJob.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      connector_id: input.connectorId,
      display_name: input.displayName,
      state: initialState,
      credential_state: credentialState,
      sync_status: initialSyncStatus,
      notes: input.notes,
      created_by_user_id: userId,
    },
  });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_import',
      action: 'import_job_created',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_import_job',
      target_object_id: job.id,
      reason: `Import job created for ${input.connectorId}`,
    },
  });

  return mapJob(job);
}

export async function markReady(
  tenantKey: string, userId: string, id: string, testPassed: boolean, notes?: string,
): Promise<ConnectorImportJobSummary> {
  const existing = await prisma.connectorImportJob.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('ConnectorImportJob', id);

  const fromState = existing.state as ImportJobState;
  const toState: ImportJobState = testPassed ? 'test_passed' : 'blocked';
  if (!VALID_TRANSITIONS[fromState]?.includes(toState)) {
    throw new ValidationError(`Invalid transition: ${fromState} -> ${toState}`);
  }

  const job = await prisma.connectorImportJob.update({
    where: { id },
    data: {
      state: toState,
      credential_state: testPassed ? 'test_passed' : 'blocked_by_provider_approval',
      sync_status: testPassed ? 'ready_for_sync' : 'failed',
      last_sync_error: testPassed ? null : notes ?? 'Connector test failed',
      notes: notes ?? existing.notes,
    },
  });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_import',
      action: 'import_job_state_changed',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_import_job',
      target_object_id: id,
      before_state: { state: fromState } as Prisma.InputJsonValue,
      after_state: { state: toState } as Prisma.InputJsonValue,
      reason: testPassed ? 'Test passed' : 'Test failed',
    },
  });

  return mapJob(job);
}

export async function disableJob(
  tenantKey: string, userId: string, id: string, reason: string,
): Promise<ConnectorImportJobSummary> {
  const existing = await prisma.connectorImportJob.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('ConnectorImportJob', id);

  const fromState = existing.state as ImportJobState;
  if (!VALID_TRANSITIONS[fromState]?.includes('disabled')) {
    throw new ValidationError(`Invalid transition: ${fromState} -> disabled`);
  }

  const job = await prisma.connectorImportJob.update({
    where: { id },
    data: {
      state: 'disabled',
      sync_status: 'blocked',
      last_sync_error: reason,
      disabled_at: new Date(),
      disabled_reason: reason,
    },
  });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_import',
      action: 'import_job_disabled',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_import_job',
      target_object_id: id,
      before_state: { state: fromState } as Prisma.InputJsonValue,
      after_state: { state: 'disabled' } as Prisma.InputJsonValue,
      reason,
    },
  });

  return mapJob(job);
}

export async function dryRun(
  tenantKey: string, userId: string, connectorId: string, eventId?: string,
): Promise<DryRunResult> {
  if (!SUPPORTED_CONNECTORS.includes(connectorId as ConnectorId)) {
    throw new ValidationError(`Unsupported connector: ${connectorId}`);
  }

  const where: Prisma.ConnectorImportJobWhereInput = { tenant_key: tenantKey, connector_id: connectorId };
  if (eventId) where.event_id = eventId;

  const job = await prisma.connectorImportJob.findFirst({ where });
  if (!job) throw new NotFoundError('ConnectorImportJob', `${connectorId}/${eventId ?? 'any'}`);

  const credentialState = await resolveCredentialState(tenantKey, connectorId);
  if (credentialState === 'customer_credential_missing') {
    throw new ValidationError('Cannot run dry run: customer credentials not configured');
  }

  const dryRunResult = await runReadOnlyConnectorDryRun(tenantKey, connectorId, eventId);
  const dryRunSyncStatus: ConnectorSyncStatus = dryRunResult.kpiRows.length > 0 ? 'ready_for_sync' : 'blocked';

  await prisma.connectorImportJob.update({
    where: { id: job.id },
    data: {
      last_dry_run_at: new Date(),
      last_dry_run_result: dryRunResult as unknown as Prisma.InputJsonValue,
      sync_status: dryRunSyncStatus,
      last_sync_error: dryRunResult.kpiRows.length > 0 ? null : dryRunResult.warnings[0] ?? 'Connector dry run produced no importable rows',
    },
  });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_import',
      action: 'import_dry_run',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_import_job',
      target_object_id: job.id,
      reason: `Dry run executed for ${connectorId}: ${dryRunResult.kpiRows.length} importable rows`,
    },
  });

  return dryRunResult;
}

async function runReadOnlyConnectorDryRun(
  tenantKey: string,
  connectorId: string,
  eventId?: string,
): Promise<DryRunResult> {
  if (connectorId === 'postiz') {
    const credential = await resolveConnectorCredential(tenantKey, connectorId);
    if (!credential) {
      return {
        connectorId,
        eventId: eventId ?? null,
        kpiRows: [],
        leadAttributions: 0,
        warnings: [
          'Postiz credential is configured in readiness, but the active Postiz API key credential could not be resolved for read-only dry-run.',
        ],
        providerStatus: {
          provider: 'postiz',
          adapter: 'postiz_public_api',
          readOnly: true,
          externalWritesAllowed: false,
          rawSecretsReturned: false,
          channelsFound: 0,
          selectedIntegrationId: null,
          selectedChannel: null,
          analyticsFetched: false,
          analyticsMetricLabels: [],
          source: 'Postiz Public API',
        },
      };
    }
    return runPostizReadOnlyDryRun({ credential, eventId });
  }

  if (connectorId === 'kajabi') {
    const credential = await resolveConnectorCredential(tenantKey, connectorId);
    if (!credential) return missingCredentialDryRun(connectorId, eventId);
    return runKajabiReadOnlyDryRun({ credential, eventId });
  }

  if (connectorId === 'meta_analytics') {
    const credential = await resolveConnectorCredential(tenantKey, connectorId);
    if (!credential) return missingCredentialDryRun(connectorId, eventId);
    return runMetaAnalyticsDryRun({ credential, eventId });
  }

  if (connectorId === 'youtube_analytics') {
    const credential = await resolveConnectorCredential(tenantKey, connectorId);
    if (!credential) return missingCredentialDryRun(connectorId, eventId);
    return runYouTubeAnalyticsDryRun({ credential, eventId });
  }

  if (connectorId === 'formaloo') {
    const credential = await resolveConnectorCredential(tenantKey, connectorId);
    if (!credential) return missingCredentialDryRun(connectorId, eventId);
    return runFormalooReadOnlyDryRun({ credential, eventId });
  }

  return {
    connectorId,
    eventId: eventId ?? null,
    kpiRows: [],
    leadAttributions: 0,
    warnings: [
      `No read-only adapter is implemented for ${connectorId} yet - no external API calls made and no rows are importable.`,
    ],
  };
}

function missingCredentialDryRun(connectorId: string, eventId?: string): DryRunResult {
  return {
    connectorId,
    eventId: eventId ?? null,
    kpiRows: [],
    leadAttributions: 0,
    warnings: [`${CONNECTOR_REQUIREMENTS[connectorId as ConnectorId]?.label || connectorId} customer credential is missing. Save tenant-owned credentials before dry-run.`],
  };
}

export async function approveAndImport(
  tenantKey: string, userId: string, connectorId: string, eventId: string, notes?: string,
): Promise<ImportResult> {
  if (!SUPPORTED_CONNECTORS.includes(connectorId as ConnectorId)) {
    throw new ValidationError(`Unsupported connector: ${connectorId}`);
  }

  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  const tenant = await prisma.tenant.findUnique({
    where: { tenant_key: tenantKey },
    select: { default_currency: true },
  });
  if (!tenant) throw new NotFoundError('Tenant', tenantKey);

  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: connectorId, event_id: eventId },
  });
  if (!job) throw new NotFoundError('ConnectorImportJob', `${connectorId}/${eventId}`);

  if (job.state !== 'test_passed') {
    throw new ValidationError(`Job must be in test_passed state to import. Current: ${job.state}`);
  }

  // Read last dry run result
  const dryRunResult = job.last_dry_run_result as DryRunResult | null;
  if (!dryRunResult || !dryRunResult.kpiRows || dryRunResult.kpiRows.length === 0) {
    const reason = 'Last dry run has no importable KPI rows';
    await prisma.auditRecord.create({
      data: {
        audit_type: 'connector_import',
        action: 'import_rejected_no_data',
        result: 'blocked',
        human_user_id: userId,
        target_object_type: 'connector_import_job',
        target_object_id: job.id,
        reason,
      },
    });
    await prisma.connectorImportJob.update({
      where: { id: job.id },
      data: {
        sync_status: 'failed',
        last_sync_error: reason,
      },
    });
    throw new ValidationError('Cannot import: last dry run produced no importable rows. Run a dry run with data first.');
  }

  const { kpiRows } = dryRunResult;

  for (let i = 0; i < kpiRows.length; i++) {
    const error = validateKpiRow(kpiRows[i]);
    if (error) {
      const reason = `Row ${i} malformed: ${error}`;
      await prisma.auditRecord.create({
        data: {
          audit_type: 'connector_import',
          action: 'import_rejected_malformed',
          result: 'blocked',
          human_user_id: userId,
          target_object_type: 'connector_import_job',
          target_object_id: job.id,
          reason,
        },
      });
      await prisma.connectorImportJob.update({
        where: { id: job.id },
        data: {
          sync_status: 'failed',
          last_sync_error: reason,
        },
      });
      throw new ValidationError(`Row ${i} is malformed: ${error}`);
    }
  }

  // Create audit record for approved import
  const importAuditRecord = await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_import',
      action: 'import_approved_and_executed',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_import_job',
      target_object_id: job.id,
      reason: notes ?? 'Approved import execution',
    },
  });

  // Write exactly the rows from dry-run payload with exact metrics
  const importedKpiIds: string[] = [];
  for (let index = 0; index < kpiRows.length; index++) {
    const row = kpiRows[index];
    const sourceRecordKey = `${job.id}:${index}:${row.metricDate}:${row.channel}`;
    const existing = await prisma.eventKpiRecord.findFirst({
      where: { tenant_key: tenantKey, source_name: connectorId, source_record_key: sourceRecordKey },
      select: { id: true },
    });
    if (existing) {
      importedKpiIds.push(existing.id);
      continue;
    }
    const kpiRecord = await prisma.eventKpiRecord.create({
      data: {
        tenant_key: tenantKey,
        event_id: eventId,
        source_type: 'connector',
        source_name: connectorId,
        metric_date: new Date(row.metricDate),
        channel: row.channel,
        reach: row.reach,
        impressions: row.impressions,
        interactions: row.interactions,
        clicks: row.clicks,
        form_completions: row.formCompletions,
        leads: row.leads,
        meetings_booked: row.meetingsBooked,
        meetings_attended: row.meetingsAttended,
        purchases: row.purchases,
        no_shows: row.noShows,
        spend: row.spend,
        currency: tenant.default_currency,
        verification_status: 'verified',
        connector_import_job_id: job.id,
        source_record_key: sourceRecordKey,
        verified_by_user_id: userId,
        verified_at: new Date(),
        verification_reason: 'Approved connector import',
        notes: row.notes,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
    });
    importedKpiIds.push(kpiRecord.id);
  }

  // Update job state
  await prisma.connectorImportJob.update({
    where: { id: job.id },
    data: {
      approved_by_user_id: userId,
      approved_at: new Date(),
      last_import_at: new Date(),
      last_import_result: { auditRecordId: importAuditRecord.id, kpiRecordIds: importedKpiIds, connectorId, eventId } as Prisma.InputJsonValue,
      sync_status: 'synced',
      last_sync_at: new Date(),
      last_sync_rows: kpiRows.length,
      last_sync_error: null,
      last_sync_audit_record_id: importAuditRecord.id,
    },
  });

  return {
    connectorId,
    eventId,
    imported: {
      kpiRecords: kpiRows.length,
      leadAttributions: dryRunResult.leadAttributions ?? 0,
    },
    auditRecordId: importAuditRecord.id,
  };
}

function validateKpiRow(row: DryRunKpiRow | null | undefined): string | null {
  if (!row) return 'missing row';
  if (!row.metricDate || Number.isNaN(new Date(row.metricDate).getTime())) return 'invalid metricDate';
  if (!row.channel || row.channel.trim().length === 0) return 'missing channel';

  const numericFields: Array<keyof Omit<DryRunKpiRow, 'metricDate' | 'channel' | 'notes'>> = [
    'reach', 'impressions', 'interactions', 'clicks', 'formCompletions',
    'leads', 'meetingsBooked', 'meetingsAttended', 'purchases', 'noShows', 'spend',
  ];

  for (const field of numericFields) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return `invalid ${field}`;
    }
  }

  const hasSignal = numericFields.some(field => row[field] > 0);
  if (!hasSignal) return 'all metric values are zero';

  return null;
}

function summarizeSourceTotals(records: Array<{ source_type: unknown; source_name: unknown }>) {
  return records.reduce(
    (totals, record) => {
      const sourceType = String(record.source_type || 'manual');
      const sourceName = String(record.source_name || '');
      if (sourceType === 'manual') totals.manualRecords++;
      else if (sourceType === 'imported' || sourceName === 'csv_manual') totals.importedRecords++;
      else if (sourceType === 'connector') totals.connectorRecords++;
      return totals;
    },
    { manualRecords: 0, importedRecords: 0, connectorRecords: 0 },
  );
}

function mapJob(j: Record<string, unknown>): ConnectorImportJobSummary {
  return {
    id: j.id as string,
    tenantKey: j.tenant_key as string,
    eventId: j.event_id as string | null,
    connectorId: j.connector_id as string,
    displayName: j.display_name as string,
    state: j.state as ImportJobState,
    credentialState: j.credential_state as CredentialState,
    notes: j.notes as string | null,
    lastDryRunAt: j.last_dry_run_at as Date | null,
    lastDryRunResult: j.last_dry_run_result as Record<string, unknown> | null,
    syncStatus: (j.sync_status as ConnectorSyncStatus | undefined) ?? 'not_started',
    lastSyncAt: (j.last_sync_at as Date | null) ?? null,
    lastSyncRows: Number(j.last_sync_rows || 0),
    lastSyncError: (j.last_sync_error as string | null) ?? null,
    lastSyncAuditRecordId: (j.last_sync_audit_record_id as string | null) ?? null,
    lastImportAt: j.last_import_at as Date | null,
    lastImportResult: j.last_import_result as Record<string, unknown> | null,
    approvedByUserId: j.approved_by_user_id as string | null,
    approvedAt: j.approved_at as Date | null,
    disabledAt: j.disabled_at as Date | null,
    disabledReason: j.disabled_reason as string | null,
    createdByUserId: j.created_by_user_id as string,
    createdAt: j.created_at as Date,
    updatedAt: j.updated_at as Date,
  };
}
