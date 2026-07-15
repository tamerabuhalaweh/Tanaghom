import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type { CsvRow, CsvDryRunResult, CsvImportResult } from './types';
import type { FieldMappingEntry } from '../connector-field-mapping/types';
import { REQUIRED_KPI_FIELDS, NUMERIC_KPI_FIELDS } from '../connector-field-mapping/types';
import { validateFieldMappings } from '../connector-field-mapping/repository';

const CSV_MANUAL_CONNECTOR_ID = 'csv_manual';
const NUMERIC_FIELDS = [
  'reach', 'impressions', 'interactions', 'clicks',
  'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended',
  'purchases', 'noShows', 'spend',
] as const;

type PersistedKpiRow = CsvDryRunResult['kpiRows'][number];
type ConnectorFieldMappingRecord = {
  id: string;
  tenant_key: string;
  connector_id: string;
  event_id: string | null;
  display_name: string;
  target_type: string;
  field_mappings: unknown;
  validation_status: string;
  validation_errors: unknown;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

function assertMappingCanImport(mapping: ConnectorFieldMappingRecord, eventId: string): FieldMappingEntry[] {
  if (mapping.target_type !== 'event_kpi_record') {
    throw new ValidationError('CSV import only supports event KPI record mappings.');
  }
  if (mapping.event_id && mapping.event_id !== eventId) {
    throw new ValidationError('This field mapping is scoped to a different event.');
  }
  if (mapping.validation_status !== 'valid') {
    throw new ValidationError('Cannot import with an invalid field mapping. Fix the mapping first.');
  }

  const fieldMappings = mapping.field_mappings as FieldMappingEntry[];
  const validation = validateFieldMappings(fieldMappings);
  if (!validation.valid) {
    throw new ValidationError(`Cannot import with an invalid field mapping: ${validation.errors.join('; ')}`);
  }
  return fieldMappings;
}

function normalizePersistedRow(row: Partial<PersistedKpiRow>, index: number): { row?: PersistedKpiRow; errors: string[] } {
  const errors: string[] = [];
  const metricDate = typeof row.metricDate === 'string' ? row.metricDate.trim() : '';
  const channel = typeof row.channel === 'string' ? row.channel.trim() : '';

  if (!metricDate) {
    errors.push(`Row ${index}: metricDate is required`);
  } else if (isNaN(new Date(metricDate).getTime())) {
    errors.push(`Row ${index}: metricDate is invalid`);
  }

  if (!channel) {
    errors.push(`Row ${index}: channel is required`);
  }

  const numericValues: Record<typeof NUMERIC_FIELDS[number], number> = {
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
  };

  for (const field of NUMERIC_FIELDS) {
    const value = row[field] ?? 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push(`Row ${index}: ${field} must be finite and >= 0`);
    } else {
      numericValues[field] = parsed;
    }
  }

  const metricTotal = NUMERIC_FIELDS.reduce((sum, field) => sum + numericValues[field], 0);
  if (metricTotal === 0) {
    errors.push(`Row ${index}: all-zero KPI row rejected`);
  }

  if (errors.length > 0) return { errors };
  return {
    row: {
      metricDate,
      channel,
      ...numericValues,
      notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
    },
    errors,
  };
}

function validatePersistedRows(rows: unknown): { rows: PersistedKpiRow[]; errors: string[] } {
  if (!Array.isArray(rows)) {
    return { rows: [], errors: ['Dry-run payload is malformed: kpiRows must be an array'] };
  }

  const normalizedRows: PersistedKpiRow[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const normalized = normalizePersistedRow(row as Partial<PersistedKpiRow>, index + 1);
    if (normalized.row) normalizedRows.push(normalized.row);
    errors.push(...normalized.errors);
  });

  if (normalizedRows.length === 0 && errors.length === 0) {
    errors.push('No importable KPI rows are available from the dry run');
  }

  return { rows: normalizedRows, errors };
}

async function auditCsvRejection(userId: string, mappingId: string, reason: string): Promise<void> {
  await prisma.auditRecord.create({
    data: {
      audit_type: 'csv_import',
      action: 'csv_import_rejected',
      result: 'blocked',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: mappingId,
      reason,
    },
  });
}

