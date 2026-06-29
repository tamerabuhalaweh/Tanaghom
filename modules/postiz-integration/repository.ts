import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type {
  CreatePostizConnectorInput, CreateAccountReferenceInput, CreateExecutionRequestInput,
  PostizConnectorSummary, AccountReferenceSummary, ExecutionRequestSummary, PublishingJobSummary,
  ReadinessValidation, ExecutionRequestStatus, PostizJobStatus,
} from './types';

// ============================================================
// PostizConnector
// ============================================================

export async function createPostizConnector(input: CreatePostizConnectorInput): Promise<PostizConnectorSummary> {
  const connector = await prisma.postizConnector.create({
    data: {
      connector_name: input.connectorName,
      mcp_connector_id: input.mcpConnectorId,
      implementation_id: input.implementationId,
      target_system: input.targetSystem,
      base_url_placeholder: input.baseUrlPlaceholder,
      credential_binding_id: input.credentialBindingId,
      supports_draft: input.supportsDraft,
      supports_schedule: input.supportsSchedule,
      supports_publish: input.supportsPublish,
      m4_allowed: input.m4Allowed,
      m5_allowed: input.m5Allowed,
    },
  });
  return mapPostizConnector(connector);
}

export async function getPostizConnectorById(id: string): Promise<PostizConnectorSummary> {
  const connector = await prisma.postizConnector.findUnique({ where: { id } });
  if (!connector) throw new NotFoundError('PostizConnector', id);
  return mapPostizConnector(connector);
}

export async function listPostizConnectors(filters?: { connectorStatus?: string }): Promise<PostizConnectorSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.connectorStatus) where.connector_status = filters.connectorStatus;

  const connectors = await prisma.postizConnector.findMany({ where, orderBy: { connector_name: 'asc' } });
  return connectors.map(mapPostizConnector);
}

// ============================================================
// PostizAccountReference
// ============================================================

export async function createAccountReference(input: CreateAccountReferenceInput): Promise<AccountReferenceSummary> {
  const reference = await prisma.postizAccountReference.create({
    data: {
      postiz_connector_id: input.postizConnectorId,
      platform: input.platform,
      account_reference_placeholder: input.accountReferencePlaceholder,
      account_display_name: input.accountDisplayName,
    },
  });
  return mapAccountReference(reference);
}

export async function listAccountReferences(postizConnectorId: string): Promise<AccountReferenceSummary[]> {
  const references = await prisma.postizAccountReference.findMany({
    where: { postiz_connector_id: postizConnectorId },
    orderBy: { platform: 'asc' },
  });
  return references.map(mapAccountReference);
}

// ============================================================
// PublishingExecutionRequest
// ============================================================

async function ensurePublishingPackageBelongsToTenant(packageId: string, tenantKey: string): Promise<void> {
  const pkg = await prisma.publishingPackage.findFirst({
    where: { id: packageId, tenant_key: tenantKey },
    select: { id: true },
  });
  if (!pkg) throw new NotFoundError('PublishingPackage', packageId);
}

async function getTenantPublishingPackageIds(tenantKey: string): Promise<string[]> {
  const packages = await prisma.publishingPackage.findMany({
    where: { tenant_key: tenantKey },
    select: { id: true },
  });
  return packages.map(pkg => pkg.id);
}

export async function validateReadiness(input: CreateExecutionRequestInput, tenantKey: string): Promise<ReadinessValidation> {
  const blockedReasons: string[] = [];

  // Check PublishingPackage exists
  const pkg = await prisma.publishingPackage.findFirst({ where: { id: input.publishingPackageId, tenant_key: tenantKey } });
  if (!pkg) {
    blockedReasons.push('PublishingPackage not found');
  } else if (pkg.package_status !== 'ready_for_future_execution') {
    blockedReasons.push(`PublishingPackage status is ${pkg.package_status}, not ready_for_future_execution`);
  }

  // Check approval exists
  if (!input.approvalId) {
    blockedReasons.push('Approval ID is required');
  }

  // Check SAIF critical dimensions
  if (!input.saifDecisionRecordId) {
    blockedReasons.push('SAIF Decision Record is required');
  }

  // Check capability resolution
  if (!input.capabilityResolutionId) {
    blockedReasons.push('Capability Resolution is required');
  }

  // Check MCP mediation
  if (!input.mcpMediationRequestId) {
    blockedReasons.push('MCP Mediation Request is required');
  }

  // Check connector availability
  const connector = await prisma.postizConnector.findUnique({ where: { id: input.postizConnectorId } });
  if (!connector) {
    blockedReasons.push('PostizConnector not found');
  } else if (connector.connector_status !== 'active') {
    blockedReasons.push(`PostizConnector is ${connector.connector_status}, not active`);
  }

  // M5 publish is blocked
  if (input.requestedAction === 'publish') {
    blockedReasons.push('M5 publishing is blocked by default');
  }

  return { valid: blockedReasons.length === 0, blockedReasons };
}

