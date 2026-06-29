import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateAnalyticsSourceInput, CreateIngestionRequestInput, CreateAnalyticsSnapshotInput,
  CreatePlatformMetricMappingInput, CreateReportingPeriodInput, CreatePerformanceReportInput,
  AnalyticsSourceSummary, IngestionRequestSummary, AnalyticsSnapshotSummary,
  PlatformMetricMappingSummary, ReportingPeriodSummary, PerformanceReportSummary,
} from './types';

// ============================================================
// AnalyticsSource
// ============================================================

export async function createAnalyticsSource(input: CreateAnalyticsSourceInput): Promise<AnalyticsSourceSummary> {
  const source = await prisma.analyticsSource.create({
    data: {
      name: input.name,
      source_type: input.sourceType,
      mcp_connector_id: input.mcpConnectorId,
      requires_mcp: input.requiresMcp,
      supports_read: input.supportsRead,
      supports_write: input.supportsWrite,
    },
  });
  return mapAnalyticsSource(source);
}

export async function getAnalyticsSourceById(id: string): Promise<AnalyticsSourceSummary> {
  const source = await prisma.analyticsSource.findUnique({ where: { id } });
  if (!source) throw new NotFoundError('AnalyticsSource', id);
  return mapAnalyticsSource(source);
}

export async function listAnalyticsSources(filters?: { status?: string; sourceType?: string }): Promise<AnalyticsSourceSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.sourceType) where.source_type = filters.sourceType;

  const sources = await prisma.analyticsSource.findMany({ where, orderBy: { name: 'asc' } });
  return sources.map(mapAnalyticsSource);
}

// ============================================================
// AnalyticsIngestionRequest
// ============================================================

export async function validateIngestionRequest(input: CreateIngestionRequestInput): Promise<{ valid: boolean; blockedReasons: string[] }> {
  const blockedReasons: string[] = [];

  // Check source exists
  const source = await prisma.analyticsSource.findUnique({ where: { id: input.sourceId } });
  if (!source) {
    blockedReasons.push('AnalyticsSource not found');
  } else if (source.status !== 'active') {
    blockedReasons.push(`AnalyticsSource is ${source.status}, not active`);
  }

  // Check MCP mediation if required
  if (source?.requires_mcp && !input.mcpMediationRequestId) {
    blockedReasons.push('MCP mediation is required for this analytics source');
  }

  return { valid: blockedReasons.length === 0, blockedReasons };
}

export async function createIngestionRequest(input: CreateIngestionRequestInput, tenantKey: string): Promise<IngestionRequestSummary> {
  const validation = await validateIngestionRequest(input);

  const request = await prisma.analyticsIngestionRequest.create({
    data: {
      tenant_key: tenantKey,
      source_id: input.sourceId,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      publishing_package_id: input.publishingPackageId,
      postiz_publishing_job_id: input.postizPublishingJobId,
      platform: input.platform,
      requested_by_user_id: input.requestedByUserId,
      requested_by_agent_rep_id: input.requestedByAgentRepId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      status: validation.valid ? 'completed' : 'blocked',
      blocked_reason: validation.valid ? null : validation.blockedReasons.join('; '),
      completed_at: validation.valid ? new Date() : null,
    },
  });
  return mapIngestionRequest(request);
}

export async function getIngestionRequestById(id: string, tenantKey: string): Promise<IngestionRequestSummary> {
  const request = await prisma.analyticsIngestionRequest.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!request) throw new NotFoundError('AnalyticsIngestionRequest', id);
  return mapIngestionRequest(request);
}

export async function listIngestionRequests(filters?: {
  tenantKey?: string;
  sourceId?: string;
  campaignId?: string;
  status?: string;
  requestedByUserId?: string;
}): Promise<IngestionRequestSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.tenantKey) where.tenant_key = filters.tenantKey;
  if (filters?.sourceId) where.source_id = filters.sourceId;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.status) where.status = filters.status;
  if (filters?.requestedByUserId) where.requested_by_user_id = filters.requestedByUserId;

  const requests = await prisma.analyticsIngestionRequest.findMany({ where, orderBy: { created_at: 'desc' } });
  return requests.map(mapIngestionRequest);
}

// ============================================================
// AnalyticsSnapshot
// ============================================================

