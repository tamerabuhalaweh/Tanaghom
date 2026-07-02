import { checkConnectorPermission } from './policy';
import * as repo from './repository';
import type {
  CreateImportJobInput, ConnectorImportJobSummary,
  ReadinessSummary, DryRunResult, ImportResult,
} from './types';

export async function getReadiness(role: string, tenantKey: string): Promise<ReadinessSummary> {
  checkConnectorPermission(role, 'connector:read');
  return repo.getReadiness(tenantKey);
}

export async function getRequirements(role: string) {
  checkConnectorPermission(role, 'connector:read');
  return repo.getRequirements();
}

export async function listJobs(role: string, tenantKey: string, eventId?: string): Promise<ConnectorImportJobSummary[]> {
  checkConnectorPermission(role, 'connector:read');
  return repo.listJobs(tenantKey, eventId);
}

export async function createJob(
  role: string, tenantKey: string, userId: string, input: CreateImportJobInput,
): Promise<ConnectorImportJobSummary> {
  checkConnectorPermission(role, 'connector:create');
  return repo.createJob(tenantKey, userId, input);
}

export async function markReady(
  role: string, tenantKey: string, userId: string, id: string, testPassed: boolean, notes?: string,
): Promise<ConnectorImportJobSummary> {
  checkConnectorPermission(role, 'connector:update');
  return repo.markReady(tenantKey, userId, id, testPassed, notes);
}

export async function disableJob(
  role: string, tenantKey: string, userId: string, id: string, reason: string,
): Promise<ConnectorImportJobSummary> {
  checkConnectorPermission(role, 'connector:disable');
  return repo.disableJob(tenantKey, userId, id, reason);
}

export async function dryRun(
  role: string, tenantKey: string, userId: string, connectorId: string, eventId?: string,
): Promise<DryRunResult> {
  checkConnectorPermission(role, 'connector:dry_run');
  return repo.dryRun(tenantKey, userId, connectorId, eventId);
}

export async function approveAndImport(
  role: string, tenantKey: string, userId: string, connectorId: string, eventId: string, notes?: string,
): Promise<ImportResult> {
  checkConnectorPermission(role, 'connector:import');
  return repo.approveAndImport(tenantKey, userId, connectorId, eventId, notes);
}
