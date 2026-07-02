import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn() },
  eventKpiRecord: { findMany: vi.fn().mockResolvedValue([]) },
  leadCaptureRecord: { findMany: vi.fn().mockResolvedValue([]) },
  eventProblem: { findMany: vi.fn().mockResolvedValue([]) },
  contentRequest: { findMany: vi.fn().mockResolvedValue([]) },
  publishingPackage: { findMany: vi.fn().mockResolvedValue([]) },
  eventEmailPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventWhatsappPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventUpsellPlan: { findMany: vi.fn().mockResolvedValue([]) },
  eventContentRequirement: { findMany: vi.fn().mockResolvedValue([]) },
  eventSalesTask: { findMany: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

function resetAllMocks() {
  prismaMocks.commercialEvent.findFirst.mockReset();
  prismaMocks.eventKpiRecord.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.leadCaptureRecord.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventProblem.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.contentRequest.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.publishingPackage.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventEmailPlan.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventWhatsappPlan.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventUpsellPlan.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventContentRequirement.findMany.mockReset().mockResolvedValue([]);
  prismaMocks.eventSalesTask.findMany.mockReset().mockResolvedValue([]);
}

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1', tenant_key: 'tenant-a', name: 'Test Event', event_type: 'virtual_event',
    event_date: new Date(), location: null, status: 'active', geography: null,
    expected_attendance: null, revenue_target: null, planned_budget: null,
    campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    ...overrides,
  };
}