export async function createSnapshot(input: CreateAnalyticsSnapshotInput, tenantKey: string): Promise<AnalyticsSnapshotSummary> {
  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      tenant_key: tenantKey,
      source_id: input.sourceId,
      ingestion_request_id: input.ingestionRequestId,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      publishing_package_id: input.publishingPackageId,
      postiz_publishing_job_id: input.postizPublishingJobId,
      platform: input.platform,
      reporting_period_id: input.reportingPeriodId,
      metrics: input.metrics,
      normalized_metrics: input.normalizedMetrics,
      confidence: input.confidence,
      source_freshness: input.sourceFreshness,
    },
  });
  return mapAnalyticsSnapshot(snapshot);
}

export async function getSnapshotById(id: string, tenantKey: string): Promise<AnalyticsSnapshotSummary> {
  const snapshot = await prisma.analyticsSnapshot.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!snapshot) throw new NotFoundError('AnalyticsSnapshot', id);
  return mapAnalyticsSnapshot(snapshot);
}

export async function listSnapshots(filters?: {
  tenantKey?: string;
  sourceId?: string;
  campaignId?: string;
  contentItemId?: string;
  platform?: string;
}): Promise<AnalyticsSnapshotSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.tenantKey) where.tenant_key = filters.tenantKey;
  if (filters?.sourceId) where.source_id = filters.sourceId;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.contentItemId) where.content_item_id = filters.contentItemId;
  if (filters?.platform) where.platform = filters.platform;

  const snapshots = await prisma.analyticsSnapshot.findMany({ where, orderBy: { collected_at: 'desc' } });
  return snapshots.map(mapAnalyticsSnapshot);
}

// ============================================================
// PlatformMetricMapping
// ============================================================

export async function createMetricMapping(input: CreatePlatformMetricMappingInput): Promise<PlatformMetricMappingSummary> {
  const mapping = await prisma.platformMetricMapping.create({
    data: {
      platform: input.platform,
      source_metric_name: input.sourceMetricName,
      normalized_metric_name: input.normalizedMetricName,
      mapping_rule: input.mappingRule as Prisma.InputJsonValue | undefined,
      confidence: input.confidence,
    },
  });
  return mapPlatformMetricMapping(mapping);
}

export async function listMetricMappings(platform?: string): Promise<PlatformMetricMappingSummary[]> {
  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;

  const mappings = await prisma.platformMetricMapping.findMany({ where, orderBy: { platform: 'asc' } });
  return mappings.map(mapPlatformMetricMapping);
}

// ============================================================
// ReportingPeriod
// ============================================================

export async function createReportingPeriod(input: CreateReportingPeriodInput): Promise<ReportingPeriodSummary> {
  const period = await prisma.reportingPeriod.create({
    data: {
      period_type: input.periodType,
      start_date: new Date(input.startDate),
      end_date: new Date(input.endDate),
      timezone: input.timezone,
    },
  });
  return mapReportingPeriod(period);
}

export async function getReportingPeriodById(id: string): Promise<ReportingPeriodSummary> {
  const period = await prisma.reportingPeriod.findUnique({ where: { id } });
  if (!period) throw new NotFoundError('ReportingPeriod', id);
  return mapReportingPeriod(period);
}

// ============================================================
// CampaignPerformanceReport
// ============================================================

export async function createPerformanceReport(input: CreatePerformanceReportInput, tenantKey: string): Promise<PerformanceReportSummary> {
  const report = await prisma.campaignPerformanceReport.create({
    data: {
      tenant_key: tenantKey,
      reporting_period_id: input.reportingPeriodId,
      campaign_id: input.campaignId,
      generated_by_user_id: input.generatedByUserId,
      generated_by_agent_rep_id: input.generatedByAgentRepId,
      summary: input.summary,
      top_findings: input.topFindings as Prisma.InputJsonValue | undefined,
      risks: input.risks as Prisma.InputJsonValue | undefined,
      recommendations: input.recommendations as Prisma.InputJsonValue | undefined,
      linked_learning_signal_ids: input.linkedLearningSignalIds,
      linked_saif_decision_record_id: input.linkedSaifDecisionRecordId,
    },
  });
  return mapPerformanceReport(report);
}

export async function getPerformanceReportById(id: string, tenantKey: string): Promise<PerformanceReportSummary> {
  const report = await prisma.campaignPerformanceReport.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!report) throw new NotFoundError('CampaignPerformanceReport', id);
  return mapPerformanceReport(report);
}