export async function createExecutionRequest(input: CreateExecutionRequestInput, tenantKey: string): Promise<ExecutionRequestSummary> {
  // Validate readiness
  const validation = await validateReadiness(input, tenantKey);
  
  const request = await prisma.publishingExecutionRequest.create({
    data: {
      publishing_package_id: input.publishingPackageId,
      publishing_manifest_id: input.publishingManifestId,
      postiz_connector_id: input.postizConnectorId,
      capability_resolution_id: input.capabilityResolutionId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      mcp_mediation_decision_id: input.mcpMediationDecisionId,
      spine_run_id: input.spineRunId,
      approval_id: input.approvalId,
      saif_decision_record_id: input.saifDecisionRecordId,
      requested_by_user_id: input.requestedByUserId,
      requested_by_agent_rep_id: input.requestedByAgentRepId,
      request_status: validation.valid ? 'ready' : 'blocked',
      execution_mode: input.executionMode,
      requested_action: input.requestedAction,
      blocked_reason: validation.valid ? null : validation.blockedReasons.join('; '),
    },
  });
  return mapExecutionRequest(request);
}

export async function getExecutionRequestById(id: string, tenantKey: string): Promise<ExecutionRequestSummary> {
  const request = await prisma.publishingExecutionRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('PublishingExecutionRequest', id);
  await ensurePublishingPackageBelongsToTenant(request.publishing_package_id, tenantKey);
  return mapExecutionRequest(request);
}

export async function listExecutionRequests(filters?: {
  tenantKey?: string;
  publishingPackageId?: string;
  requestStatus?: string;
  requestedByUserId?: string;
}): Promise<ExecutionRequestSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.tenantKey) {
    const packageIds = await getTenantPublishingPackageIds(filters.tenantKey);
    if (packageIds.length === 0) return [];
    if (filters?.publishingPackageId && !packageIds.includes(filters.publishingPackageId)) return [];
    where.publishing_package_id = filters?.publishingPackageId || { in: packageIds };
  } else if (filters?.publishingPackageId) {
    where.publishing_package_id = filters.publishingPackageId;
  }
  if (filters?.requestStatus) where.request_status = filters.requestStatus;
  if (filters?.requestedByUserId) where.requested_by_user_id = filters.requestedByUserId;

  const requests = await prisma.publishingExecutionRequest.findMany({ where, orderBy: { created_at: 'desc' } });
  return requests.map(mapExecutionRequest);
}

export async function updateExecutionRequestStatus(id: string, tenantKey: string, status: ExecutionRequestStatus, blockedReason?: string): Promise<ExecutionRequestSummary> {
  const existing = await prisma.publishingExecutionRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PublishingExecutionRequest', id);
  await ensurePublishingPackageBelongsToTenant(existing.publishing_package_id, tenantKey);

  const request = await prisma.publishingExecutionRequest.update({
    where: { id },
    data: {
      request_status: status,
      blocked_reason: blockedReason,
    },
  });
  return mapExecutionRequest(request);
}

// ============================================================
// PostizPublishingJob
// ============================================================

export async function createPublishingJob(
  tenantKey: string,
  executionRequestId: string,
  publishingPackageId: string,
  platform: string,
  accountReferenceId?: string,
  payloadHash?: string,
  payloadSummary?: string,
): Promise<PublishingJobSummary> {
  await ensurePublishingPackageBelongsToTenant(publishingPackageId, tenantKey);

  const job = await prisma.postizPublishingJob.create({
    data: {
      publishing_execution_request_id: executionRequestId,
      publishing_package_id: publishingPackageId,
      platform,
      account_reference_id: accountReferenceId,
      payload_hash: payloadHash,
      payload_summary: payloadSummary,
    },
  });
  return mapPublishingJob(job);
}

