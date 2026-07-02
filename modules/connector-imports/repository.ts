import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateImportJobInput, ConnectorImportJobSummary,
  ConnectorReadiness, ReadinessSummary,
  ImportJobState, CredentialState, ConnectorId,
  DryRunResult, ImportResult,
} from './types';
import { CONNECTOR_REQUIREMENTS, SUPPORTED_CONNECTORS, VALID_TRANSITIONS } from './types';

export function getRequirements() {
  return Object.entries(CONNECTOR_REQUIREMENTS).map(([id, req]) => ({
    connectorId: id,
    ...req,
  }));
}

function resolveCredentialState(_tenantKey: string, _connectorId: string): CredentialState {
  // Stub: in production, check integration_credentials table
  // For now, return customer_credential_missing for all connectors
  return 'customer_credential_missing';
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
    const credentialState = resolveCredentialState(tenantKey, connectorId);

    if (credentialState === 'configured' || credentialState === 'test_passed') totalConfigured++;
    else if (credentialState === 'customer_credential_missing') totalMissing++;
    else if (credentialState === 'blocked_by_provider_approval') totalBlocked++;

    connectors.push({
      connectorId,
      label: req.label,
      jobState: job?.state as ImportJobState | null ?? null,
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
  if (!SUPPORTED_CONNECTORS.includes(input.connectorId)) {
    throw new ValidationError(`Unsupported connector: ${input.connectorId}`);
  }

  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({ where: { id: input.eventId, tenant_key: tenantKey } });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
  }

  const credentialState = resolveCredentialState(tenantKey, input.connectorId);
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

  // Create audit record
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
  tenantKey: string, connectorId: string, _eventId?: string,
): Promise<DryRunResult> {
  if (!SUPPORTED_CONNECTORS.includes(connectorId as ConnectorId)) {
    throw new ValidationError(`Unsupported connector: ${connectorId}`);
  }

  // Stub: simulate what would be imported
  // In production, this would query the external API in read-only mode
  return {
    connectorId,
    wouldImport: {
      kpiRecords: 0,
      leadAttributions: 0,
    },
    sampleData: [],
    warnings: ['Dry run is a stub — no external API calls made. Configure credentials and run test first.'],
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

  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: connectorId, event_id: eventId },
  });
  if (!job) throw new NotFoundError('ConnectorImportJob', `${connectorId}/${eventId}`);

  if (job.state !== 'test_passed') {
    throw new ValidationError(`Job must be in test_passed state to import. Current: ${job.state}`);
  }

  // Create audit record for the import
  const auditRecord = await prisma.auditRecord.create({
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

  // Update job state
  await prisma.connectorImportJob.update({
    where: { id: job.id },
    data: {
      approved_by_user_id: userId,
      approved_at: new Date(),
      last_import_at: new Date(),
      last_import_result: { auditRecordId: auditRecord.id, connectorId, eventId } as Prisma.InputJsonValue,
    },
  });

  // Stub: in production, write EventKpiRecord and/or lead attribution records here
  return {
    connectorId,
    eventId,
    imported: {
      kpiRecords: 0,
      leadAttributions: 0,
    },
    auditRecordId: auditRecord.id,
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
