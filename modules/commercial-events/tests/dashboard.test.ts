import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    findFirst: vi.fn(),
  },
  eventKpiRecord: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  contentRequest: {
    findMany: vi.fn(),
  },
  leadCaptureRecord: {
    findMany: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as eventRepo from '../repository';

const baseEvent = {
  id: '550e8400-e29b-41d4-a716-446655440100',
  tenant_key: 'tenant-a',
  name: 'Tagyeer wa Irtaqi - Summer 2026',
  event_type: 'tagyeer_wa_irtaqi',
  event_date: new Date('2026-08-15T18:00:00Z'),
  location: 'Riyadh',
  campaign_start_date: new Date('2026-07-16T18:00:00Z'),
  campaign_end_date: new Date('2026-08-15T17:00:00Z'),
  expected_attendance: 200,
  revenue_target: 120000,
  planned_budget: 35000,
  owner_user_id: '550e8400-e29b-41d4-a716-446655440001',
  status: 'planning',
  offer: 'Early bird course seat offer',
  audience: 'Course buyers in Riyadh',
  geography: 'Riyadh',
  fomo_angle: 'Limited seats',
  upsell_plan: 'VIP coaching package',
  selected_channels: ['instagram', 'whatsapp', 'email'],
  content_department_requirements: 'Reels and landing page',
  sales_team_requirements: 'Follow up hot leads',
  created_at: new Date('2026-07-01T00:00:00Z'),
  updated_at: new Date('2026-07-01T00:00:00Z'),
  owner: { name: 'Amro' },
  campaigns: [{ id: 'campaign-1' }],
  leads: [{ id: 'lead-1' }, { id: 'lead-2' }],
};

function kpi(overrides: Record<string, unknown>) {
  return {
    id: 'kpi-1',
    tenant_key: 'tenant-a',
    event_id: baseEvent.id,
    source_type: 'manual',
    source_name: 'manual',
    metric_date: new Date('2026-07-02T12:00:00Z'),
    channel: 'instagram',
    reach: 10000,
    impressions: 15000,
    interactions: 900,
    clicks: 250,
    form_completions: 80,
    leads: 55,
    meetings_booked: 18,
    meetings_attended: 14,
    purchases: 7,
    no_shows: 4,
    spend: 2200,
    notes: null,
    created_by_user_id: 'user-1',
    updated_by_user_id: null,
    created_at: new Date('2026-07-02T12:01:00Z'),
    updated_at: new Date('2026-07-02T12:01:00Z'),
    ...overrides,
  };
}

describe('Commercial Events dashboard and KPI records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(baseEvent);
    prismaMocks.contentRequest.findMany.mockResolvedValue([
      {
        id: 'campaign-1',
        raw_message: 'Course launch waitlist',
        objective: 'Sell event seats',
        status: 'idea',
        target_platforms: ['instagram', 'linkedin'],
        created_at: new Date('2026-07-01T00:00:00Z'),
      },
    ]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      {
        id: 'lead-1',
        lead_status: 'qualified',
        platform: 'instagram',
        lead_name_placeholder: 'Prospect One',
        lead_email_placeholder: 'one@example.com',
        created_at: new Date('2026-07-02T12:00:00Z'),
      },
      {
        id: 'lead-2',
        lead_status: 'new_lead',
        platform: 'manual',
        lead_name_placeholder: 'Prospect Two',
        lead_email_placeholder: null,
        created_at: new Date('2026-07-02T13:00:00Z'),
      },
    ]);
  });

  it('creates tenant-scoped KPI records tied to the event', async () => {
    prismaMocks.eventKpiRecord.create.mockResolvedValue(kpi({ id: 'kpi-created', leads: 12 }));

    await eventRepo.createKpiRecord('tenant-a', baseEvent.id, 'user-1', {
      metricDate: '2026-07-02T12:00:00Z',
      channel: 'instagram',
      leads: 12,
    });

    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith({
      where: { id: baseEvent.id, tenant_key: 'tenant-a' },
      select: { id: true },
    });
    expect(prismaMocks.eventKpiRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_key: 'tenant-a',
        event_id: baseEvent.id,
        created_by_user_id: 'user-1',
        leads: 12,
      }),
    }));
  });

  it('aggregates event dashboard metrics from KPI records and linked leads', async () => {
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
      kpi({ id: 'kpi-1', channel: 'instagram' }),
      kpi({ id: 'kpi-2', channel: 'whatsapp', reach: 5000, impressions: 7000, interactions: 500, leads: 20, purchases: 3, spend: 800 }),
    ]);

    const dashboard = await eventRepo.getEventDashboard('tenant-a', baseEvent.id);

    expect(dashboard.event.name).toBe('Tagyeer wa Irtaqi - Summer 2026');
    expect(dashboard.kpis.reach).toBe(15000);
    expect(dashboard.kpis.interactions).toBe(1400);
    expect(dashboard.kpis.reportedLeads).toBe(75);
    expect(dashboard.kpis.newLeads).toBe(75);
    expect(dashboard.kpis.purchases).toBe(10);
    expect(dashboard.kpis.actualSpend).toBe(3000);
    expect(dashboard.kpis.budgetVariance).toBe(32000);
    expect(dashboard.kpis.interactionRate).toBe(6.4);
    expect(dashboard.channelPerformance).toHaveLength(2);
    expect(dashboard.leadTemperature.find(item => item.label === 'Hot')?.value).toBe(1);
  });

  it('keeps event dashboard queries scoped to tenant and event', async () => {
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([]);

    await eventRepo.getEventDashboard('tenant-a', baseEvent.id);

    expect(prismaMocks.eventKpiRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: baseEvent.id },
    }));
    expect(prismaMocks.contentRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: baseEvent.id },
    }));
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: baseEvent.id },
    }));
  });
});
