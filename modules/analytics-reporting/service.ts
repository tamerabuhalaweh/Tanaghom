import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import { MockAnalyticsProvider } from '@shared/providers/mock-analytics';
import * as repo from './repository';
import type {
  CreateAnalyticsSourceInput, CreateIngestionRequestInput,
  CreatePlatformMetricMappingInput, CreateReportingPeriodInput, CreatePerformanceReportInput,
  AnalyticsSourceSummary, IngestionRequestSummary, AnalyticsSnapshotSummary,
  PlatformMetricMappingSummary, ReportingPeriodSummary, PerformanceReportSummary,
} from './types';

const mockProvider = new MockAnalyticsProvider();

const PERMISSIONS: Record<string, string[]> = {
  admin: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
  cco: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
  department_head: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
  specialist: ['analytics:read', 'analytics:ingest'],
  reviewer: ['analytics:read'],
  viewer: ['analytics:read'],
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
// AnalyticsSource Service
// ============================================================

export async function createAnalyticsSource(requesterRole: string, input: CreateAnalyticsSourceInput): Promise<AnalyticsSourceSummary> {
  checkPermission(requesterRole, 'analytics:create');
  const source = await repo.createAnalyticsSource(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'analytics_source_created', object_type: 'analytics_source', object_id: source.id, result: 'success' },
    `Analytics source created: ${source.name} (${source.sourceType})`,
  );

  return source;
}

export async function getAnalyticsSource(requesterRole: string, id: string): Promise<AnalyticsSourceSummary> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.getAnalyticsSourceById(id);
}

export async function listAnalyticsSources(requesterRole: string, filters?: { status?: string; sourceType?: string }): Promise<AnalyticsSourceSummary[]> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.listAnalyticsSources(filters);
}

// ============================================================
// IngestionRequest Service
// ============================================================

