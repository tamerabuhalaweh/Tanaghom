import { createHash } from 'crypto';
import type {
  AnalyticsProvider,
  AnalyticsIngestionRequest,
  AnalyticsSnapshot,
  PerformanceReport,
} from './analytics';

function generateDeterministicHash(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

const MOCK_METRICS: Record<string, Record<string, number>> = {
  Instagram: { impressions: 12500, reach: 8900, engagement: 1200, likes: 890, comments: 156, shares: 89, saves: 234, clicks: 445, ctr: 3.56 },
  LinkedIn: { impressions: 8700, reach: 6200, engagement: 890, likes: 567, comments: 234, shares: 89, clicks: 345, ctr: 3.97 },
  TikTok: { impressions: 45000, reach: 32000, engagement: 5600, likes: 4200, comments: 890, shares: 560, saves: 1200, clicks: 890, ctr: 1.98 },
  'X': { impressions: 15600, reach: 11200, engagement: 1890, likes: 1234, comments: 456, shares: 234, clicks: 567, ctr: 3.63 },
};

const NORMALIZED_METRICS: Record<string, Record<string, number>> = {
  Instagram: { impressions: 12500, reach: 8900, engagement: 1200, likes: 890, comments: 156, shares: 89, saves: 234, clicks: 445, ctr: 3.56 },
  LinkedIn: { impressions: 8700, reach: 6200, engagement: 890, likes: 567, comments: 234, shares: 89, clicks: 345, ctr: 3.97 },
  TikTok: { impressions: 45000, reach: 32000, engagement: 5600, likes: 4200, comments: 890, shares: 560, saves: 1200, clicks: 890, ctr: 1.98 },
  'X': { impressions: 15600, reach: 11200, engagement: 1890, likes: 1234, comments: 456, shares: 234, clicks: 567, ctr: 3.63 },
};

export class MockAnalyticsProvider implements AnalyticsProvider {
  async requestIngestion(request: AnalyticsIngestionRequest): Promise<{ requestId: string; status: string }> {
    const hash = generateDeterministicHash({
      platform: request.platform,
      campaignId: request.campaignId || 'none',
    });

    return {
      requestId: `mock-ingestion-${hash.substring(0, 8)}`,
      status: 'completed',
    };
  }

  async fetchSnapshot(platform: string, _campaignId?: string): Promise<AnalyticsSnapshot> {
    const metrics = MOCK_METRICS[platform] || MOCK_METRICS['Instagram'];
    const normalizedMetrics = NORMALIZED_METRICS[platform] || NORMALIZED_METRICS['Instagram'];

    return {
      platform,
      collectedAt: new Date(),
      metrics,
      normalizedMetrics,
      confidence: 'medium',
      sourceFreshness: 'mock_data',
    };
  }

  async normalizeMetrics(platform: string, rawMetrics: Record<string, number>): Promise<Record<string, number>> {
    // Mock normalization is identity transformation
    return { ...rawMetrics };
  }

  async generateReport(campaignId: string, periodStart: Date, periodEnd: Date): Promise<PerformanceReport> {
    return {
      campaignId,
      periodStart,
      periodEnd,
      summary: `Mock performance report for campaign ${campaignId}`,
      topFindings: [
        'Engagement rate above benchmark',
        'Impressions growing week-over-week',
        'Click-through rate stable',
      ],
      risks: [
        'Organic reach declining on platform',
        'Content fatigue detected',
      ],
      recommendations: [
        'Increase posting frequency',
        'Test new content formats',
        'Optimize posting times',
      ],
      linkedLearningSignalIds: [],
    };
  }
}
