import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(5),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Master Event Aggregation empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns honest zero totals when no events match filter', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);

    const result = await repo.getMasterDashboard('tenant-a', { eventType: 'virtual_event' });

    expect(result.filteredEvents).toBe(0);
    expect(result.totalEvents).toBe(5);
    expect(result.totals.totalLeads).toBe(0);
    expect(result.totals.formCompletions).toBe(0);
    expect(result.totals.meetingsBooked).toBe(0);
    expect(result.totals.meetingsAttended).toBe(0);
    expect(result.totals.noShows).toBe(0);
    expect(result.totals.noShowRate).toBe(0);
    expect(result.totals.purchases).toBe(0);
    expect(result.totals.revenue).toBe(0);
    expect(result.totals.revenueTarget).toBe(0);
    expect(result.totals.plannedBudget).toBe(0);
    expect(result.totals.actualSpend).toBe(0);
    expect(result.totals.costPerLead).toBe(0);
  });

  it('returns empty best performing when no data', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);

    const result = await repo.getMasterDashboard('tenant-a', {});

    expect(result.bestPerforming.bestChannel).toBeNull();
    expect(result.bestPerforming.bestAudienceSource).toBeNull();
    expect(result.bestPerforming.highestRevenueEvent).toBeNull();
    expect(result.bestPerforming.lowestCostPerLeadEvent).toBeNull();
  });

  it('returns empty aggregation maps when no data', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);

    const result = await repo.getMasterDashboard('tenant-a', {});

    expect(Object.keys(result.byEventType)).toHaveLength(0);
    expect(Object.keys(result.byStatus)).toHaveLength(0);
    expect(Object.keys(result.byGeography)).toHaveLength(0);
    expect(Object.keys(result.byChannel)).toHaveLength(0);
    expect(Object.keys(result.byAudienceSource)).toHaveLength(0);
  });

  it('returns zero noShowRate when no meetings booked', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Event A',
        event_type: 'tagyeer_wa_irtaqi',
        event_date: new Date(),
        status: 'active',
        geography: null,
        revenue_target: null,
        planned_budget: null,
        owner: null,
        leads: [{ lead_status: 'new_lead', lead_temperature: 'cold', audience_source: null, channel_attribution: null, purchase_amount: null, purchase_date: null }],
        kpi_records: [],
      },
    ]);

    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.totals.noShowRate).toBe(0);
  });

  it('events with no geography show as unknown', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Event A',
        event_type: 'virtual_event',
        event_date: new Date(),
        status: 'active',
        geography: null,
        revenue_target: null,
        planned_budget: null,
        owner: null,
        leads: [],
        kpi_records: [],
      },
    ]);

    const result = await repo.getMasterDashboard('tenant-a', {});
    expect(result.byGeography['unknown']).toBeDefined();
    expect(result.byGeography['unknown'].events).toBe(1);
  });
});
