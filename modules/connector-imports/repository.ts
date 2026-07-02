import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateImportJobInput, ConnectorImportJobSummary,
  ConnectorReadiness, ReadinessSummary,
  ImportJobState, CredentialState, ConnectorId,
  DryRunResult, DryRunKpiRow, ImportResult,
} from './types';
import { CONNECTOR_REQUIREMENTS, SUPPORTED_CONNECTORS, VALID_TRANSITIONS } from './types';

export function getRequirements() {
  return Object.entries(CONNECTOR_REQUIREMENTS).map(([id, req]) => ({
    connectorId: id,
    ...req,
  }));
}

async function resolveCredentialState(tenantKey: string, connectorId: string): Promise<CredentialState> {
  const credential = await prisma.integrationCredential.findFirst({
    where: { tenant_key: tenantKey, provider: connectorId, is_active: true },
    select: { id: true, last_validated_at: true },
  });

  if (!credential) return 'customer_credential_missing';
  if (credential.last_validated_at) return 'test_passed';
  return 'configured';
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

  const job = await prisma.connectorImportJob.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      connector_id: input.connectorId,
      display_name: input.displayName,
      state: initialState,
      credential_state: credentialState,
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

  // Stub: produce sample KPI rows from connector (no external API calls)
  // In production, this would query the connector API in read-only mode
  const sampleKpiRows: DryRunKpiRow[] = [];
  const warnings: string[] = [];

  if (credentialState === 'configured') {
    warnings.push('Credentials configured but not tested - sample data may be incomplete');
    // Produce 2 sample rows to demonstrate the shape
    sampleKpiRows.push({
      metricDate: new Date().toISOString(),
      channel: connectorId,
      reach: 1500,
      impressions: 3200,
      interactions: 180,
      clicks: 45,
      formCompletions: 12,
      leads: 8,
      meetingsBooked: 3,
      meetingsAttended: 2,
      purchases: 1,
      noShows: 1,
      spend: 250,
      notes: `Sample row 1 from ${connectorId} dry run`,
    });
    sampleKpiRows.push({
      metricDate: new Date(Date.now() - 86400000).toISOString(),
      channel: connectorId,
      reach: 1200,
      impressions: 2800,
      interactions: 150,
      clicks: 38,
      formCompletions: 9,
      leads: 6,
      meetingsBooked: 2,
      meetingsAttended: 2,
      purchases: 0,
      noShows: 0,
      spend: 200,
      notes: `Sample row 2 from ${connectorId} dry run`,
    });
  } else {
    warnings.push('Test passed but no live data available yet - import will write sample structure');
    sampleKpiRows.push({
      metricDate: new Date().toISOString(),
      channel: connectorId,
      reach: 0,
      impressions: 0,
      interactions: 0,
      clicks: 0,
      formCompletions: 0,
      leads: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      purchases: 0,
      noShows: 0,
      spend: 0,
      notes: `Placeholder from ${connectorId} - no live data yet`,
    });
  }

  const dryRunResult: DryRunResult = {
    connectorId,
    eventId: eventId ?? null,
    kpiRows: sampleKpiRows,
    leadAttributions: 0,
    warnings,
  };

  await prisma.connectorImportJob.update({
    where: { id: job.id },
    data: {
      last_dry_run_at: new Date(),
      last_dry_run_result: dryRunResult as unknown as Prisma.InputJsonValue,
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
      reason: `Dry run executed for ${connectorId}: ${sampleKpiRows.length} sample rows`,
    },
  });

  return dryRunResult;
}

export async function approveAndImport(
  tenantKey: string, userId: string, connectorId: string, eventId: string, notes?: string,
): Promise<ImportResult> {
  if (!SUPPORTED_CONNECTORS.includes(connectorId as ConnectorId)) {
    throw new ValidationError(`Unsupported connector: ${connectorId}`);
  }

  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

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
    await prisma.auditRecord.create({
      data: {
        audit_type: 'connector_import',
        action: 'import_rejected_no_data',
        result: 'blocked',
        human_user_id: userId,
        target_object_type: 'connector_import_job',
        target_object_id: job.id,
        reason: 'Last dry run has no importable KPI rows',
      },
    });
    throw new ValidationError('Cannot import: last dry run produced no importable rows. Run a dry run with data first.');
  }

  const { kpiRows } = dryRunResult;

  // Validate rows are not malformed
  for (let i = 0; i < kpiRows.length; i++) {
    const row = kpiRows[i];
    if (!row.metricDate || !row.channel) {
      await prisma.auditRecord.create({
        data: {
          audit_type: 'connector_import',
          action: 'import_rejected_malformed',
          result: 'blocked',
          human_user_id: userId,
          target_object_type: 'connector_import_job',
          target_object_id: job.id,
          reason: `Row ${i} malformed: missing metricDate or channel`,
        },
      });
      throw new ValidationError(`Row ${i} is malformed: missing required fields (metricDate, channel)`);
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
  for (const row of kpiRows) {
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
