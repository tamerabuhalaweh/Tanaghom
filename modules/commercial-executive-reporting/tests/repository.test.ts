import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportPreview, getExecutiveDashboard } from '../repository';

const prismaMocks = vi.hoisted(() => ({
  commercialRevenueLine: { findMany: vi.fn() },
  commercialPlan: { findMany: vi.fn() },
  commercialEvent: { findMany: vi.fn() },
  eventKpiRecord: { findMany: vi.fn() },
  leadCaptureRecord: { findMany: vi.fn() },
  connectorImportJob: { findMany: vi.fn() },
  commercialDisciplineRecord: { findMany: vi.fn() },
  commercialAssessmentSignal: { findMany: vi.fn() },
  commercialExecutiveReport: { findMany: vi.fn(), create: vi.fn() },
  commercialExecutiveReportSchedule: { findMany: vi.fn(), create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

const now = new Date('2026-07-08T12:00:00.000Z');

function seedHappyPath() {
  prismaMocks.commercialRevenueLine.findMany.mockResolvedValue([
    { id: 'line-1', revenue_line_type: 'online_course', name: 'Online Courses', status: 'active' },
  ]);
  prismaMocks.commercialPlan.findMany.mockResolvedValue([
    {
      id: 'plan-1',
      revenue_line_id: 'line-1',
      linked_event_id: 'event-1',
      budget_target: 5000,
      revenue_target: 30000,
      status: 'active',
      revenue_line: { id: 'line-1', revenue_line_type: 'online_course', name: 'Online Courses' },
    },
  ]);
  prismaMocks.commercialEvent.findMany.mockResolvedValue([
    { id: 'event-1', name: 'Leadership Course Launch', planned_budget: 4500, revenue_target: 28000, event_date: now },
    { id: 'event-test', name: 'Sprint 65 Acceptance Event 123', planned_budget: 999999, revenue_target: 999999, event_date: now },
  ]);
  prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
    {
      event_id: 'event-1',
      source_type: 'connector',
      metric_date: now,
      channel: 'meta',
      reach: 10000,
      impressions: 18000,
      interactions: 900,
      clicks: 400,
      form_completions: 80,
      leads: 60,
      meetings_booked: 20,
      meetings_attended: 15,
      purchases: 8,
      no_shows: 5,
      spend: 3500,
    },
    {
      event_id: 'event-test',
      source_type: 'manual',
      metric_date: now,
      channel: 'manual',
      reach: 999999,
      impressions: 999999,
      interactions: 0,
      clicks: 0,
      form_completions: 0,
      leads: 999999,
      meetings_booked: 0,
      meetings_attended: 0,
      purchases: 0,
      no_shows: 0,
      spend: 999999,
    },
  ]);
  prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
    {
      event_id: 'event-1',
      lead_status: 'purchased',
      lead_temperature: 'buyer',
      channel_attribution: 'meta',
      source_of_truth: 'gohighlevel',
      purchase_amount: 12000,
      meeting_date: now,
      meeting_outcome: 'attended',
      external_last_synced_at: now,
      created_at: now,
    },
    {
      event_id: 'event-1',
      lead_status: 'contacted',
      lead_temperature: 'warm',
      channel_attribution: 'meta',
      source_of_truth: 'gohighlevel',
      purchase_amount: null,
      meeting_date: now,
      meeting_outcome: 'no_show',
      external_last_synced_at: now,
      created_at: now,
    },
  ]);
  prismaMocks.connectorImportJob.findMany.mockResolvedValue([
    { event_id: 'event-1', connector_id: 'meta_analytics', state: 'test_passed', sync_status: 'ready_for_sync', last_dry_run_at: now, last_sync_at: null },
    { event_id: 'event-1', connector_id: 'gohighlevel', state: 'test_passed', sync_status: 'synced', last_dry_run_at: now, last_sync_at: now },
  ]);
  prismaMocks.commercialDisciplineRecord.findMany.mockResolvedValue([
    { status: 'blocked', priority: 'critical', updated_at: now },
  ]);
  prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([
    { severity: 'critical', title: 'WhatsApp follow-up delay', recommended_action: 'Assign a same-day follow-up owner.' },
  ]);
  prismaMocks.commercialExecutiveReport.findMany.mockResolvedValue([]);
  prismaMocks.commercialExecutiveReportSchedule.findMany.mockResolvedValue([]);
}

