/**
 * Provider Interfaces — Type Definitions Only
 *
 * These interfaces define the contract for all external service integrations.
 * Implementations are provided as mock providers during development and
 * real providers after security review.
 *
 * DO NOT add implementation logic here. This file is types only.
 */

// ============================================================
// LLMProvider — Text generation and embeddings
// ============================================================

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMProvider {
  /**
   * Generate text from a prompt.
   */
  generateText(prompt: string, options?: LLMOptions): Promise<string>;

  /**
   * Generate structured output that conforms to a JSON schema.
   */
  generateStructured<T>(prompt: string, schema: Record<string, unknown>): Promise<T>;

  /**
   * Generate embeddings for a text string.
   */
  embeddings(text: string): Promise<number[]>;
}

// ============================================================
// PostizProvider — Social media publishing and analytics
// ============================================================

export interface DraftContent {
  text: string;
  platform: string;
  mediaRefs?: string[];
  scheduledAt?: Date;
  timezone?: string;
  integrationId?: string;
}

export interface PostizPost {
  id: string;
  platform: string;
  status: string;
  scheduledAt?: Date;
  publishedAt?: Date;
}

export interface ScheduleResult {
  success: boolean;
  postId: string;
  scheduledAt: Date;
  error?: string;
}

export interface PostAnalytics {
  postId: string;
  platform: string;
  metrics: Record<string, number>;
  collectedAt: Date;
}

export interface PlatformAnalytics {
  platform: string;
  period: string;
  metrics: Record<string, number>;
  collectedAt: Date;
}

export interface Integration {
  id: string;
  platform: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
}

export interface PostizProvider {
  /**
   * Create a draft post in Postiz.
   */
  createDraft(content: DraftContent): Promise<PostizPost>;

  /**
   * Schedule an existing draft for publishing.
   */
  schedulePost(postId: string, scheduledAt: Date, timezone: string): Promise<ScheduleResult>;

  /**
   * Get analytics for a specific post.
   */
  getPostAnalytics(postId: string): Promise<PostAnalytics>;

  /**
   * Get platform-level analytics.
   */
  getPlatformAnalytics(platform: string, period: string): Promise<PlatformAnalytics>;

  /**
   * List connected platform integrations.
   */
  listIntegrations(): Promise<Integration[]>;
}

// ============================================================
// MessagingProvider — WhatsApp / Telegram / Slack
// ============================================================

export interface ApprovalRequest {
  contentItemId: string;
  platform: string;
  draftText: string;
  riskScore: number;
  riskReason: string;
  approverName: string;
  actions: string[];
}

export type MessageHandler = (message: string, sender: string) => void;

export interface MessagingProvider {
  /**
   * Send a text message to a channel.
   */
  sendMessage(channel: string, message: string): Promise<void>;

  /**
   * Send an approval request notification.
   */
  sendApprovalRequest(channel: string, request: ApprovalRequest): Promise<void>;

  /**
   * Register a handler for incoming messages.
   */
  onMessage(channel: string, handler: MessageHandler): void;
}

// ============================================================
// CRMProvider — Lead management and WhatsApp handoff
// ============================================================

export interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  source: string;
  campaignId: string;
  platform: string;
  tags?: string[];
}

export interface Lead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  source: string;
  tags: string[];
  createdAt: Date;
}

export interface CRMProvider {
  /**
   * Create a new lead in the CRM.
   */
  createLead(lead: LeadData): Promise<Lead>;

  /**
   * Apply tags to an existing contact.
   */
  tagContact(contactId: string, tags: string[]): Promise<void>;

  /**
   * Route a lead to WhatsApp for direct handoff.
   */
  routeToWhatsApp(leadId: string, message: string): Promise<void>;
}

// ============================================================
// AnalyticsProvider — Platform analytics data
// ============================================================

export type MetricWindow = '48h' | '7d' | '30d';

export interface Period {
  start: Date;
  end: Date;
}

export interface PostMetrics {
  postId: string;
  platform: string;
  window: MetricWindow;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  saves: number;
  clicks: number;
  engagementRate: number;
}

export interface PlatformMetrics {
  platform: string;
  period: Period;
  followers: number;
  impressions: number;
  engagement: number;
  followerGrowth: number;
}

export interface AnalyticsProvider {
  /**
   * Get metrics for a specific post within a time window.
   */
  getPostMetrics(postId: string, window: MetricWindow): Promise<PostMetrics>;

  /**
   * Get platform-level metrics for a period.
   */
  getPlatformMetrics(platform: string, period: Period): Promise<PlatformMetrics>;
}