describe('Learning Recommendations rules', () => {
  beforeEach(() => { resetAllMocks(); });

  describe('No-show rate rule', () => {
    it('recommends no-show recovery when rate > 20%', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l2', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l3', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l4', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const noShowRec = result.recommendations.find(r => r.category === 'no_show');
      expect(noShowRec).toBeDefined();
      expect(noShowRec!.priority).toBe('high');
      expect(noShowRec!.sourceMetrics.noShowRate).toBe(100);
    });

    it('does not recommend when rate <= 20%', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l2', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l3', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l4', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l5', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l6', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const noShowRec = result.recommendations.find(r => r.category === 'no_show');
      expect(noShowRec).toBeUndefined();
    });
  });

  describe('Budget efficiency rule', () => {
    it('recommends budget review when spend > 50% but purchases < 5', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent({ planned_budget: 10000 }));
      prismaMocks.eventKpiRecord.findMany.mockResolvedValue([{ spend: 6000, channel: 'instagram' }]);
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const budgetRec = result.recommendations.find(r => r.category === 'budget');
      expect(budgetRec).toBeDefined();
      expect(budgetRec!.priority).toBe('high');
      expect(budgetRec!.sourceMetrics.spendRatio).toBe(60);
    });

    it('does not recommend when purchases >= 5', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent({ planned_budget: 10000 }));
      prismaMocks.eventKpiRecord.findMany.mockResolvedValue([{ spend: 6000, channel: 'instagram' }]);
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l2', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l3', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l4', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l5', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const budgetRec = result.recommendations.find(r => r.category === 'budget');
      expect(budgetRec).toBeUndefined();
    });
  });

  describe('Follow-up tasks rule', () => {
    it('recommends SLA when open follow-up tasks exist', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'contacted', lead_temperature: 'warm', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: new Date('2020-01-01'), meeting_date: null, meeting_type: null, lead_name_placeholder: 'Ahmed', created_at: new Date() },
      ]);
      prismaMocks.eventSalesTask.findMany.mockResolvedValue([
        { id: 't1', status: 'pending', task_type: 'follow_up', description: 'Call lead', due_date: new Date('2020-01-01'), owner_role: 'sales_manager' },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const followUpRec = result.recommendations.find(r => r.category === 'follow_up');
      expect(followUpRec).toBeDefined();
      expect(followUpRec!.sourceMetrics.openFollowUps).toBe(2);
    });

    it('does not recommend when no open tasks', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);
      prismaMocks.eventSalesTask.findMany.mockResolvedValue([]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const followUpRec = result.recommendations.find(r => r.category === 'follow_up');
      expect(followUpRec).toBeUndefined();
    });
  });

  describe('Content delay rule', () => {
    it('recommends earlier deadlines when content is overdue', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.contentRequest.findMany.mockResolvedValue([
        { id: 'c1', raw_message: 'Video ad', status: 'drafting', target_platforms: ['instagram'], due_date: new Date('2026-06-01T00:00:00Z'), created_at: new Date() },
      ]);
      prismaMocks.publishingPackage.findMany.mockResolvedValue([
        { id: 'p1', package_status: 'blocked', package_type: 'social_post', due_date: new Date('2026-06-01T00:00:00Z'), created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const contentRec = result.recommendations.find(r => r.category === 'content');
      expect(contentRec).toBeDefined();
      expect(contentRec!.suggestedOwnerRole).toBe('social_media_manager');
      expect(contentRec!.sourceMetrics.totalOverdue).toBeGreaterThanOrEqual(1);
    });

    it('does not recommend when content is completed (approved/scheduled/published)', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.contentRequest.findMany.mockResolvedValue([
        { id: 'c1', raw_message: 'Video ad', status: 'approved', target_platforms: ['instagram'], created_at: new Date() },
        { id: 'c2', raw_message: 'Carousel', status: 'scheduled', target_platforms: ['instagram'], created_at: new Date() },
        { id: 'c3', raw_message: 'Post', status: 'published', target_platforms: ['instagram'], created_at: new Date() },
      ]);
      prismaMocks.publishingPackage.findMany.mockResolvedValue([
        { id: 'p1', package_status: 'ready_for_future_execution', package_type: 'social_post', created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const contentRec = result.recommendations.find(r => r.category === 'content');
      expect(contentRec).toBeUndefined();
    });

    it('does not recommend when active content is not yet overdue', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.contentRequest.findMany.mockResolvedValue([
        { id: 'c1', raw_message: 'Video ad', status: 'drafting', target_platforms: ['instagram'], due_date: futureDate, created_at: new Date() },
      ]);
      prismaMocks.publishingPackage.findMany.mockResolvedValue([]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const contentRec = result.recommendations.find(r => r.category === 'content');
      expect(contentRec).toBeUndefined();
    });

    it('ignores terminal states (rejected, cancelled, superseded)', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.contentRequest.findMany.mockResolvedValue([
        { id: 'c1', raw_message: 'Video ad', status: 'rejected', target_platforms: ['instagram'], created_at: new Date() },
        { id: 'c2', raw_message: 'Carousel', status: 'cancelled', target_platforms: ['instagram'], created_at: new Date() },
      ]);
      prismaMocks.publishingPackage.findMany.mockResolvedValue([
        { id: 'p1', package_status: 'superseded', package_type: 'social_post', created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const contentRec = result.recommendations.find(r => r.category === 'content');
      expect(contentRec).toBeUndefined();
    });
  });

  describe('Channel performance rule', () => {
    it('recommends channel focus when one channel significantly outperforms', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: 'instagram', purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l2', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: 'instagram', purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l3', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: 'instagram', purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l4', lead_status: 'new_lead', lead_temperature: 'cold', audience_source: null, channel_attribution: 'email', purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l5', lead_status: 'new_lead', lead_temperature: 'cold', audience_source: null, channel_attribution: 'email', purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l6', lead_status: 'new_lead', lead_temperature: 'cold', audience_source: null, channel_attribution: 'email', purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const channelRec = result.recommendations.find(r => r.category === 'channel');
      expect(channelRec).toBeDefined();
      expect(channelRec!.sourceMetrics.bestChannelRate).toBe(100);
      expect(channelRec!.sourceMetrics.worstChannelRate).toBe(0);
    });

    it('does not recommend with single channel', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: 'instagram', purchase_amount: 500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const channelRec = result.recommendations.find(r => r.category === 'channel');
      expect(channelRec).toBeUndefined();
    });
  });

  describe('Evidence citation', () => {
    it('includes source metrics and sections in recommendations', async () => {
      prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
      prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
        { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
        { id: 'l2', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l3', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
        { id: 'l4', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      ]);
      const result = await repo.generateRecommendations('tenant-a', 'event-1');
      const rec = result.recommendations[0];
      expect(rec.sourceMetrics).toBeDefined();
      expect(rec.sourceSections).toBeDefined();
      expect(rec.evidenceSummary).toBeDefined();
      expect(typeof rec.evidenceSummary).toBe('string');
      expect(rec.evidenceSummary.length).toBeGreaterThan(0);
    });
  });
});
