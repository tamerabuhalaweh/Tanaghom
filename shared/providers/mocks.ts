/**
 * Mock Providers — For development and testing
 *
 * These mock implementations return predictable data without calling external services.
 * Use them in tests and during development.
 *
 * DO NOT use these in production. Real implementations require security review.
 */

import type {
  LLMProvider,
  LLMOptions,
  PostizProvider,
  DraftContent,
  PostizPost,
  ScheduleResult,
  PostAnalytics,
  PlatformAnalytics,
  Integration,
  MessagingProvider,
  ApprovalRequest,
  MessageHandler,
  CRMProvider,
  LeadData,
  Lead,
  AnalyticsProvider,
  MetricWindow,
  Period,
  PostMetrics,
  PlatformMetrics,
} from './interfaces';

// ============================================================
// MockLLMProvider
// ============================================================

function deterministicHash(text: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

export class MockLLMProvider implements LLMProvider {
  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    return `[MOCK] Generated text for prompt: ${prompt.substring(0, 50)}...`;
  }

  async generateStructured<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
    return {} as T;
  }

  async embeddings(text: string): Promise<number[]> {
    const result: number[] = [];
    for (let i = 0; i < 1536; i++) {
      const hash = deterministicHash(text, i);
      result.push((hash % 10000) / 10000);
    }
    return result;
  }
}

// ============================================================
// MockPostizProvider
// ============================================================

export class MockPostizProvider implements PostizProvider {
  private postIdCounter = 0;

  async createDraft(content: DraftContent): Promise<PostizPost> {
    this.postIdCounter++;
    return {
      id: `mock-post-${this.postIdCounter}`,
      platform: content.platform,
      status: 'draft',
    };
  }

  async schedulePost(postId: string, scheduledAt: Date, timezone: string): Promise<ScheduleResult> {
    return {
      success: true,
      postId,
      scheduledAt,
    };
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    return {
      postId,
      platform: 'mock',
      metrics: {
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 20),
        shares: Math.floor(Math.random() * 10),
        impressions: Math.floor(Math.random() * 1000),
        reach: Math.floor(Math.random() * 800),
      },
      collectedAt: new Date(),
    };
  }

  async getPlatformAnalytics(platform: string, period: string): Promise<PlatformAnalytics> {
    return {
      platform,
      period,
      metrics: {
        followers: 1000,
        impressions: 5000,
        engagement: 250,
        followerGrowth: 50,
      },
      collectedAt: new Date(),
    };
  }

  async listIntegrations(): Promise<Integration[]> {
    return [
      { id: 'mock-li-1', platform: 'linkedin', accountId: 'mock-account', accountName: 'SmartLabs', isActive: true },
      { id: 'mock-ig-1', platform: 'instagram', accountId: 'mock-account', accountName: 'SmartLabs', isActive: true },
      { id: 'mock-x-1', platform: 'x', accountId: 'mock-account', accountName: 'SmartLabs', isActive: true },
    ];
  }
}

// ============================================================
// MockMessagingProvider
// ============================================================

export class MockMessagingProvider implements MessagingProvider {
  public sentMessages: Array<{ channel: string; message: string }> = [];
  public sentApprovals: Array<{ channel: string; request: ApprovalRequest }> = [];

  async sendMessage(channel: string, message: string): Promise<void> {
    this.sentMessages.push({ channel, message });
  }

  async sendApprovalRequest(channel: string, request: ApprovalRequest): Promise<void> {
    this.sentApprovals.push({ channel, request });
  }

  onMessage(channel: string, handler: MessageHandler): void {
    // No-op in mock
  }
}

// ============================================================
// MockCRMProvider
// ============================================================

export class MockCRMProvider implements CRMProvider {
  private leadCounter = 0;

  async createLead(lead: LeadData): Promise<Lead> {
    this.leadCounter++;
    return {
      id: `mock-lead-${this.leadCounter}`,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      tags: lead.tags || [],
      createdAt: new Date(),
    };
  }

  async tagContact(contactId: string, tags: string[]): Promise<void> {
    // No-op in mock
  }

  async routeToWhatsApp(leadId: string, message: string): Promise<void> {
    // No-op in mock
  }
}

// ============================================================
// MockAnalyticsProvider
// ============================================================

export class MockAnalyticsProvider implements AnalyticsProvider {
  async getPostMetrics(postId: string, window: MetricWindow): Promise<PostMetrics> {
    return {
      postId,
      platform: 'mock',
      window,
      likes: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 20),
      shares: Math.floor(Math.random() * 10),
      impressions: Math.floor(Math.random() * 1000),
      reach: Math.floor(Math.random() * 800),
      saves: Math.floor(Math.random() * 15),
      clicks: Math.floor(Math.random() * 30),
      engagementRate: Math.random() * 0.1,
    };
  }

  async getPlatformMetrics(platform: string, period: Period): Promise<PlatformMetrics> {
    return {
      platform,
      period,
      followers: 1000,
      impressions: 5000,
      engagement: 250,
      followerGrowth: 50,
    };
  }
}
