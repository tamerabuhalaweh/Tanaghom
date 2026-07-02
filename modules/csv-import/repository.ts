import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type { CsvRow, CsvDryRunResult, CsvImportResult } from './types';
import type { FieldMappingEntry } from '../connector-field-mapping/types';
import { REQUIRED_KPI_FIELDS, NUMERIC_KPI_FIELDS } from '../connector-field-mapping/types';

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

  const fieldMappings = mapping.field_mappings as FieldMappingEntry[];
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
    totalRows: rows.length,
    validRows: kpiRows.length,
    invalidRows: rows.length - kpiRows.length,
    kpiRows,
    validationErrors,
    warnings,
  };

  // Persist dry-run result on a connector import job
  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: 'csv_manual', event_id: eventId },
  });
  if (job) {
    await prisma.connectorImportJob.update({
      where: { id: job.id },
      data: {
        last_dry_run_at: new Date(),
        last_dry_run_result: result as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Create audit record
  await prisma.auditRecord.create({
    data: {
      audit_type: 'csv_import',
      action: 'csv_dry_run',
      result: 'success',
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

  // Read last dry run result from connector import job
  const job = await prisma.connectorImportJob.findFirst({
    where: { tenant_key: tenantKey, connector_id: 'csv_manual', event_id: eventId },
  });

  const dryRunResult = (job?.last_dry_run_result as CsvDryRunResult | null);
  if (!dryRunResult || !dryRunResult.kpiRows || dryRunResult.kpiRows.length === 0) {
    await prisma.auditRecord.create({
      data: {
        audit_type: 'csv_import',
        action: 'csv_import_rejected_no_data',
        result: 'blocked',
        human_user_id: userId,
        target_object_type: 'connector_field_mapping',
        target_object_id: mappingId,
        reason: 'No valid rows from last dry run',
      },
    });
    throw new ValidationError('Cannot import: no valid rows from last dry run. Run a CSV dry run first.');
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
  for (const row of dryRunResult.kpiRows) {
    const kpiRecord = await prisma.eventKpiRecord.create({
      data: {
        tenant_key: tenantKey,
        event_id: eventId,
        source_type: 'connector',
        source_name: 'csv_manual',
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
