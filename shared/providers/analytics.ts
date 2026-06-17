export interface AnalyticsIngestionRequest {
  platform: string;
  campaignId?: string;
  contentItemId?: string;
  publishingPackageId?: string;
  postizPublishingJobId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface AnalyticsSnapshot {
  platform: string;
  collectedAt: Date;
  metrics: Record<string, number>;
  normalizedMetrics: Record<string, number>;
  confidence: string;
  sourceFreshness: string;
}

export interface PlatformMetricMapping {
  platform: string;
  sourceMetricName: string;
  normalizedMetricName: string;
  mappingRule?: Record<string, unknown>;
}

export interface PerformanceReport {
  campaignId: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string;
  topFindings: string[];
  risks: string[];
  recommendations: string[];
  linkedLearningSignalIds: string[];
}

export interface AnalyticsProvider {
  requestIngestion(request: AnalyticsIngestionRequest): Promise<{ requestId: string; status: string }>;
  fetchSnapshot(platform: string, campaignId?: string): Promise<AnalyticsSnapshot>;
  normalizeMetrics(platform: string, rawMetrics: Record<string, number>): Promise<Record<string, number>>;
  generateReport(campaignId: string, periodStart: Date, periodEnd: Date): Promise<PerformanceReport>;
}
