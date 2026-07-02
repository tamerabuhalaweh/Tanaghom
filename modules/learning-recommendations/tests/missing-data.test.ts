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

describe('Learning Recommendations missing data handling', () => {
  beforeEach(() => { resetAllMocks(); });

  it('returns data completeness warnings when no KPI records', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    expect(result.dataCompletenessWarnings).toContain('No KPI records available - budget and spend analysis limited');
  });

  it('returns data completeness warnings when no leads', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    expect(result.dataCompletenessWarnings).toContain('No lead records available - funnel and conversion analysis unavailable');
  });

  it('returns data completeness warnings when no campaigns', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    expect(result.dataCompletenessWarnings).toContain('No campaign records available - channel performance analysis limited');
  });

  it('does not hallucinate confidence when data is missing', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
      { id: 'l2', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      { id: 'l3', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
    ]);
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    const rec = result.recommendations.find(r => r.category === 'no_show');
    expect(rec).toBeDefined();
    expect(rec!.confidence).toBe('low');
    expect(rec!.missingDataWarnings.length).toBeGreaterThan(0);
  });

  it('sets high confidence when sufficient data exists', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    const leads = Array.from({ length: 13 }, (_, i) => ({
      id: `l${i}`, lead_status: i < 10 ? 'meeting_booked' : 'no_show', lead_temperature: 'cold',
      audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null,
      follow_up_date: null, meeting_date: i < 10 ? new Date() : null, meeting_type: i < 10 ? 'call' : null,
      lead_name_placeholder: null, created_at: new Date(),
    }));
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue(leads);
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    const rec = result.recommendations.find(r => r.category === 'no_show');
    expect(rec).toBeDefined();
    expect(rec!.confidence).toBe('high');
  });

  it('produces empty recommendations when no data and no rules triggered', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent());
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    expect(result.recommendations).toHaveLength(0);
    expect(result.dataCompletenessWarnings.length).toBeGreaterThan(0);
  });

  it('returns event metadata even with no recommendations', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(mockEvent({ name: 'Empty Event' }));
    const result = await repo.generateRecommendations('tenant-a', 'event-1');
    expect(result.eventId).toBe('event-1');
    expect(result.eventName).toBe('Empty Event');
    expect(result.generatedAt).toBeDefined();
  });
});
