import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Master Event Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty dashboard when no events exist', async () => {
    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.totalEvents).toBe(0);
    expect(result.filteredEvents).toBe(0);
    expect(result.totals.totalLeads).toBe(0);
    expect(result.totals.purchases).toBe(0);
    expect(result.totals.revenue).toBe(0);
    expect(result.events).toHaveLength(0);
  });

  it('applies tenant scoping', async () => {
    await repo.getMasterDashboard('tenant-a', {});
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_key: 'tenant-a' }),
      }),
    );
  });

  it('applies event type filter', async () => {
    await repo.getMasterDashboard('tenant-a', { eventType: 'tagyeer_wa_irtaqi' });
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ event_type: 'tagyeer_wa_irtaqi' }),
      }),
    );
  });

  it('applies event status filter', async () => {
    await repo.getMasterDashboard('tenant-a', { eventStatus: 'active' });
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('applies geography filter', async () => {
    await repo.getMasterDashboard('tenant-a', { geography: 'Riyadh' });
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ geography: { contains: 'Riyadh', mode: 'insensitive' } }),
      }),
    );
  });

  it('applies date range filter', async () => {
    await repo.getMasterDashboard('tenant-a', { dateFrom: '2026-01-01T00:00:00Z', dateTo: '2026-12-31T23:59:59Z' });
    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_date: {
            gte: new Date('2026-01-01T00:00:00Z'),
            lte: new Date('2026-12-31T23:59:59Z'),
          },
        }),
      }),
    );
  });

  it('calculates correct totals from events with leads and kpis', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Tagyeer wa Irtaqi',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: new Date('2026-08-15'),
        status: 'active',
        geography: 'Riyadh',
        revenue_target: 100000,
        planned_budget: 30000,
        owner: { name: 'Amro' },
        leads: [
          { lead_status: 'meeting_booked', lead_temperature: 'hot', audience_source: 'follower', channel_attribution: 'instagram', purchase_amount: null, purchase_date: null },
          { lead_status: 'purchased', lead_temperature: 'buyer', audience_source: 'referral', channel_attribution: 'email', purchase_amount: 1500, purchase_date: new Date() },
          { lead_status: 'no_show', lead_temperature: 'cold', audience_source: 'non_follower', channel_attribution: 'whatsapp', purchase_amount: null, purchase_date: null },
        ],
        kpi_records: [
          { source_type: 'connector', source_name: 'meta_analytics', form_completions: 10, leads: 5, meetings_booked: 3, meetings_attended: 2, purchases: 1, no_shows: 1, spend: 5000, reach: 10000, impressions: 20000, interactions: 500, clicks: 200, channel: 'instagram' },
        ],
        connector_imports: [
          { sync_status: 'synced', last_sync_at: new Date('2026-07-02T10:00:00Z'), last_sync_rows: 1, last_sync_error: null },
        ],
      },
    ]);
    prismaMocks.commercialEvent.count.mockResolvedValue(1);

    const result = await repo.getMasterDashboard('tenant-a', {});

    expect(result.totalEvents).toBe(1);
    expect(result.filteredEvents).toBe(1);
    expect(result.totals.totalLeads).toBe(8); // 3 leads + 5 kpi leads
    expect(result.totals.purchases).toBe(2); // 1 lead + 1 kpi
    expect(result.totals.revenue).toBe(1500);
    expect(result.totals.formCompletions).toBe(10);
    expect(result.totals.meetingsBooked).toBe(4); // 1 + 3
    expect(result.totals.noShows).toBe(2); // 1 + 1
    expect(result.totals.actualSpend).toBe(5000);
    expect(result.totals.noShowRate).toBeCloseTo(0.5); // 2/4
    expect(result.totals.costPerLead).toBeCloseTo(625); // 5000/8
    expect(result.byChannel.instagram).toEqual({ leads: 6, purchases: 1, spend: 5000 });
    expect(result.byChannel.email).toEqual({ leads: 1, purchases: 1, spend: 0 });
    expect(result.byChannel.whatsapp).toEqual({ leads: 1, purchases: 0, spend: 0 });
    expect(result.byAudienceSource.referral).toEqual({ leads: 1, purchases: 1 });
    expect(result.dataSourceSummary.connectorRecords).toBe(1);
    expect(result.dataSourceSummary.eventsUsingConnectorData).toBe(1);
    expect(result.dataSourceSummary.syncedConnectorJobs).toBe(1);
    expect(result.events[0].primaryDataSource).toBe('connector');
  });

  it('populates event comparison rows correctly', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Event A',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: new Date('2026-08-15'),
        status: 'completed',
        geography: 'Riyadh',
        revenue_target: 50000,
        planned_budget: 20000,
        owner: { name: 'Amro' },
        leads: [
          { lead_status: 'purchased', lead_temperature: 'buyer', audience_source: 'follower', channel_attribution: 'instagram', purchase_amount: 2000, purchase_date: new Date() },
        ],
        kpi_records: [],
      },
    ]);

    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe('event-1');
    expect(result.events[0].eventName).toBe('Event A');
    expect(result.events[0].totalLeads).toBe(1);
    expect(result.events[0].revenue).toBe(2000);
    expect(result.events[0].bestChannel).toBe('instagram');
  });

  it('identifies best performing channel and audience', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Event A',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: new Date('2026-08-15'),
        status: 'active',
        geography: 'Riyadh',
        revenue_target: null,
        planned_budget: null,
        owner: null,
        leads: [
          { lead_status: 'new_lead', lead_temperature: 'cold', audience_source: 'follower', channel_attribution: 'instagram', purchase_amount: null, purchase_date: null },
          { lead_status: 'new_lead', lead_temperature: 'cold', audience_source: 'follower', channel_attribution: 'instagram', purchase_amount: null, purchase_date: null },
          { lead_status: 'new_lead', lead_temperature: 'warm', audience_source: 'referral', channel_attribution: 'email', purchase_amount: null, purchase_date: null },
        ],
        kpi_records: [],
      },
    ]);

    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.bestPerforming.bestChannel).toBe('instagram');
    expect(result.bestPerforming.bestAudienceSource).toBe('follower');
  });
});
