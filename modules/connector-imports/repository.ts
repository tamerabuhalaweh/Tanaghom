import { randomUUID } from 'node:crypto';
import { NotFoundError, StateTransitionError, ValidationError } from '@shared/errors';
import {
  SUPPORTED_CONNECTORS,
  VALID_TRANSITIONS,
  type ConnectorId,
  type ImportJobState,
  type CredentialState,
  type ConnectorImportJob,
  type ConnectorReadiness,
  type ReadinessSummary,
  type CreateImportJobInput,
  CONNECTOR_REQUIREMENTS,
} from './types';

const jobs = new Map<string, ConnectorImportJob>();

function getCredentialStateForConnector(tenantKey: string, connectorId: ConnectorId): CredentialState {
  void tenantKey;
  void connectorId;
  return 'customer_credential_missing';
}

export function listJobs(tenantKey: string): ConnectorImportJob[] {
  return Array.from(jobs.values()).filter(j => j.tenantKey === tenantKey);
}

export function getJob(tenantKey: string, id: string): ConnectorImportJob {
  const job = jobs.get(id);
  if (!job || job.tenantKey !== tenantKey) throw new NotFoundError('ConnectorImportJob', id);
  return job;
}

export function createJob(tenantKey: string, userId: string, input: CreateImportJobInput): ConnectorImportJob {
  if (!SUPPORTED_CONNECTORS.includes(input.connectorId)) {
    throw new ValidationError(`Unsupported connector: ${input.connectorId}`);
  }

  const existing = Array.from(jobs.values()).find(
    j => j.tenantKey === tenantKey && j.connectorId === input.connectorId && j.state !== 'disabled',
  );
  if (existing) {
    throw new ValidationError(`Active import job already exists for connector '${input.connectorId}' in this tenant`);
  }

  const credentialState = getCredentialStateForConnector(tenantKey, input.connectorId);
  const initialState: ImportJobState = credentialState === 'customer_credential_missing' ? 'requires_credentials' : 'draft';

  const now = new Date();
  const job: ConnectorImportJob = {
    id: randomUUID(),
    tenantKey,
    connectorId: input.connectorId,
    displayName: input.displayName,
    state: initialState,
    credentialState,
    notes: input.notes ?? null,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    stateChangedAt: now,
  };

  jobs.set(job.id, job);
  return job;
}

export function transitionJob(tenantKey: string, id: string, toState: ImportJobState): ConnectorImportJob {
  const job = getJob(tenantKey, id);
  const allowed = VALID_TRANSITIONS[job.state];
  if (!allowed.includes(toState)) {
    throw new StateTransitionError(job.state, toState);
  }

  const now = new Date();
  job.state = toState;
  job.updatedAt = now;
  job.stateChangedAt = now;
  jobs.set(job.id, job);
  return job;
}

export function markJobReady(tenantKey: string, id: string, testPassed: boolean): ConnectorImportJob {
  const job = getJob(tenantKey, id);

  if (job.state !== 'ready_for_test' && job.state !== 'blocked') {
    throw new StateTransitionError(job.state, testPassed ? 'test_passed' : 'blocked');
  }

  const toState: ImportJobState = testPassed ? 'test_passed' : 'blocked';
  const now = new Date();
  job.state = toState;
  job.updatedAt = now;
  job.stateChangedAt = now;
  jobs.set(job.id, job);
  return job;
}

export function disableJob(tenantKey: string, id: string): ConnectorImportJob {
  const job = getJob(tenantKey, id);
  if (job.state === 'disabled') {
    throw new StateTransitionError('disabled', 'disabled');
  }

  const now = new Date();
  job.state = 'disabled';
  job.updatedAt = now;
  job.stateChangedAt = now;
  jobs.set(job.id, job);
  return job;
}

export function getReadiness(tenantKey: string): ReadinessSummary {
  const tenantJobs = listJobs(tenantKey);
  const connectors: ConnectorReadiness[] = SUPPORTED_CONNECTORS.map(connectorId => {
    const job = tenantJobs.find(j => j.connectorId === connectorId && j.state !== 'disabled');
    const credentialState = getCredentialStateForConnector(tenantKey, connectorId);
    const req = CONNECTOR_REQUIREMENTS[connectorId];
    return {
      connectorId,
      label: req.label,
      jobState: job?.state ?? null,
      credentialState,
      purpose: req.purpose,
      requiredCredentialFields: req.requiredCredentialFields,
      optionalCredentialFields: req.optionalCredentialFields,
      jobId: job?.id ?? null,
    };
  });

  const totalConfigured = connectors.filter(c => c.credentialState === 'configured' || c.credentialState === 'test_passed').length;
  const totalMissing = connectors.filter(c => c.credentialState === 'customer_credential_missing').length;
  const totalBlocked = connectors.filter(c => c.credentialState === 'blocked_by_provider_approval').length;

  return { tenantKey, connectors, totalConfigured, totalMissing, totalBlocked };
}

export function clearAllJobs(): void {
  jobs.clear();
}