export async function listPublishingJobs(filters?: {
  tenantKey?: string;
  publishingPackageId?: string;
  jobStatus?: string;
}): Promise<PublishingJobSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.tenantKey) {
    const packageIds = await getTenantPublishingPackageIds(filters.tenantKey);
    if (packageIds.length === 0) return [];
    if (filters?.publishingPackageId && !packageIds.includes(filters.publishingPackageId)) return [];
    where.publishing_package_id = filters?.publishingPackageId || { in: packageIds };
  } else if (filters?.publishingPackageId) {
    where.publishing_package_id = filters.publishingPackageId;
  }
  if (filters?.jobStatus) where.job_status = filters.jobStatus;

  const jobs = await prisma.postizPublishingJob.findMany({ where, orderBy: { created_at: 'desc' } });
  return jobs.map(mapPublishingJob);
}

export async function updatePublishingJobStatus(id: string, tenantKey: string, status: PostizJobStatus, externalRef?: string): Promise<PublishingJobSummary> {
  const existing = await prisma.postizPublishingJob.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PostizPublishingJob', id);
  await ensurePublishingPackageBelongsToTenant(existing.publishing_package_id, tenantKey);

  const job = await prisma.postizPublishingJob.update({
    where: { id },
    data: {
      job_status: status,
      postiz_external_reference_placeholder: externalRef,
    },
  });
  return mapPublishingJob(job);
}

// ============================================================
// Mappers
// ============================================================

function mapPostizConnector(c: Record<string, unknown>): PostizConnectorSummary {
  return {
    id: c.id as string,
    connectorName: c.connector_name as string,
    connectorStatus: c.connector_status as PostizConnectorSummary['connectorStatus'],
    mcpConnectorId: c.mcp_connector_id as string | null,
    implementationId: c.implementation_id as string | null,
    targetSystem: c.target_system as string,
    baseUrlPlaceholder: c.base_url_placeholder as string | null,
    credentialBindingId: c.credential_binding_id as string | null,
    supportsDraft: c.supports_draft as boolean,
    supportsSchedule: c.supports_schedule as boolean,
    supportsPublish: c.supports_publish as boolean,
    m4Allowed: c.m4_allowed as boolean,
    m5Allowed: c.m5_allowed as boolean,
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

function mapAccountReference(a: Record<string, unknown>): AccountReferenceSummary {
  return {
    id: a.id as string,
    postizConnectorId: a.postiz_connector_id as string,
    platform: a.platform as string,
    accountReferencePlaceholder: a.account_reference_placeholder as string | null,
    accountDisplayName: a.account_display_name as string | null,
    accountStatus: a.account_status as AccountReferenceSummary['accountStatus'],
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

function mapExecutionRequest(r: Record<string, unknown>): ExecutionRequestSummary {
  return {
    id: r.id as string,
    publishingPackageId: r.publishing_package_id as string,
    publishingManifestId: r.publishing_manifest_id as string | null,
    postizConnectorId: r.postiz_connector_id as string,
    capabilityResolutionId: r.capability_resolution_id as string | null,
    mcpMediationRequestId: r.mcp_mediation_request_id as string | null,
    mcpMediationDecisionId: r.mcp_mediation_decision_id as string | null,
    spineRunId: r.spine_run_id as string | null,
    approvalId: r.approval_id as string | null,
    saifDecisionRecordId: r.saif_decision_record_id as string | null,
    requestedByUserId: r.requested_by_user_id as string,
    requestedByAgentRepId: r.requested_by_agent_rep_id as string,
    requestStatus: r.request_status as ExecutionRequestSummary['requestStatus'],
    executionMode: r.execution_mode as ExecutionRequestSummary['executionMode'],
    requestedAction: r.requested_action as ExecutionRequestSummary['requestedAction'],
    blockedReason: r.blocked_reason as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapPublishingJob(j: Record<string, unknown>): PublishingJobSummary {
  return {
    id: j.id as string,
    publishingExecutionRequestId: j.publishing_execution_request_id as string,
    publishingPackageId: j.publishing_package_id as string,
    platform: j.platform as string,
    accountReferenceId: j.account_reference_id as string | null,
    jobStatus: j.job_status as PublishingJobSummary['jobStatus'],
    postizExternalReferencePlaceholder: j.postiz_external_reference_placeholder as string | null,
    scheduledAt: j.scheduled_at as Date | null,
    timezone: j.timezone as string | null,
    payloadHash: j.payload_hash as string | null,
    payloadSummary: j.payload_summary as string | null,
    createdAt: j.created_at as Date,
    updatedAt: j.updated_at as Date,
  };
}