export async function dryRunCsv(
  tenantKey: string, userId: string, mappingId: string, eventId: string, rows: CsvRow[],
): Promise<CsvDryRunResult> {
  const mapping = await prisma.connectorFieldMapping.findFirst({
    where: { id: mappingId, tenant_key: tenantKey },
  });
  if (!mapping) throw new NotFoundError('ConnectorFieldMapping', mappingId);

  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  const fieldMappings = assertMappingCanImport(mapping as ConnectorFieldMappingRecord, eventId);
  const validationErrors: Array<{ row: number; field: string; error: string }> = [];
  const kpiRows: CsvDryRunResult['kpiRows'] = [];
  const warnings: string[] = [];

  // Validate and map rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mappedRow: Record<string, string | number | null> = {};

    // Apply field mappings
    for (const fm of fieldMappings) {
      const sourceValue = row[fm.sourceField] ?? fm.defaultValue ?? null;
      mappedRow[fm.targetField] = sourceValue;
    }

    // Validate required fields
    let rowValid = true;
    for (const req of REQUIRED_KPI_FIELDS) {
      if (!mappedRow[req] || String(mappedRow[req]).trim() === '') {
        validationErrors.push({ row: i + 1, field: req, error: `Required field '${req}' is missing or empty` });
        rowValid = false;
      }
    }

    // Validate date format
    if (mappedRow.metricDate) {
      const date = new Date(String(mappedRow.metricDate));
      if (isNaN(date.getTime())) {
        validationErrors.push({ row: i + 1, field: 'metricDate', error: 'Invalid date format' });
        rowValid = false;
      }
    }

    // Validate numeric fields
    for (const numField of NUMERIC_KPI_FIELDS) {
      if (mappedRow[numField] !== null && mappedRow[numField] !== undefined) {
        const val = Number(mappedRow[numField]);
        if (!isFinite(val) || val < 0) {
          validationErrors.push({ row: i + 1, field: numField, error: `Numeric field '${numField}' must be finite and >= 0` });
          rowValid = false;
        }
      }
    }

    if (rowValid) {
      // Build KPI row
      const kpiRow = {
        metricDate: String(mappedRow.metricDate),
        channel: String(mappedRow.channel),
        reach: Number(mappedRow.reach) || 0,
        impressions: Number(mappedRow.impressions) || 0,
        interactions: Number(mappedRow.interactions) || 0,
        clicks: Number(mappedRow.clicks) || 0,
        formCompletions: Number(mappedRow.formCompletions) || 0,
        leads: Number(mappedRow.leads) || 0,
        meetingsBooked: Number(mappedRow.meetingsBooked) || 0,
        meetingsAttended: Number(mappedRow.meetingsAttended) || 0,
        purchases: Number(mappedRow.purchases) || 0,
        noShows: Number(mappedRow.noShows) || 0,
        spend: Number(mappedRow.spend) || 0,
        notes: mappedRow.notes ? String(mappedRow.notes) : null,
      };

      // Reject all-zero KPI rows
      const totalMetrics = kpiRow.reach + kpiRow.impressions + kpiRow.interactions + kpiRow.clicks +
        kpiRow.formCompletions + kpiRow.leads + kpiRow.meetingsBooked + kpiRow.meetingsAttended +
        kpiRow.purchases + kpiRow.noShows + kpiRow.spend;
      if (totalMetrics === 0) {
        validationErrors.push({ row: i + 1, field: '*', error: 'All-zero KPI row rejected' });
      } else {
        kpiRows.push(kpiRow);
      }
    }
  }

  const result: CsvDryRunResult = {
    mappingId,
    eventId,
    mappingUpdatedAt: mapping.updated_at.toISOString(),
    totalRows: rows.length,
    validRows: kpiRows.length,
    invalidRows: rows.length - kpiRows.length,
    kpiRows,
    validationErrors,
    warnings,
  };

  // Persist dry-run result on a mapping-scoped connector import job.
  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: CSV_MANUAL_CONNECTOR_ID, event_id: eventId, mapping_id: mappingId },
  });
  if (job?.state === 'disabled') {
    throw new ValidationError('Cannot run CSV dry run because this import job is disabled.');
  }
  const nextState = kpiRows.length > 0 ? 'test_passed' : 'blocked';
  const nextSyncStatus = kpiRows.length > 0 ? 'ready_for_sync' : 'failed';
  const syncError = kpiRows.length > 0 ? null : validationErrors.join('; ') || 'CSV dry run produced no importable KPI rows';
  if (job) {
    await prisma.connectorImportJob.update({
      where: { id: job.id },
      data: {
        state: nextState,
        credential_state: 'test_passed',
        sync_status: nextSyncStatus,
        last_sync_error: syncError,
        last_dry_run_at: new Date(),
        last_dry_run_result: result as unknown as Prisma.InputJsonValue,
        notes: `CSV dry run: ${kpiRows.length}/${rows.length} valid rows`,
      },
    });
  } else {
    await prisma.connectorImportJob.create({
      data: {
        tenant_key: tenantKey,
        event_id: eventId,
        mapping_id: mappingId,
        connector_id: CSV_MANUAL_CONNECTOR_ID,
        display_name: `CSV import - ${mapping.display_name}`,
        state: nextState,
        credential_state: 'test_passed',
        sync_status: nextSyncStatus,
        last_sync_error: syncError,
        notes: `CSV dry run: ${kpiRows.length}/${rows.length} valid rows`,
        last_dry_run_at: new Date(),
        last_dry_run_result: result as unknown as Prisma.InputJsonValue,
        created_by_user_id: userId,
      },
    });
  }

  // Create audit record
  await prisma.auditRecord.create({
    data: {
      audit_type: 'csv_import',
      action: 'csv_dry_run',
      result: kpiRows.length > 0 ? 'success' : 'blocked',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: mappingId,
      reason: `CSV dry run: ${kpiRows.length}/${rows.length} valid rows`,
    },
  });

  return result;
}

