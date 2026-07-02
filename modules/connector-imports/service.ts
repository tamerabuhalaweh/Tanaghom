import { checkConnectorImportPermission } from './policy';
import * as repo from './repository';
import {
  CONNECTOR_REQUIREMENTS,
  type ConnectorImportJob,
  type CreateImportJobInput,
  type ReadinessSummary,
  type MarkReadyInput,
  type DisableJobInput,
} from './types';

export function listImportJobs(role: string, tenantKey: string): ConnectorImportJob[] {
  checkConnectorImportPermission(role, 'connector_imports:read');
  return repo.listJobs(tenantKey);
}

export function getImportJob(role: string, tenantKey: string, id: string): ConnectorImportJob {
  checkConnectorImportPermission(role, 'connector_imports:read');
  return repo.getJob(tenantKey, id);
}

export function createImportJob(role: string, tenantKey: string, userId: string, input: CreateImportJobInput): ConnectorImportJob {
  checkConnectorImportPermission(role, 'connector_imports:create');
  return repo.createJob(tenantKey, userId, input);
}

export function markJobReady(role: string, tenantKey: string, id: string, input: MarkReadyInput): ConnectorImportJob {
  checkConnectorImportPermission(role, 'connector_imports:update');
  return repo.markJobReady(tenantKey, id, input.testPassed);
}

export function disableJob(role: string, tenantKey: string, id: string, _input: DisableJobInput): ConnectorImportJob {
  checkConnectorImportPermission(role, 'connector_imports:update');
  return repo.disableJob(tenantKey, id);
}

export function getReadiness(role: string, tenantKey: string): ReadinessSummary {
  checkConnectorImportPermission(role, 'connector_imports:read');
  return repo.getReadiness(tenantKey);
}

export function getRequirements(): Record<string, { label: string; requiredCredentialFields: string[]; optionalCredentialFields: string[]; purpose: string }> {
  return CONNECTOR_REQUIREMENTS;
}
