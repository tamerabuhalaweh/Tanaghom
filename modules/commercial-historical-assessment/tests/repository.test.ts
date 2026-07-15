import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEvidenceSummary, previewEvidence } from '../repository';

const prismaMocks = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  commercialRevenueLine: { findFirst: vi.fn() },
  commercialPlan: { findMany: vi.fn() },
  contentRequest: { findMany: vi.fn() },
  commercialEvent: { findMany: vi.fn() },
  eventKpiRecord: { findMany: vi.fn() },
  leadCaptureRecord: { findMany: vi.fn() },
  eventProblem: { findMany: vi.fn() },
  connectorImportJob: { findMany: vi.fn() },
  commercialAssessmentSignal: { findMany: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

const scope = {
  revenueLineId: '11111111-1111-4111-8111-111111111111',
  eventIds: [],
  campaignIds: [],
  audienceQuery: null,
  channels: [],
  dateFrom: new Date('2025-01-01T00:00:00.000Z'),
  dateTo: new Date('2025-12-31T23:59:59.999Z'),
};

describe('historical assessment evidence repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.tenant.findUnique.mockResolvedValue({ default_currency: 'AED' });
    prismaMocks.commercialRevenueLine.findFirst.mockResolvedValue({ id: scope.revenueLineId, name: 'Online Courses' });
    prismaMocks.commercialPlan.findMany.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Leadership launch',
        status: 'completed',
        stage: 'implementation_engagement',
        horizon: 'product_or_event',
        objective: 'Sell leadership course',
        audience: 'Previous buyers',
        currency: 'USD',
        budget_target: 1000,
        revenue_target: 5000,
        strategy_summary: 'Warm audience launch',
        action_plan: 'Content and follow-up',
        updated_at: new Date('2025-06-30T00:00:00.000Z'),
        linked_event_id: '33333333-3333-4333-8333-333333333333',
        revenue_line: { name: 'Online Courses', revenue_line_type: 'online_course' },
      },
    ]);
    prismaMocks.contentRequest.findMany.mockResolvedValue([{
      id: '88888888-8888-4888-8888-888888888888',
      objective: 'Promote leadership workshop',
      audience: 'Entrepreneurs',
      channel: 'web',
      target_platforms: ['instagram'],
      cta: 'Register now',
      status: 'published',
      event_id: '33333333-3333-4333-8333-333333333333',
      created_at: new Date('2025-05-01T00:00:00.000Z'),
      updated_at: new Date('2025-06-01T00:00:00.000Z'),
    }]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Leadership workshop',
        event_type: 'virtual_event',
        event_date: new Date('2025-06-15T00:00:00.000Z'),
        location: 'Online',
        expected_attendance: 100,
        planned_budget: 3500,
        revenue_target: 25000,
        selected_channels: ['instagram', 'email'],
        offer: 'Leadership course',
        audience: 'Entrepreneurs',
        geography: 'UAE',
        fomo_angle: 'Limited cohort',
        upsell_plan: 'Coaching upgrade',
      },
    ]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
      {
        event_id: '33333333-3333-4333-8333-333333333333',
        source_type: 'connector',
        source_name: 'meta',
        metric_date: new Date('2025-06-16T00:00:00.000Z'),
        channel: 'instagram',
        reach: 10000,
        impressions: 15000,
        interactions: 1200,
        clicks: 500,
        form_completions: 120,
        leads: 100,
        meetings_booked: 20,
        meetings_attended: 15,
        purchases: 10,
        no_shows: 5,
        spend: 2500,
      },
    ]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      {
        event_id: '33333333-3333-4333-8333-333333333333',
        lead_status: 'purchased',
        lead_temperature: 'buyer',
        source_of_truth: 'gohighlevel',
        channel_attribution: 'meta',
        purchase_amount: 3000,
        meeting_outcome: 'attended',
        created_at: new Date('2025-06-20T00:00:00.000Z'),
      },
    ]);
    prismaMocks.eventProblem.findMany.mockResolvedValue([]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        event_id: '33333333-3333-4333-8333-333333333333',
        connector_id: 'meta',
        state: 'imported',
        sync_status: 'synced',
        last_dry_run_at: new Date('2025-06-16T00:00:00.000Z'),
        last_sync_at: new Date('2025-06-17T00:00:00.000Z'),
      },
    ]);
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([{
      id: '99999999-9999-4999-8999-999999999999',
      title: 'Warm audience converted well',
      source_type: 'event_closeout',
      severity: 'info',
      finding: 'Previous buyers converted above target.',
      recommended_action: 'Repeat the warm-audience sequence.',
      status: 'resolved',
      commercial_plan_id: '22222222-2222-4222-8222-222222222222',
      created_at: new Date('2025-07-01T00:00:00.000Z'),
    }]);
  });

  it('collects tenant-scoped, non-PII evidence and assigns event actuals to the linked explicit USD plan', async () => {
    const preview = await previewEvidence('tenant-a', scope);

    expect(prismaMocks.commercialPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', revenue_line_id: scope.revenueLineId }),
    }));
    expect(prismaMocks.eventKpiRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: { in: ['33333333-3333-4333-8333-333333333333'] } }),
    }));
    expect(preview.scope.defaultCurrency).toBe('AED');
    expect(preview.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ evidenceType: 'campaign' }),
      expect.objectContaining({ evidenceType: 'assessment_signal' }),
    ]));
    expect(preview.summary).toMatchObject({
      completedEvents: 1,
      commercialPlans: 1,
      targetsByCurrency: { USD: { budgetTarget: 1000, revenueTarget: 5000, plans: 1 } },
      actualsByCurrency: { USD: { knownSpend: 2500, knownRevenue: 3000 } },
      operatingActuals: { currency: 'USD', leads: 100, purchases: 10, knownSpend: 2500, knownRevenue: 3000 },
    });
    const storedText = JSON.stringify(preview.evidence);
    expect(storedText).not.toContain('emailAddress');
    expect(storedText).not.toContain('@example');
    expect(storedText).not.toContain('phone');
    expect(storedText).not.toContain('apiKey');
  });

  it('withholds mixed-currency event money instead of combining or relabeling it', () => {
    const summary = buildEvidenceSummary([
      {
        evidenceType: 'event', sourceObjectType: 'commercial_event', sourceObjectId: 'event-1',
        sourceName: 'Mixed plan event', metricKey: 'completed_event_context', metricValue: null,
        metricUnit: 'mixed', observedAt: new Date('2025-06-15'), payload: { currency: 'mixed' },
      },
      {
        evidenceType: 'event_kpi', sourceObjectType: 'event_channel_kpis', sourceObjectId: 'event-1:meta',
        sourceName: 'Mixed plan event - meta', metricKey: 'channel_performance', metricValue: 2500,
        metricUnit: 'mixed', observedAt: new Date('2025-06-16'),
        payload: { eventId: 'event-1', currency: 'mixed', channel: 'meta', spend: 2500, leads: 10, purchases: 2 },
      },
      {
        evidenceType: 'lead_outcome', sourceObjectType: 'event_lead_outcomes', sourceObjectId: 'event-1',
        sourceName: 'Mixed plan event', metricKey: 'lead_funnel_outcomes', metricValue: 3000,
        metricUnit: 'mixed', observedAt: new Date('2025-06-20'),
        payload: { currency: 'mixed', knownRevenue: 3000, total: 10, byStatus: { purchased: 2 } },
      },
    ], 'AED');

    expect(summary).toMatchObject({
      ambiguousCurrencyRecordCount: 2,
      actualsByCurrency: {},
      operatingActuals: { currency: 'mixed', knownSpend: 0, knownRevenue: 0, leads: 10, purchases: 2 },
      eventComparison: [expect.objectContaining({ currency: 'mixed', knownSpend: 0, knownRevenue: 0 })],
    });
  });

  it('builds a deterministic side-by-side comparison when two completed events have evidence', async () => {
    const secondEventId = '77777777-7777-4777-8777-777777777777';
    prismaMocks.commercialPlan.findMany.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Leadership launch', status: 'completed', stage: 'implementation_engagement', horizon: 'product_or_event',
        objective: 'Sell leadership course', audience: 'Previous buyers', currency: 'AED', budget_target: 1000, revenue_target: 5000,
        strategy_summary: 'Warm audience launch', action_plan: 'Content and follow-up', updated_at: new Date('2025-06-30'),
        linked_event_id: '33333333-3333-4333-8333-333333333333', revenue_line: { name: 'Online Courses', revenue_line_type: 'online_course' },
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        title: 'Second leadership launch', status: 'completed', stage: 'implementation_engagement', horizon: 'product_or_event',
        objective: 'Sell leadership course', audience: 'Previous buyers', currency: 'AED', budget_target: 1500, revenue_target: 7000,
        strategy_summary: 'Buyer proof launch', action_plan: 'Content and follow-up', updated_at: new Date('2025-09-30'),
        linked_event_id: secondEventId, revenue_line: { name: 'Online Courses', revenue_line_type: 'online_course' },
      },
    ]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333', name: 'Leadership workshop', event_type: 'virtual_event',
        event_date: new Date('2025-06-15'), location: 'Online', expected_attendance: 100, planned_budget: 3500,
        revenue_target: 25000, selected_channels: ['instagram'], offer: 'Leadership course', audience: 'Entrepreneurs',
        geography: 'UAE', fomo_angle: 'Limited cohort', upsell_plan: 'Coaching upgrade',
      },
      {
        id: secondEventId, name: 'Leadership workshop - Autumn', event_type: 'virtual_event',
        event_date: new Date('2025-09-15'), location: 'Dubai', expected_attendance: 140, planned_budget: 5000,
        revenue_target: 40000, selected_channels: ['instagram'], offer: 'Leadership course', audience: 'Previous buyers',
        geography: 'UAE', fomo_angle: 'Final cohort', upsell_plan: 'Coaching upgrade',
      },
    ]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
      {
        event_id: '33333333-3333-4333-8333-333333333333', source_type: 'connector', source_name: 'meta',
        metric_date: new Date('2025-06-16'), channel: 'instagram', reach: 10000, impressions: 15000, interactions: 1200,
        clicks: 500, form_completions: 120, leads: 100, meetings_booked: 20, meetings_attended: 15,
        purchases: 10, no_shows: 5, spend: 2500,
      },
      {
        event_id: secondEventId, source_type: 'connector', source_name: 'meta', metric_date: new Date('2025-09-16'),
        channel: 'instagram', reach: 16000, impressions: 22000, interactions: 1800, clicks: 700,
        form_completions: 180, leads: 150, meetings_booked: 30, meetings_attended: 26, purchases: 18, no_shows: 4, spend: 3400,
      },
    ]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      {
        event_id: '33333333-3333-4333-8333-333333333333', lead_status: 'purchased', lead_temperature: 'buyer',
        source_of_truth: 'gohighlevel', channel_attribution: 'meta', purchase_amount: 3000, meeting_outcome: 'attended', created_at: new Date('2025-06-20'),
      },
      {
        event_id: secondEventId, lead_status: 'purchased', lead_temperature: 'buyer', source_of_truth: 'gohighlevel',
        channel_attribution: 'meta', purchase_amount: 5000, meeting_outcome: 'attended', created_at: new Date('2025-09-20'),
      },
    ]);

    const preview = await previewEvidence('tenant-a', scope);
    const comparisons = preview.summary.eventComparison as Array<Record<string, unknown>>;

    expect(preview.summary.comparisonReady).toBe(true);
    expect(comparisons).toHaveLength(2);
    expect(comparisons).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventId: secondEventId, eventName: 'Leadership workshop - Autumn', reach: 16000, leads: 150, purchases: 18, knownSpend: 3400, knownRevenue: 5000 }),
      expect.objectContaining({ eventId: '33333333-3333-4333-8333-333333333333', eventName: 'Leadership workshop', reach: 10000, leads: 100, purchases: 10, knownSpend: 2500, knownRevenue: 3000 }),
    ]));
  });

  it('rejects a revenue line from another tenant', async () => {
    prismaMocks.commercialRevenueLine.findFirst.mockResolvedValue(null);
    await expect(previewEvidence('tenant-a', scope)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects event and campaign scope IDs that are not owned by the tenant', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValueOnce([]);
    await expect(previewEvidence('tenant-a', {
      ...scope,
      eventIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    })).rejects.toMatchObject({ statusCode: 404 });

    prismaMocks.contentRequest.findMany.mockResolvedValueOnce([]);
    await expect(previewEvidence('tenant-a', {
      ...scope,
      campaignIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a non-completed event from historical comparison scope', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValueOnce([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'active' }]);
    await expect(previewEvidence('tenant-a', {
      ...scope,
      eventIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    })).rejects.toThrow('must reference completed events');
  });

  it('reports honest empty-state gaps without inventing evidence', async () => {
    prismaMocks.commercialPlan.findMany.mockResolvedValue([]);
    prismaMocks.contentRequest.findMany.mockResolvedValue([]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([]);
    const preview = await previewEvidence('tenant-a', { ...scope, revenueLineId: null });
    expect(preview.evidence).toEqual([]);
    expect(preview.missingData).toContain('No completed events were found in this assessment period.');
    expect(preview.summary).toMatchObject({ evidenceCount: 0, comparisonReady: false });
  });
});
