import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn() },
  eventKpiRecord: { findMany: vi.fn() },
  leadCaptureRecord: { findMany: vi.fn() },
  eventProblem: { findMany: vi.fn() },
  contentRequest: { findMany: vi.fn() },
  publishingPackage: { findMany: vi.fn() },
  eventEmailPlan: { findMany: vi.fn() },
  eventWhatsappPlan: { findMany: vi.fn() },
  eventUpsellPlan: { findMany: vi.fn() },
  eventContentRequirement: { findMany: vi.fn() },
  eventSalesTask: { findMany: vi.fn() },
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

describe('Closeout Report', () => {
  beforeEach(() => { resetAllMocks(); });

  it('throws NotFoundError when event does not exist', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.generateCloseoutReport('tenant-a', 'nonexistent')).rejects.toThrow();
  });

  it('returns event summary from real event data', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Tagyeer wa Irtaqi',
      event_type: 'tagyeer_wa_irtaqi', event_date: new Date('2026-08-15'),
      location: 'Riyadh', status: 'active', geography: 'Riyadh',
      expected_attendance: 200, revenue_target: 120000, planned_budget: 35000,
      campaign_start_date: new Date('2026-07-01'), campaign_end_date: new Date('2026-08-15'),
      owner: { name: 'Amro' }, created_at: new Date('2026-06-01'),
    });
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.event.eventName).toBe('Tagyeer wa Irtaqi');
    expect(report.event.eventType).toBe('tagyeer_wa_irtaqi');
    expect(report.event.ownerName).toBe('Amro');
    expect(report.event.revenueTarget).toBe(120000);
    expect(report.event.plannedBudget).toBe(35000);
  });

  it('aggregates lead funnel correctly', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: 'follower', channel_attribution: 'instagram', purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: 'Ahmed', created_at: new Date() },
      { id: 'l2', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: 'referral', channel_attribution: 'email', purchase_amount: 1500, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: 'Fatima', created_at: new Date() },
      { id: 'l3', lead_status: 'new_lead', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: new Date(), meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
    ]);
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.leadFunnel.totalLeads).toBe(3);
    expect(report.leadFunnel.byStatus.meeting_booked).toBe(1);
    expect(report.leadFunnel.byStatus.purchased).toBe(1);
    expect(report.leadFunnel.byTemperature.hot).toBe(1);
  });

  it('aggregates sales outcomes correctly', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      { id: 'l1', lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: new Date(), meeting_type: 'call', lead_name_placeholder: null, created_at: new Date() },
      { id: 'l2', lead_status: 'no_show', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null, follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
      { id: 'l3', lead_status: 'purchased', lead_temperature: 'buyer', audience_source: null, channel_attribution: null, purchase_amount: 2000, purchase_date: new Date(), follow_up_date: null, meeting_date: null, meeting_type: null, lead_name_placeholder: null, created_at: new Date() },
    ]);
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.salesOutcomes.meetingsBooked).toBe(1);
    expect(report.salesOutcomes.noShows).toBe(1);
    expect(report.salesOutcomes.purchases).toBe(1);
    expect(report.salesOutcomes.revenue).toBe(2000);
  });

  it('includes top event problems/barriers', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    prismaMocks.eventProblem.findMany.mockResolvedValue([
      { id: 'p1', title: 'Critical issue', severity: 'critical', category: 'ads', status: 'open', owner_role: 'marketing_manager', due_date: null },
    ]);
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.topBarriers).toHaveLength(1);
    expect(report.topBarriers[0].severity).toBe('critical');
  });

  it('produces honest empty states when no data', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Empty Event', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'draft', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: null,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.leadFunnel.totalLeads).toBe(0);
    expect(report.salesOutcomes.purchases).toBe(0);
    expect(report.topBarriers).toHaveLength(0);
    expect(report.campaigns).toHaveLength(0);
    expect(report.dataCompleteness.missingSections).toContain('leads');
    expect(report.dataCompleteness.missingSections).toContain('kpi_records');
    expect(report.dataCompleteness.hasLeads).toBe(false);
  });

  it('budget section uses kpi spend when available', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1', tenant_key: 'tenant-a', name: 'Test', event_type: 'virtual_event',
      event_date: new Date(), location: null, status: 'active', geography: null,
      expected_attendance: null, revenue_target: null, planned_budget: 30000,
      campaign_start_date: null, campaign_end_date: null, owner: null, created_at: new Date(),
    });
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([{ spend: 5000, channel: 'instagram' }, { spend: 3000, channel: 'email' }]);
    const report = await repo.generateCloseoutReport('tenant-a', 'event-1');
    expect(report.budget.plannedBudget).toBe(30000);
    expect(report.budget.knownSpend).toBe(8000);
    expect(report.budget.budgetVariance).toBe(22000);
  });
});
