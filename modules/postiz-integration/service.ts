import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import { MockPostizProvider } from '@shared/providers/mock-postiz';
import * as repo from './repository';
import type {
  CreatePostizConnectorInput, CreateAccountReferenceInput, CreateExecutionRequestInput,
  PostizConnectorSummary, AccountReferenceSummary, ExecutionRequestSummary, PublishingJobSummary,
} from './types';

const mockProvider = new MockPostizProvider();

const PERMISSIONS: Record<string, string[]> = {
  admin: ['postiz:create', 'postiz:read', 'postiz:execute'],
  cco: ['postiz:create', 'postiz:read', 'postiz:execute'],
  department_head: ['postiz:create', 'postiz:read'],
  specialist: ['postiz:read'],
  reviewer: ['postiz:read'],
  viewer: ['postiz:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

function validateSessionContextLock(
  sessionUserId: string,
  sessionAgentRepId: string,
  actionUserId: string,
  actionAgentRepId: string,
): void {
  if (sessionUserId !== actionUserId) {
    throw new ForbiddenError('Session Context Lock: Cannot act on behalf of another user');
  }
  if (sessionAgentRepId !== actionAgentRepId) {
    throw new ForbiddenError('Session Context Lock: Cannot use another user\'s AgentRep');
  }
}

// ============================================================
// PostizConnector Service
// ============================================================

export async function createPostizConnector(requesterRole: string, input: CreatePostizConnectorInput): Promise<PostizConnectorSummary> {
  checkPermission(requesterRole, 'postiz:create');
  const connector = await repo.createPostizConnector(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'postiz_connector_created', object_type: 'postiz_connector', object_id: connector.id, result: 'success' },
    `Postiz connector created: ${connector.connectorName}`,
  );

  return connector;
}

export async function getPostizConnector(requesterRole: string, id: string): Promise<PostizConnectorSummary> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.getPostizConnectorById(id);
}

export async function listPostizConnectors(requesterRole: string, filters?: { connectorStatus?: string }): Promise<PostizConnectorSummary[]> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.listPostizConnectors(filters);
}

// ============================================================
// AccountReference Service
// ============================================================

export async function createAccountReference(requesterRole: string, input: CreateAccountReferenceInput): Promise<AccountReferenceSummary> {
  checkPermission(requesterRole, 'postiz:create');
  const reference = await repo.createAccountReference(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'account_reference_created', object_type: 'postiz_account_reference', object_id: reference.id, result: 'success' },
    `Account reference created: ${reference.platform} (${reference.accountDisplayName || 'unnamed'})`,
  );

  return reference;
}

export async function listAccountReferences(requesterRole: string, postizConnectorId: string): Promise<AccountReferenceSummary[]> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.listAccountReferences(postizConnectorId);
}

// ============================================================
// ExecutionRequest Service
// ============================================================

export async function createExecutionRequest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateExecutionRequestInput,
): Promise<ExecutionRequestSummary> {
  checkPermission(requesterRole, 'postiz:execute');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.requestedByUserId, input.requestedByAgentRepId);

  // M5 publish is blocked
  if (input.requestedAction === 'publish') {
    throw new ForbiddenError('M5 publishing is blocked by default. Cannot create execution request for publish action.');
  }

  // Direct Postiz access is blocked - must go through MCP mediation
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct Postiz access is blocked. MCP mediation is required.');
  }

  const request = await repo.createExecutionRequest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'execution_request_created', object_type: 'publishing_execution_request', object_id: request.id, result: request.requestStatus === 'blocked' ? 'blocked' : 'success' },
    `Execution request created: ${request.requestedAction} (${request.requestStatus})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_execution_request',
    'publishing_execution_request',
    request.id,
    request.requestStatus === 'blocked' ? 'blocked' : 'success',
    { requestedAction: request.requestedAction, executionMode: request.executionMode },
  );

  return request;
}

export async function getExecutionRequest(requesterRole: string, id: string): Promise<ExecutionRequestSummary> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.getExecutionRequestById(id);
}

export async function listExecutionRequests(requesterRole: string, filters?: {
  publishingPackageId?: string;
  requestStatus?: string;
  requestedByUserId?: string;
}): Promise<ExecutionRequestSummary[]> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.listExecutionRequests(filters);
}

// ============================================================
// Mock Draft/Schedule Preparation
// ============================================================

export async function prepareDraft(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  executionRequestId: string,
  platform: string,
  content: string,
  accountReference: string,
): Promise<PublishingJobSummary> {
  checkPermission(requesterRole, 'postiz:execute');

  const request = await repo.getExecutionRequestById(executionRequestId);
  if (request.requestStatus !== 'ready') {
    throw new ForbiddenError(`Execution request is ${request.requestStatus}, not ready`);
  }

  // Use mock provider
  const result = await mockProvider.createDraft({
    platform,
    content,
    accountReference,
  });

  const job = await repo.createPublishingJob(
    executionRequestId,
    request.publishingPackageId,
    platform,
    undefined,
    result.payloadHash,
    result.payloadSummary,
  );

  await repo.updatePublishingJobStatus(job.id, 'prepared', result.externalReference);
  await repo.updateExecutionRequestStatus(executionRequestId, 'completed');

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'mock_draft_prepared', object_type: 'postiz_publishing_job', object_id: job.id, result: 'success' },
    `Mock draft prepared: ${result.payloadSummary}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'prepare_mock_draft',
    'postiz_publishing_job',
    job.id,
    'success',
    { platform, payloadHash: result.payloadHash },
  );

  return job;
}

export async function prepareSchedule(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  executionRequestId: string,
  platform: string,
  content: string,
  accountReference: string,
  scheduledAt: Date,
  timezone: string,
): Promise<PublishingJobSummary> {
  checkPermission(requesterRole, 'postiz:execute');

  const request = await repo.getExecutionRequestById(executionRequestId);
  if (request.requestStatus !== 'ready') {
    throw new ForbiddenError(`Execution request is ${request.requestStatus}, not ready`);
  }

  // Use mock provider
  const result = await mockProvider.prepareSchedule({
    platform,
    content,
    accountReference,
    scheduledAt,
    timezone,
  });

  const job = await repo.createPublishingJob(
    executionRequestId,
    request.publishingPackageId,
    platform,
    undefined,
    result.payloadHash,
    result.payloadSummary,
  );

  await repo.updatePublishingJobStatus(job.id, 'scheduled', result.externalReference);
  await repo.updateExecutionRequestStatus(executionRequestId, 'completed');

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'mock_schedule_prepared', object_type: 'postiz_publishing_job', object_id: job.id, result: 'success' },
    `Mock schedule prepared: ${result.payloadSummary}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'prepare_mock_schedule',
    'postiz_publishing_job',
    job.id,
    'success',
    { platform, scheduledAt: scheduledAt.toISOString(), timezone },
  );

  return job;
}

// ============================================================
// Publishing Job Service
// ============================================================

export async function listPublishingJobs(requesterRole: string, filters?: {
  publishingPackageId?: string;
  jobStatus?: string;
}): Promise<PublishingJobSummary[]> {
  checkPermission(requesterRole, 'postiz:read');
  return repo.listPublishingJobs(filters);
}
