import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRevenueLineDashboard } from '../repository';

const prismaMocks = vi.hoisted(() => ({
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

function plan(eventId = 'event-1') {
  return {
    id: 'plan-1',
    tenant_key: 'tenant-a',
    revenue_line_id: 'line-1',
    revenue_line: { revenue_line_type: 'online_course', name: 'Online Courses' },
    linked_event_id: eventId,
    linked_event: eventId ? { name: 'Course Launch' } : null,
    horizon: 'quarterly',
    stage: 'implementation_engagement',
    title: 'Quarterly course launch',
    objective: 'Grow course revenue',
    audience: 'Warm leads',
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
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([]);
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
    expect(dashboard.connectorStatus).toMatchObject({ jobs: 2, readyForSync: 1, synced: 1, blocked: 0 });
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