describe('Commercial executive reporting repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedHappyPath();
  });

  it('aggregates CEO metrics from real tenant commercial data and filters test records', async () => {
    const dashboard = await getExecutiveDashboard('tenant-a', { revenueLineType: 'online_course' });

    expect(prismaMocks.commercialPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenant_key: 'tenant-a',
        revenue_line: { revenue_line_type: 'online_course' },
      }),
    }));
    expect(dashboard.metrics).toMatchObject({
      plannedRevenueTarget: 30000,
      plannedBudget: 5000,
      knownSpend: 3500,
      knownRevenue: 12000,
      leads: 60,
      purchases: 8,
      meetingsBooked: 20,
      meetingsAttended: 15,
      noShows: 5,
      costPerLead: 58.33,
      costPerPurchase: 437.5,
      leadToPurchaseRate: 13.33,
    });
    expect(dashboard.channelPerformance).toHaveLength(1);
    expect(dashboard.channelPerformance[0]).toMatchObject({ channel: 'meta', spend: 3500, leads: 60, purchases: 8 });
    expect(dashboard.revenueLines[0]).toMatchObject({ type: 'online_course', knownRevenue: 12000, knownSpend: 3500 });
    expect(dashboard.confidence).toBe('high');
    expect(dashboard.missingSources).not.toContain('No KPI records from manual import or connectors are available.');
    expect(dashboard.alerts.some(alert => alert.code === 'high_no_show_rate')).toBe(true);
    expect(JSON.stringify(dashboard)).not.toContain('999999');
  });

  it('returns honest missing-source states without fake metrics', async () => {
    prismaMocks.commercialRevenueLine.findMany.mockResolvedValue([]);
    prismaMocks.commercialPlan.findMany.mockResolvedValue([]);
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([]);
    prismaMocks.commercialDisciplineRecord.findMany.mockResolvedValue([]);
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([]);

    const dashboard = await getExecutiveDashboard('tenant-a', {});

    expect(dashboard.metrics.knownRevenue).toBe(0);
    expect(dashboard.metrics.knownSpend).toBe(0);
    expect(dashboard.confidence).toBe('low');
    expect(dashboard.missingSources).toEqual(expect.arrayContaining([
      'No commercial plans exist for the selected filters.',
      'No KPI records from manual import or connectors are available.',
      'No lead or purchase records are available from CRM or lead capture.',
    ]));
    expect(dashboard.alerts[0]).toMatchObject({ code: 'missing_sources', severity: 'watch' });
  });

  it('persists report previews with metrics, alerts, missing sources and no external send', async () => {
    prismaMocks.commercialExecutiveReport.create.mockImplementation(async ({ data }) => ({
      id: 'report-1',
      cadence: data.cadence,
      period_start: data.period_start,
      period_end: data.period_end,
      timezone: data.timezone,
      status: data.status,
      title: data.title,
      summary: data.summary,
      metrics: data.metrics,
      alerts: data.alerts,
      missing_sources: data.missing_sources,
      confidence: data.confidence,
      created_at: now,
    }));

    const report = await createReportPreview('tenant-a', 'user-1', {
      cadence: 'weekly',
      title: 'Weekly CEO preview',
    });

    expect(prismaMocks.commercialExecutiveReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_key: 'tenant-a',
        status: 'preview',
        title: 'Weekly CEO preview',
        generated_by_user_id: 'user-1',
      }),
    }));
    expect(report).toMatchObject({
      id: 'report-1',
      cadence: 'weekly',
      status: 'preview',
      title: 'Weekly CEO preview',
      confidence: 'high',
    });
  });
});