export async function createIngestionRequest(
  requesterRole: string,
  tenantKey: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateIngestionRequestInput,
): Promise<IngestionRequestSummary> {
  checkPermission(requesterRole, 'analytics:ingest');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.requestedByUserId, input.requestedByAgentRepId);

  // Write-enabled analytics blocked
  const source = await repo.getAnalyticsSourceById(input.sourceId);
  if (source.supportsWrite) {
    throw new ForbiddenError('Write-enabled analytics sources are blocked');
  }

  const request = await repo.createIngestionRequest(input, tenantKey);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'ingestion_request_created', object_type: 'analytics_ingestion_request', object_id: request.id, result: request.status === 'blocked' ? 'blocked' : 'success' },
    `Ingestion request created: ${request.platform || 'all'} (${request.status})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_ingestion_request',
    'analytics_ingestion_request',
    request.id,
    request.status === 'blocked' ? 'blocked' : 'success',
    { platform: request.platform, sourceId: request.sourceId },
  );

  return request;
}

export async function getIngestionRequest(requesterRole: string, tenantKey: string, id: string): Promise<IngestionRequestSummary> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.getIngestionRequestById(id, tenantKey);
}

export async function listIngestionRequests(requesterRole: string, filters?: {
  tenantKey?: string;
  sourceId?: string;
  campaignId?: string;
  status?: string;
  requestedByUserId?: string;
}): Promise<IngestionRequestSummary[]> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.listIngestionRequests(filters);
}

export async function mockCompleteIngestion(
  requesterRole: string,
  tenantKey: string,
  ingestionRequestId: string,
  platform: string,
  campaignId?: string,
): Promise<AnalyticsSnapshotSummary> {
  checkPermission(requesterRole, 'analytics:ingest');

  const request = await repo.getIngestionRequestById(ingestionRequestId, tenantKey);
  if (request.status !== 'completed') {
    throw new ForbiddenError(`Ingestion request is ${request.status}, not completed`);
  }

  // Use mock provider
  const snapshot = await mockProvider.fetchSnapshot(platform, campaignId);

  const analyticsSnapshot = await repo.createSnapshot({
    sourceId: request.sourceId,
    ingestionRequestId: request.id,
    campaignId: request.campaignId || undefined,
    contentItemId: request.contentItemId || undefined,
    publishingPackageId: request.publishingPackageId || undefined,
    postizPublishingJobId: request.postizPublishingJobId || undefined,
    platform,
    metrics: snapshot.metrics,
    normalizedMetrics: snapshot.normalizedMetrics,
    confidence: snapshot.confidence,
    sourceFreshness: snapshot.sourceFreshness,
  }, tenantKey);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'mock_snapshot_created', object_type: 'analytics_snapshot', object_id: analyticsSnapshot.id, result: 'success' },
    `Mock snapshot created for ${platform}`,
  );

  return analyticsSnapshot;
}

// ============================================================
// Snapshot Service
// ============================================================

export async function getSnapshot(requesterRole: string, tenantKey: string, id: string): Promise<AnalyticsSnapshotSummary> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.getSnapshotById(id, tenantKey);
}

export async function listSnapshots(requesterRole: string, filters?: {
  tenantKey?: string;
  sourceId?: string;
  campaignId?: string;
  contentItemId?: string;
  platform?: string;
}): Promise<AnalyticsSnapshotSummary[]> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.listSnapshots(filters);
}

// ============================================================
// MetricMapping Service
// ============================================================

export async function createMetricMapping(requesterRole: string, input: CreatePlatformMetricMappingInput): Promise<PlatformMetricMappingSummary> {
  checkPermission(requesterRole, 'analytics:create');
  const mapping = await repo.createMetricMapping(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'metric_mapping_created', object_type: 'platform_metric_mapping', object_id: mapping.id, result: 'success' },
    `Metric mapping created: ${mapping.platform} ${mapping.sourceMetricName} -> ${mapping.normalizedMetricName}`,
  );

  return mapping;
}

export async function listMetricMappings(requesterRole: string, platform?: string): Promise<PlatformMetricMappingSummary[]> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.listMetricMappings(platform);
}

// ============================================================
// ReportingPeriod Service
// ============================================================

export async function createReportingPeriod(requesterRole: string, input: CreateReportingPeriodInput): Promise<ReportingPeriodSummary> {
  checkPermission(requesterRole, 'analytics:create');
  const period = await repo.createReportingPeriod(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'reporting_period_created', object_type: 'reporting_period', object_id: period.id, result: 'success' },
    `Reporting period created: ${period.periodType} (${period.startDate.toISOString()} - ${period.endDate.toISOString()})`,
  );

  return period;
}

export async function getReportingPeriod(requesterRole: string, id: string): Promise<ReportingPeriodSummary> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.getReportingPeriodById(id);
}

// ============================================================
// PerformanceReport Service
// ============================================================

export async function createPerformanceReport(
  requesterRole: string,
  tenantKey: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreatePerformanceReportInput,
): Promise<PerformanceReportSummary> {
  checkPermission(requesterRole, 'analytics:report');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.generatedByUserId, input.generatedByAgentRepId);

  // Reports are advisory only — cannot approve, publish, or change strategy
  const report = await repo.createPerformanceReport(input, tenantKey);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'performance_report_created', object_type: 'campaign_performance_report', object_id: report.id, result: 'success' },
    `Performance report created for campaign ${report.campaignId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_performance_report',
    'campaign_performance_report',
    report.id,
    'success',
    { campaignId: report.campaignId, reportStatus: report.reportStatus },
  );

  return report;
}

export async function getPerformanceReport(requesterRole: string, tenantKey: string, id: string): Promise<PerformanceReportSummary> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.getPerformanceReportById(id, tenantKey);
}

export async function listPerformanceReports(requesterRole: string, filters?: {
  tenantKey?: string;
  campaignId?: string;
  reportingPeriodId?: string;
  reportStatus?: string;
}): Promise<PerformanceReportSummary[]> {
  checkPermission(requesterRole, 'analytics:read');
  return repo.listPerformanceReports(filters);
}
