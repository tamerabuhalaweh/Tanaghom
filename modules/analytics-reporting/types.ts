import { z } from 'zod';

export const ANALYTICS_SOURCE_STATUSES = ['active', 'inactive', 'planned', 'suspended'] as const;
export type AnalyticsSourceStatus = (typeof ANALYTICS_SOURCE_STATUSES)[number];

export const INGESTION_REQUEST_STATUSES = ['pending', 'validating', 'ingesting', 'completed', 'blocked', 'failed', 'cancelled'] as const;
export type IngestionRequestStatus = (typeof INGESTION_REQUEST_STATUSES)[number];

export const REPORT_STATUSES = ['draft', 'generated', 'reviewed', 'published', 'archived'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PERIOD_TYPES = ['h24', 'h48', 'd7', 'weekly', 'monthly', 'custom'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const createAnalyticsSourceSchema = z.object({
  name: z.string().min(1).max(200),
  sourceType: z.string().min(1).max(200),
  mcpConnectorId: z.string().uuid().optional(),
  requiresMcp: z.boolean().default(true),
  supportsRead: z.boolean().default(true),
  supportsWrite: z.boolean().default(false),
});

export const createIngestionRequestSchema = z.object({
  sourceId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  publishingPackageId: z.string().uuid().optional(),
  postizPublishingJobId: z.string().uuid().optional(),
  platform: z.string().max(100).optional(),
  requestedByUserId: z.string().uuid(),
  requestedByAgentRepId: z.string().uuid(),
  mcpMediationRequestId: z.string().uuid().optional(),
});

export const createAnalyticsSnapshotSchema = z.object({
  sourceId: z.string().uuid(),
  ingestionRequestId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  publishingPackageId: z.string().uuid().optional(),
  postizPublishingJobId: z.string().uuid().optional(),
  platform: z.string().max(100).optional(),
  reportingPeriodId: z.string().uuid().optional(),
  metrics: z.record(z.number()),
  normalizedMetrics: z.record(z.number()),
  confidence: z.string().default('low'),
  sourceFreshness: z.string().optional(),
});

export const createPlatformMetricMappingSchema = z.object({
  platform: z.string().min(1).max(100),
  sourceMetricName: z.string().min(1).max(200),
  normalizedMetricName: z.string().min(1).max(200),
  mappingRule: z.record(z.unknown()).optional(),
  confidence: z.string().default('medium'),
});

export const createReportingPeriodSchema = z.object({
  periodType: z.enum(PERIOD_TYPES),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

export const createPerformanceReportSchema = z.object({
  reportingPeriodId: z.string().uuid(),
  campaignId: z.string().uuid(),
  generatedByUserId: z.string().uuid(),
  generatedByAgentRepId: z.string().uuid(),
  summary: z.string().max(5000).optional(),
  topFindings: z.record(z.unknown()).optional(),
  risks: z.record(z.unknown()).optional(),
  recommendations: z.record(z.unknown()).optional(),
  linkedLearningSignalIds: z.array(z.string().uuid()).default([]),
  linkedSaifDecisionRecordId: z.string().uuid().optional(),
});

export type CreateAnalyticsSourceInput = z.infer<typeof createAnalyticsSourceSchema>;
export type CreateIngestionRequestInput = z.infer<typeof createIngestionRequestSchema>;
export type CreateAnalyticsSnapshotInput = z.infer<typeof createAnalyticsSnapshotSchema>;
export type CreatePlatformMetricMappingInput = z.infer<typeof createPlatformMetricMappingSchema>;
export type CreateReportingPeriodInput = z.infer<typeof createReportingPeriodSchema>;
export type CreatePerformanceReportInput = z.infer<typeof createPerformanceReportSchema>;

export interface AnalyticsSourceSummary {
  id: string;
  name: string;
  sourceType: string;
  status: AnalyticsSourceStatus;
  mcpConnectorId: string | null;
  requiresMcp: boolean;
  supportsRead: boolean;
  supportsWrite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionRequestSummary {
  id: string;
  sourceId: string;
  campaignId: string | null;
  contentItemId: string | null;
  publishingPackageId: string | null;
  postizPublishingJobId: string | null;
  platform: string | null;
  requestedByUserId: string;
  requestedByAgentRepId: string;
  mcpMediationRequestId: string | null;
  status: IngestionRequestStatus;
  requestedAt: Date;
  completedAt: Date | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSnapshotSummary {
  id: string;
  sourceId: string;
  ingestionRequestId: string | null;
  campaignId: string | null;
  contentItemId: string | null;
  publishingPackageId: string | null;
  postizPublishingJobId: string | null;
  platform: string | null;
  reportingPeriodId: string | null;
  metrics: Record<string, number>;
  normalizedMetrics: Record<string, number>;
  confidence: string;
  sourceFreshness: string | null;
  collectedAt: Date;
  createdAt: Date;
}

export interface PlatformMetricMappingSummary {
  id: string;
  platform: string;
  sourceMetricName: string;
  normalizedMetricName: string;
  mappingRule: Record<string, unknown> | null;
  confidence: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportingPeriodSummary {
  id: string;
  periodType: PeriodType;
  startDate: Date;
  endDate: Date;
  timezone: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceReportSummary {
  id: string;
  reportingPeriodId: string;
  campaignId: string;
  generatedByUserId: string;
  generatedByAgentRepId: string;
  reportStatus: ReportStatus;
  summary: string | null;
  topFindings: Record<string, unknown> | null;
  risks: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  linkedLearningSignalIds: string[];
  linkedSaifDecisionRecordId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