export async function listPerformanceReports(filters?: {
  tenantKey?: string;
  campaignId?: string;
  reportingPeriodId?: string;
  reportStatus?: string;
}): Promise<PerformanceReportSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.tenantKey) where.tenant_key = filters.tenantKey;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.reportingPeriodId) where.reporting_period_id = filters.reportingPeriodId;
  if (filters?.reportStatus) where.report_status = filters.reportStatus;

  const reports = await prisma.campaignPerformanceReport.findMany({ where, orderBy: { created_at: 'desc' } });
  return reports.map(mapPerformanceReport);
}

// ============================================================
// Mappers
// ============================================================

function mapAnalyticsSource(s: Record<string, unknown>): AnalyticsSourceSummary {
  return {
    id: s.id as string,
    name: s.name as string,
    sourceType: s.source_type as string,
    status: s.status as AnalyticsSourceSummary['status'],
    mcpConnectorId: s.mcp_connector_id as string | null,
    requiresMcp: s.requires_mcp as boolean,
    supportsRead: s.supports_read as boolean,
    supportsWrite: s.supports_write as boolean,
    createdAt: s.created_at as Date,
    updatedAt: s.updated_at as Date,
  };
}

function mapIngestionRequest(r: Record<string, unknown>): IngestionRequestSummary {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    campaignId: r.campaign_id as string | null,
    contentItemId: r.content_item_id as string | null,
    publishingPackageId: r.publishing_package_id as string | null,
    postizPublishingJobId: r.postiz_publishing_job_id as string | null,
    platform: r.platform as string | null,
    requestedByUserId: r.requested_by_user_id as string,
    requestedByAgentRepId: r.requested_by_agent_rep_id as string,
    mcpMediationRequestId: r.mcp_mediation_request_id as string | null,
    status: r.status as IngestionRequestSummary['status'],
    requestedAt: r.requested_at as Date,
    completedAt: r.completed_at as Date | null,
    blockedReason: r.blocked_reason as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapAnalyticsSnapshot(s: Record<string, unknown>): AnalyticsSnapshotSummary {
  return {
    id: s.id as string,
    sourceId: s.source_id as string,
    ingestionRequestId: s.ingestion_request_id as string | null,
    campaignId: s.campaign_id as string | null,
    contentItemId: s.content_item_id as string | null,
    publishingPackageId: s.publishing_package_id as string | null,
    postizPublishingJobId: s.postiz_publishing_job_id as string | null,
    platform: s.platform as string | null,
    reportingPeriodId: s.reporting_period_id as string | null,
    metrics: s.metrics as Record<string, number>,
    normalizedMetrics: s.normalized_metrics as Record<string, number>,
    confidence: s.confidence as string,
    sourceFreshness: s.source_freshness as string | null,
    collectedAt: s.collected_at as Date,
    createdAt: s.created_at as Date,
  };
}

function mapPlatformMetricMapping(m: Record<string, unknown>): PlatformMetricMappingSummary {
  return {
    id: m.id as string,
    platform: m.platform as string,
    sourceMetricName: m.source_metric_name as string,
    normalizedMetricName: m.normalized_metric_name as string,
    mappingRule: m.mapping_rule as Record<string, unknown> | null,
    confidence: m.confidence as string,
    createdAt: m.created_at as Date,
    updatedAt: m.updated_at as Date,
  };
}

function mapReportingPeriod(p: Record<string, unknown>): ReportingPeriodSummary {
  return {
    id: p.id as string,
    periodType: p.period_type as ReportingPeriodSummary['periodType'],
    startDate: p.start_date as Date,
    endDate: p.end_date as Date,
    timezone: p.timezone as string,
    status: p.status as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapPerformanceReport(r: Record<string, unknown>): PerformanceReportSummary {
  return {
    id: r.id as string,
    reportingPeriodId: r.reporting_period_id as string,
    campaignId: r.campaign_id as string,
    generatedByUserId: r.generated_by_user_id as string,
    generatedByAgentRepId: r.generated_by_agent_rep_id as string,
    reportStatus: r.report_status as PerformanceReportSummary['reportStatus'],
    summary: r.summary as string | null,
    topFindings: r.top_findings as Record<string, unknown> | null,
    risks: r.risks as Record<string, unknown> | null,
    recommendations: r.recommendations as Record<string, unknown> | null,
    linkedLearningSignalIds: r.linked_learning_signal_ids as string[],
    linkedSaifDecisionRecordId: r.linked_saif_decision_record_id as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}
