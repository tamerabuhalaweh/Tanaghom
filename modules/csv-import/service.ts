import { checkCsvPermission } from './policy';
import * as repo from './repository';
import type { CsvDryRunResult, CsvImportResult, CsvRow } from './types';

export async function dryRunCsv(
  role: string, tenantKey: string, userId: string, mappingId: string, eventId: string, rows: CsvRow[],
): Promise<CsvDryRunResult> {
  checkCsvPermission(role, 'csv:dry_run');
  return repo.dryRunCsv(tenantKey, userId, mappingId, eventId, rows);
}

export async function approveCsvImport(
  role: string, tenantKey: string, userId: string, mappingId: string, eventId: string, notes?: string,
): Promise<CsvImportResult> {
  checkCsvPermission(role, 'csv:import');
  return repo.approveCsvImport(tenantKey, userId, mappingId, eventId, notes);
}