export async function approveCsvImport(
  tenantKey: string, userId: string, mappingId: string, eventId: string, notes?: string,
): Promise<CsvImportResult> {
  const mapping = await prisma.connectorFieldMapping.findFirst({
    where: { id: mappingId, tenant_key: tenantKey },
  });
  if (!mapping) throw new NotFoundError('ConnectorFieldMapping', mappingId);

  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  const tenant = await prisma.tenant.findUnique({
    where: { tenant_key: tenantKey },
    select: { default_currency: true },
  });
  if (!tenant) throw new NotFoundError('Tenant', tenantKey);
  assertMappingCanImport(mapping as ConnectorFieldMappingRecord, eventId);

  // Read last dry run result from connector import job
  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: CSV_MANUAL_CONNECTOR_ID, event_id: eventId, mapping_id: mappingId },
  });

  const dryRunResult = (job?.last_dry_run_result as CsvDryRunResult | null);
  if (!job) {
    await auditCsvRejection(userId, mappingId, 'No CSV dry run job found');
    throw new ValidationError('Cannot import: no valid rows from last dry run. Run a CSV dry run first.');
  }
  if (job.state !== 'test_passed') {
    const reason = `CSV import job must be test_passed before approval. Current: ${job.state}`;
    await auditCsvRejection(userId, mappingId, reason);
    throw new ValidationError(reason);
  }
  if (!dryRunResult) {
    await auditCsvRejection(userId, mappingId, 'No valid rows from last dry run');
    throw new ValidationError('Cannot import: no valid rows from last dry run. Run a CSV dry run first.');
  }
  if (dryRunResult.mappingId !== mappingId || dryRunResult.eventId !== eventId) {
    await auditCsvRejection(userId, mappingId, 'Dry-run payload does not match requested mapping and event');
    throw new ValidationError('Cannot import: dry-run payload does not match requested mapping and event.');
  }
  if (dryRunResult.mappingUpdatedAt !== mapping.updated_at.toISOString()) {
    await auditCsvRejection(userId, mappingId, 'Dry-run payload is stale after mapping update');
    throw new ValidationError('Cannot import: mapping changed after the last dry run. Run dry run again.');
  }

  const validatedRows = validatePersistedRows(dryRunResult.kpiRows);
  if (validatedRows.errors.length > 0) {
    await auditCsvRejection(userId, mappingId, `Invalid dry-run rows: ${validatedRows.errors.join('; ')}`);
    throw new ValidationError(`Cannot import: ${validatedRows.errors.join('; ')}`);
  }

  // Create audit record for approved import
  const auditRecord = await prisma.auditRecord.create({
    data: {
      audit_type: 'csv_import',
      action: 'csv_import_approved',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: mappingId,
      reason: notes ?? 'Approved CSV import',
    },
  });

  // Write exactly the rows from dry-run
  const importedIds: string[] = [];
  for (let index = 0; index < validatedRows.rows.length; index++) {
    const row = validatedRows.rows[index];
    const sourceRecordKey = `${job.id}:${index}:${row.metricDate}:${row.channel}`;
    const existing = await prisma.eventKpiRecord.findFirst({
      where: {
        tenant_key: tenantKey,
        source_name: CSV_MANUAL_CONNECTOR_ID,
        source_record_key: sourceRecordKey,
      },
      select: { id: true },
    });
    if (existing) {
      importedIds.push(existing.id);
      continue;
    }
    const kpiRecord = await prisma.eventKpiRecord.create({
      data: {
        tenant_key: tenantKey,
        event_id: eventId,
        source_type: 'imported',
        source_name: CSV_MANUAL_CONNECTOR_ID,
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
        verification_reason: 'Approved CSV import',
        notes: row.notes,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
    });
    importedIds.push(kpiRecord.id);
  }

  // Update job state if exists
  if (job) {
    await prisma.connectorImportJob.update({
      where: { id: job.id },
      data: {
        approved_by_user_id: userId,
        approved_at: new Date(),
        last_import_at: new Date(),
        last_import_result: { auditRecordId: auditRecord.id, kpiRecordIds: importedIds } as Prisma.InputJsonValue,
        sync_status: 'synced',
        last_sync_at: new Date(),
        last_sync_rows: importedIds.length,
        last_sync_error: null,
        last_sync_audit_record_id: auditRecord.id,
      },
    });
  }

  return {
    mappingId,
    eventId,
    imported: { kpiRecords: dryRunResult.kpiRows.length },
    auditRecordId: auditRecord.id,
  };
}
