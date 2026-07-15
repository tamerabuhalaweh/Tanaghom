import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRevenueLineDashboard } from '../repository';

const prismaMocks = vi.hoisted(() => ({
  tenant: {
    findUnique: vi.fn(),
  },
  commercialRevenueLine: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  commercialPlan: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  commercialAssessmentSignal: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  commercialEvent: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    findFirst: vi.fn(),
  },
  eventKpiRecord: {
    findMany: vi.fn(),
  },
  leadCaptureRecord: {
    findMany: vi.fn(),
  },
  connectorImportJob: {
    findMany: vi.fn(),
  },
  commercialLearningSet: {
    findMany: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

const now = new Date('2026-07-08T12:00:00.000Z');

function configuredLine(type = 'online_course') {
  return {
    id: 'line-1',
    tenant_key: 'tenant-a',
    revenue_line_type: type,
    name: type === 'live_event' ? 'Live Events' : 'Online Courses',
    description: 'Commercial line',
    status: 'active',
    system_of_record: 'tanaghum',
    owner_user_id: null,
    created_at: now,
    updated_at: now,
    _count: { plans: 1, assessment_signals: 1 },
  };
}

function plan(eventId = 'event-1', eventName = 'Course Launch', currency = 'USD') {
  return {
    id: 'plan-1',
    tenant_key: 'tenant-a',
    revenue_line_id: 'line-1',
    revenue_line: { revenue_line_type: 'online_course', name: 'Online Courses' },
    linked_event_id: eventId,
    linked_event: eventId ? { name: eventName } : null,
    horizon: 'quarterly',
    stage: 'implementation_engagement',
    title: 'Quarterly course launch',
    objective: 'Grow course revenue',
    audience: 'Warm leads',
    currency,
    budget_target: 1000,
    revenue_target: 5000,
    kpi_targets: {},
    strategy_summary: 'Launch plan',
    action_plan: 'Execute channels',
    status: 'active',
    owner_user_id: null,
    created_by_user_id: 'user-1',
    created_at: now,
    updated_at: now,
  };
}

describe('Commercial Command Center revenue-line dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.tenant.findUnique.mockResolvedValue({ default_currency: 'AED' });
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([]);
    prismaMocks.commercialLearningSet.findMany.mockResolvedValue([]);
  });

  it('aggregates spend, leads and purchases from tenant-scoped event records', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine());
    prismaMocks.commercialPlan.findMany.mockResolvedValue([plan()]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Course Launch',
        status: 'active',
        event_type: 'virtual_event',
        event_date: now,
        planned_budget: 1200,
        revenue_target: 6000,
      },
    ]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
      {
        source_type: 'connector',
        spend: 500,
        leads: 10,
        meetings_booked: 4,
        meetings_attended: 3,
        purchases: 2,
        no_shows: 1,
      },
    ]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      { lead_status: 'purchased', purchase_amount: 1500, meeting_date: now, meeting_outcome: 'attended' },
      { lead_status: 'contacted', purchase_amount: null, meeting_date: now, meeting_outcome: 'no_show' },
    ]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([
      { state: 'test_passed', sync_status: 'ready_for_sync' },
      { state: 'imported', sync_status: 'synced' },
    ]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'online_course');

    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', id: { in: ['event-1'] } },
    }));
    expect(dashboard.rollups).toMatchObject({
      plannedRevenueTarget: 5000,
      knownRevenue: 1500,
      currency: 'USD',
      plannedBudget: 1000,
      knownSpend: 500,
      budgetVariance: 500,
      leads: 10,
      purchases: 2,
      meetingsBooked: 4,
      meetingsAttended: 3,
      noShows: 1,
      costPerLead: 50,
      costPerPurchase: 250,
      leadToPurchaseRate: 20,
    });
    expect(dashboard.dataStatus).toMatchObject({
      hasLinkedEvents: true,
      hasKpiRecords: true,
      hasLeadRecords: true,
      hasConnectorRecords: true,
    });
    expect(dashboard.linkedEvents[0]).toMatchObject({
      linkedPlanCount: 1,
      linkedPlanTitles: ['Quarterly course launch'],
    });
    expect(dashboard.availableEvents[0]?.name).toBe('Course Launch');
    expect(dashboard.connectorStatus).toMatchObject({ jobs: 2, readyForSync: 1, synced: 1, blocked: 0 });
    expect(dashboard.reporting).toMatchObject({
      primaryDimension: 'revenue_line',
      countryGrouping: false,
      supportedCurrencies: ['USD', 'AED'],
    });
    expect(dashboard.rollups.currencyBreakdown).toEqual([
      { currency: 'USD', plannedRevenueTarget: 5000, plannedBudget: 1000, planCount: 1 },
    ]);
  });

  it('surfaces only approved historical learning for the selected revenue line', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine());
    prismaMocks.commercialPlan.findMany.mockResolvedValue([]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);
    prismaMocks.commercialLearningSet.findMany.mockResolvedValue([{
      approved_at: now,
      assessment_run: { title: '2025 Online Courses Review' },
      findings: [{
        id: 'finding-1',
        finding_type: 'repeat',
        title: 'Reuse buyer proof',
        recommendation: 'Lead with verified outcomes from previous buyers.',
        confidence: 0.86,
      }],
    }]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'online_course');

    expect(prismaMocks.commercialLearningSet.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenant_key: 'tenant-a',
        status: 'active',
        OR: [
          { assessment_run: { revenue_line_id: 'line-1' } },
          { assessment_run: { revenue_line_id: null } },
        ],
      }),
    }));
    expect(dashboard.approvedLearning).toEqual([{
      id: 'finding-1',
      type: 'repeat',
      title: 'Reuse buyer proof',
      recommendation: 'Lead with verified outcomes from previous buyers.',
      confidence: 0.86,
      assessmentTitle: '2025 Online Courses Review',
      approvedAt: now.toISOString(),
    }]);
  });

  it('keeps AED and USD plan targets separated in the currency breakdown', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine('book'));
    prismaMocks.commercialPlan.findMany.mockResolvedValue([
      { ...plan('event-1', 'Book Launch', 'AED'), revenue_line: { revenue_line_type: 'book', name: 'Books' }, revenue_target: 12000, budget_target: 2000 },
      { ...plan('event-1', 'Book Launch', 'USD'), revenue_line: { revenue_line_type: 'book', name: 'Books' }, id: 'plan-2', revenue_target: 3000, budget_target: 800 },
    ]);
    prismaMocks.commercialEvent.findMany
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          name: 'Book Launch',
          status: 'active',
          event_type: 'virtual_event',
          event_date: now,
          planned_budget: 0,
          revenue_target: 0,
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'book');

    expect(dashboard.rollups.currency).toBe('mixed');
    expect(dashboard.rollups.currencyBreakdown).toEqual([
      { currency: 'AED', plannedRevenueTarget: 12000, plannedBudget: 2000, planCount: 1 },
      { currency: 'USD', plannedRevenueTarget: 3000, plannedBudget: 800, planCount: 1 },
    ]);
    expect(dashboard.reporting.primaryDimension).toBe('revenue_line');
    expect(dashboard.reporting.countryGrouping).toBe(false);
  });

  it('shows available tenant events as link choices without counting them as linked data', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine());
    prismaMocks.commercialPlan.findMany.mockResolvedValue([plan(null)]);
    prismaMocks.commercialEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'event-available',
          name: 'Leadership Course Live Workshop',
          status: 'planning',
          event_type: 'tagyeer_wa_irtaqi',
          event_date: now,
          planned_budget: 2000,
          revenue_target: 12000,
        },
        {
          id: 'event-test',
          name: 'Sprint 65 Acceptance Event 1783076057587',
          status: 'draft',
          event_type: 'tagyeer_wa_irtaqi',
          event_date: now,
          planned_budget: 35000,
          revenue_target: 120000,
        },
      ]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'online_course');

    expect(prismaMocks.eventKpiRecord.findMany).not.toHaveBeenCalled();
    expect(prismaMocks.leadCaptureRecord.findMany).not.toHaveBeenCalled();
    expect(dashboard.linkedEvents).toHaveLength(0);
    expect(dashboard.availableEvents).toHaveLength(1);
    expect(dashboard.availableEvents[0]).toMatchObject({
      id: 'event-available',
      name: 'Leadership Course Live Workshop',
      linkedPlanCount: 0,
      linkedPlanTitles: [],
    });
    expect(dashboard.dataStatus.hasLinkedEvents).toBe(false);
    expect(dashboard.dataStatus.missingDataSources).toContain('Link an event or campaign so this revenue line has operating data.');
  });

  it('does not expose old acceptance event names through linked plan summaries', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine());
    prismaMocks.commercialPlan.findMany.mockResolvedValue([
      plan('event-test', 'Sprint 65 Acceptance Event 1783076057587'),
    ]);
    prismaMocks.commercialEvent.findMany
      .mockResolvedValueOnce([
        {
          id: 'event-test',
          name: 'Sprint 65 Acceptance Event 1783076057587',
          status: 'draft',
          event_type: 'tagyeer_wa_irtaqi',
          event_date: now,
          planned_budget: 35000,
          revenue_target: 120000,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'event-production',
          name: 'Leadership Course Live Workshop',
          status: 'planning',
          event_type: 'tagyeer_wa_irtaqi',
          event_date: now,
          planned_budget: 2000,
          revenue_target: 12000,
        },
      ]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'online_course');

    expect(dashboard.plans[0]?.linkedEventId).toBe('event-test');
    expect(dashboard.plans[0]?.linkedEventName).toBeNull();
    expect(JSON.stringify(dashboard)).not.toMatch(/Sprint\s*65|Acceptance Event/i);
  });

  it('uses all tenant events for the live-event revenue line', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(configuredLine('live_event'));
    prismaMocks.commercialPlan.findMany.mockResolvedValue([]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-production',
        name: 'Moaaskar Al Tamayoz - New Camp',
        status: 'active',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: now,
        planned_budget: 3000,
        revenue_target: 12000,
      },
      {
        id: 'event-acceptance',
        name: 'Sprint 65 Acceptance Event 1783076057587',
        status: 'draft',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: now,
        planned_budget: 35000,
        revenue_target: 120000,
      },
    ]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'live_event');

    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a' },
    }));
    expect(dashboard.linkedEvents).toHaveLength(1);
    expect(dashboard.linkedEvents[0]?.name).toBe('Moaaskar Al Tamayoz - New Camp');
    expect(dashboard.availableEvents).toHaveLength(1);
    expect(dashboard.availableEvents[0]?.name).toBe('Moaaskar Al Tamayoz - New Camp');
    expect(dashboard.rollups.plannedBudget).toBe(3000);
    expect(dashboard.rollups.plannedRevenueTarget).toBe(12000);
  });

  it('returns honest setup gaps for unconfigured revenue lines', async () => {
    prismaMocks.commercialRevenueLine.findUnique.mockResolvedValue(null);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);

    const dashboard = await getRevenueLineDashboard('tenant-a', 'b2b');

    expect(dashboard.revenueLine.configured).toBe(false);
    expect(dashboard.rollups).toMatchObject({
      plannedRevenueTarget: 0,
      knownRevenue: 0,
      plannedBudget: 0,
      knownSpend: 0,
      leads: 0,
      purchases: 0,
    });
    expect(dashboard.dataStatus.missingDataSources).toContain('Configure this revenue line before planning work can be saved.');
    expect(dashboard.nextAction.label).toBe('Configure revenue line');
  });
});
