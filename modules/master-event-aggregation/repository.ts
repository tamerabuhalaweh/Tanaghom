import { prisma } from '@shared/database';
import { Prisma } from '@prisma/client';
import type { MasterDashboardFilters, MasterDashboardSummary, EventComparisonRow } from './types';

export async function getMasterDashboard(
  tenantKey: string,
  filters: MasterDashboardFilters,
): Promise<MasterDashboardSummary> {
  const where: Prisma.CommercialEventWhereInput = { tenant_key: tenantKey };

  if (filters.eventType) where.event_type = filters.eventType as Prisma.EnumCommercialEventTypeFilter;
  if (filters.eventStatus) where.status = filters.eventStatus as Prisma.EnumCommercialEventStatusFilter;
  if (filters.geography) where.geography = { contains: filters.geography, mode: 'insensitive' };
  if (filters.ownerUserId) where.owner_user_id = filters.ownerUserId;

  if (filters.dateFrom || filters.dateTo) {
    where.event_date = {};
    if (filters.dateFrom) where.event_date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.event_date.lte = new Date(filters.dateTo);
  }

  const events = await prisma.commercialEvent.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      leads: {
        select: {
          id: true,
          lead_status: true,
          lead_temperature: true,
          audience_source: true,
          channel_attribution: true,
          purchase_amount: true,
          purchase_date: true,
        },
      },
      kpi_records: {
        select: {
          source_type: true,
          source_name: true,
          reach: true,
          impressions: true,
          interactions: true,
          clicks: true,
          form_completions: true,
          leads: true,
          meetings_booked: true,
          meetings_attended: true,
          purchases: true,
          no_shows: true,
          spend: true,
          channel: true,
        },
      },
      connector_imports: {
        select: {
          sync_status: true,
          last_sync_at: true,
          last_sync_rows: true,
          last_sync_error: true,
        },
      },
    },
    orderBy: { event_date: 'desc' },
  });

  const totalEvents = await prisma.commercialEvent.count({ where: { tenant_key: tenantKey } });

  const eventRows: EventComparisonRow[] = [];
  let totalLeads = 0;
  let totalFormCompletions = 0;
  let totalMeetingsBooked = 0;
  let totalMeetingsAttended = 0;
  let totalNoShows = 0;
  let totalPurchases = 0;
  let totalRevenue = 0;
  let totalRevenueTarget = 0;
  let totalPlannedBudget = 0;
  let totalActualSpend = 0;

  const byType: Record<string, { events: number; leads: number; purchases: number; revenue: number }> = {};
  const byStatus: Record<string, number> = {};
  const byGeo: Record<string, { events: number; leads: number; revenue: number }> = {};
  const byChannel: Record<string, { leads: number; purchases: number; spend: number }> = {};
  const byAudience: Record<string, { leads: number; purchases: number }> = {};

  let bestChannel: string | null = null;
  let bestChannelLeads = 0;
  let bestAudience: string | null = null;
  let bestAudienceLeads = 0;
  let highestRevenueEvent: { eventId: string; eventName: string; revenue: number } | null = null;
  let lowestCplEvent: { eventId: string; eventName: string; costPerLead: number } | null = null;
  const dataSourceSummary = {
    manualRecords: 0,
    importedRecords: 0,
    connectorRecords: 0,
    eventsUsingConnectorData: 0,
    eventsUsingImportedData: 0,
    eventsUsingManualFallback: 0,
    readyConnectorJobs: 0,
    syncedConnectorJobs: 0,
    failedConnectorJobs: 0,
    blockedConnectorJobs: 0,
    connectorRowsImported: 0,
    lastConnectorSyncAt: null as Date | null,
  };

  for (const event of events) {
    const kpiAgg = aggregateKpis(event.kpi_records);
    const leadAgg = aggregateLeads(event.leads);
    const eventSourceSummary = summarizeEventSources(event.kpi_records, event.connector_imports || []);
    const eventChannelStats = mergeStats(leadAgg.channelStats, kpiAgg.channelStats);
    const eventAudienceStats = leadAgg.audienceStats;

    const eventLeads = leadAgg.totalLeads + kpiAgg.leads;
    const eventFormCompletions = kpiAgg.formCompletions;
    const eventMeetingsBooked = leadAgg.meetingsBooked + kpiAgg.meetingsBooked;
    const eventMeetingsAttended = leadAgg.meetingsAttended + kpiAgg.meetingsAttended;
    const eventNoShows = leadAgg.noShows + kpiAgg.noShows;
    const eventPurchases = leadAgg.purchases + kpiAgg.purchases;
    const eventRevenue = leadAgg.revenue;
    const eventSpend = kpiAgg.spend;

    const noShowRate = eventMeetingsBooked > 0 ? eventNoShows / eventMeetingsBooked : 0;
    const costPerLead = eventLeads > 0 ? eventSpend / eventLeads : 0;
    const revenueTarget = event.revenue_target ? Number(event.revenue_target) : 0;
    const plannedBudget = event.planned_budget ? Number(event.planned_budget) : 0;

    const owner = event.owner as { name: string } | null;

    eventRows.push({
      eventId: event.id,
      eventName: event.name,
      eventType: event.event_type,
      eventDate: event.event_date,
      status: event.status,
      geography: event.geography,
      ownerName: owner?.name || null,
      totalLeads: eventLeads,
      formCompletions: eventFormCompletions,
      meetingsBooked: eventMeetingsBooked,
      meetingsAttended: eventMeetingsAttended,
      noShows: eventNoShows,
      noShowRate,
      purchases: eventPurchases,
      revenue: eventRevenue,
      revenueTarget: revenueTarget || null,
      plannedBudget: plannedBudget || null,
      actualSpend: eventSpend,
      costPerLead,
      bestChannel: findBestByLeads(eventChannelStats),
      bestAudienceSource: findBestByLeads(eventAudienceStats),
      primaryDataSource: eventSourceSummary.primarySource,
      manualFallbackActive: eventSourceSummary.manualFallbackActive,
      lastConnectorSyncAt: eventSourceSummary.lastConnectorSyncAt,
      connectorRowsImported: eventSourceSummary.connectorRowsImported,
    });

    dataSourceSummary.manualRecords += eventSourceSummary.manualRecords;
    dataSourceSummary.importedRecords += eventSourceSummary.importedRecords;
    dataSourceSummary.connectorRecords += eventSourceSummary.connectorRecords;
    dataSourceSummary.readyConnectorJobs += eventSourceSummary.readyConnectorJobs;
    dataSourceSummary.syncedConnectorJobs += eventSourceSummary.syncedConnectorJobs;
    dataSourceSummary.failedConnectorJobs += eventSourceSummary.failedConnectorJobs;
    dataSourceSummary.blockedConnectorJobs += eventSourceSummary.blockedConnectorJobs;
    dataSourceSummary.connectorRowsImported += eventSourceSummary.connectorRowsImported;
    if (eventSourceSummary.primarySource === 'connector') dataSourceSummary.eventsUsingConnectorData++;
    else if (eventSourceSummary.primarySource === 'imported') dataSourceSummary.eventsUsingImportedData++;
    if (eventSourceSummary.manualFallbackActive) dataSourceSummary.eventsUsingManualFallback++;
    if (eventSourceSummary.lastConnectorSyncAt && (!dataSourceSummary.lastConnectorSyncAt || eventSourceSummary.lastConnectorSyncAt > dataSourceSummary.lastConnectorSyncAt)) {
      dataSourceSummary.lastConnectorSyncAt = eventSourceSummary.lastConnectorSyncAt;
    }

    totalLeads += eventLeads;
    totalFormCompletions += eventFormCompletions;
    totalMeetingsBooked += eventMeetingsBooked;
    totalMeetingsAttended += eventMeetingsAttended;
    totalNoShows += eventNoShows;
    totalPurchases += eventPurchases;
    totalRevenue += eventRevenue;
    totalRevenueTarget += revenueTarget;
    totalPlannedBudget += plannedBudget;
    totalActualSpend += eventSpend;

    byType[event.event_type] = byType[event.event_type] || { events: 0, leads: 0, purchases: 0, revenue: 0 };
    byType[event.event_type].events++;
    byType[event.event_type].leads += eventLeads;
    byType[event.event_type].purchases += eventPurchases;
    byType[event.event_type].revenue += eventRevenue;

    byStatus[event.status] = (byStatus[event.status] || 0) + 1;

    const geoKey = event.geography || 'unknown';
    byGeo[geoKey] = byGeo[geoKey] || { events: 0, leads: 0, revenue: 0 };
    byGeo[geoKey].events++;
    byGeo[geoKey].leads += eventLeads;
    byGeo[geoKey].revenue += eventRevenue;

    for (const [ch, stats] of Object.entries(eventChannelStats)) {
      byChannel[ch] = byChannel[ch] || { leads: 0, purchases: 0, spend: 0 };
      byChannel[ch].leads += stats.leads;
      byChannel[ch].purchases += stats.purchases;
      byChannel[ch].spend += stats.spend;
    }
    for (const [src, stats] of Object.entries(eventAudienceStats)) {
      byAudience[src] = byAudience[src] || { leads: 0, purchases: 0 };
      byAudience[src].leads += stats.leads;
      byAudience[src].purchases += stats.purchases;
    }

    if (eventRevenue > 0 && (!highestRevenueEvent || eventRevenue > highestRevenueEvent.revenue)) {
      highestRevenueEvent = { eventId: event.id, eventName: event.name, revenue: eventRevenue };
    }
    if (costPerLead > 0 && eventLeads >= 3 && (!lowestCplEvent || costPerLead < lowestCplEvent.costPerLead)) {
      lowestCplEvent = { eventId: event.id, eventName: event.name, costPerLead };
    }
  }

  const totalNoShowRate = totalMeetingsBooked > 0 ? totalNoShows / totalMeetingsBooked : 0;
  const totalCostPerLead = totalLeads > 0 ? totalActualSpend / totalLeads : 0;

  for (const [ch, data] of Object.entries(byChannel)) {
    if (data.leads > bestChannelLeads) {
      bestChannelLeads = data.leads;
      bestChannel = ch;
    }
  }
  for (const [src, data] of Object.entries(byAudience)) {
    if (data.leads > bestAudienceLeads) {
      bestAudienceLeads = data.leads;
      bestAudience = src;
    }
  }

  return {
    totalEvents,
    filteredEvents: events.length,
    totals: {
      totalLeads,
      formCompletions: totalFormCompletions,
      meetingsBooked: totalMeetingsBooked,
      meetingsAttended: totalMeetingsAttended,
      noShows: totalNoShows,
      noShowRate: totalNoShowRate,
      purchases: totalPurchases,
      revenue: totalRevenue,
      revenueTarget: totalRevenueTarget,
      plannedBudget: totalPlannedBudget,
      actualSpend: totalActualSpend,
      costPerLead: totalCostPerLead,
    },
    byEventType: byType,
    byStatus,
    byGeography: byGeo,
    byChannel,
    byAudienceSource: byAudience,
    bestPerforming: {
      bestChannel,
      bestAudienceSource: bestAudience,
      highestRevenueEvent,
      lowestCostPerLeadEvent: lowestCplEvent,
    },
    dataSourceSummary,
    events: eventRows,
  };
}

interface KpiRecord {
  source_type?: string | null;
  source_name?: string | null;
  reach: number | null;
  impressions: number | null;
  interactions: number | null;
  clicks: number | null;
  form_completions: number | null;
  leads: number | null;
  meetings_booked: number | null;
  meetings_attended: number | null;
  purchases: number | null;
  no_shows: number | null;
  spend: number | { toNumber(): number } | null;
  channel: string;
}

interface ConnectorJobRecord {
  sync_status: string | null;
  last_sync_at: Date | null;
  last_sync_rows: number | null;
  last_sync_error: string | null;
}

interface AggregationStats {
  leads: number;
  purchases: number;
  spend: number;
}

interface LeadRecord {
  lead_status: string;
  lead_temperature: string;
  audience_source: string | null;
  channel_attribution: string | null;
  purchase_amount: number | { toNumber(): number } | null;
  purchase_date: Date | null;
}

function aggregateKpis(records: KpiRecord[]) {
  let formCompletions = 0;
  let leads = 0;
  let meetingsBooked = 0;
  let meetingsAttended = 0;
  let purchases = 0;
  let noShows = 0;
  let spend = 0;
  const channelStats: Record<string, AggregationStats> = {};

  for (const r of records) {
    const recordLeads = r.leads || 0;
    const recordPurchases = r.purchases || 0;
    const recordSpend = r.spend ? (typeof r.spend === 'number' ? r.spend : r.spend.toNumber()) : 0;

    formCompletions += r.form_completions || 0;
    leads += recordLeads;
    meetingsBooked += r.meetings_booked || 0;
    meetingsAttended += r.meetings_attended || 0;
    purchases += recordPurchases;
    noShows += r.no_shows || 0;
    spend += recordSpend;

    const channel = r.channel || 'unknown';
    channelStats[channel] = channelStats[channel] || { leads: 0, purchases: 0, spend: 0 };
    channelStats[channel].leads += recordLeads;
    channelStats[channel].purchases += recordPurchases;
    channelStats[channel].spend += recordSpend;
  }

  return { formCompletions, leads, meetingsBooked, meetingsAttended, purchases, noShows, spend, channelStats };
}

function aggregateLeads(records: LeadRecord[]) {
  const totalLeads = records.length;
  let meetingsBooked = 0;
  let meetingsAttended = 0;
  let noShows = 0;
  let purchases = 0;
  let revenue = 0;
  const channelStats: Record<string, AggregationStats> = {};
  const audienceStats: Record<string, AggregationStats> = {};

  for (const r of records) {
    const isPurchase = r.lead_status === 'purchased' || Boolean(r.purchase_date);
    if (r.lead_status === 'meeting_booked') meetingsBooked++;
    if (r.lead_status === 'meeting_attended') meetingsAttended++;
    if (r.lead_status === 'no_show') noShows++;
    if (isPurchase) {
      purchases++;
      revenue += r.purchase_amount ? (typeof r.purchase_amount === 'number' ? r.purchase_amount : r.purchase_amount.toNumber()) : 0;
    }
    if (r.channel_attribution) {
      channelStats[r.channel_attribution] = channelStats[r.channel_attribution] || { leads: 0, purchases: 0, spend: 0 };
      channelStats[r.channel_attribution].leads++;
      if (isPurchase) channelStats[r.channel_attribution].purchases++;
    }
    if (r.audience_source) {
      audienceStats[r.audience_source] = audienceStats[r.audience_source] || { leads: 0, purchases: 0, spend: 0 };
      audienceStats[r.audience_source].leads++;
      if (isPurchase) audienceStats[r.audience_source].purchases++;
    }
  }

  return { totalLeads, meetingsBooked, meetingsAttended, noShows, purchases, revenue, channelStats, audienceStats };
}

function summarizeEventSources(kpiRecords: KpiRecord[], connectorJobs: ConnectorJobRecord[]) {
  const manualRecords = kpiRecords.filter(record => (record.source_type || 'manual') === 'manual').length;
  const importedRecords = kpiRecords.filter(record => record.source_type === 'imported' || record.source_name === 'csv_manual').length;
  const connectorRecords = kpiRecords.filter(record => record.source_type === 'connector' && record.source_name !== 'csv_manual').length;
  const primarySource: 'connector' | 'imported' | 'manual' | 'none' = connectorRecords > 0
    ? 'connector'
    : importedRecords > 0
      ? 'imported'
      : manualRecords > 0
        ? 'manual'
        : 'none';
  const lastConnectorSyncAt = connectorJobs.reduce<Date | null>((latest, job) => {
    if (!job.last_sync_at) return latest;
    if (!latest || job.last_sync_at > latest) return job.last_sync_at;
    return latest;
  }, null);

  return {
    manualRecords,
    importedRecords,
    connectorRecords,
    primarySource,
    manualFallbackActive: primarySource === 'manual' || (manualRecords > 0 && connectorRecords === 0),
    readyConnectorJobs: connectorJobs.filter(job => job.sync_status === 'ready_for_sync').length,
    syncedConnectorJobs: connectorJobs.filter(job => job.sync_status === 'synced').length,
    failedConnectorJobs: connectorJobs.filter(job => job.sync_status === 'failed').length,
    blockedConnectorJobs: connectorJobs.filter(job => job.sync_status === 'blocked').length,
    connectorRowsImported: connectorJobs.reduce((sum, job) => sum + Number(job.last_sync_rows || 0), 0),
    lastConnectorSyncAt,
  };
}

function mergeStats(...sources: Array<Record<string, AggregationStats>>): Record<string, AggregationStats> {
  const result: Record<string, AggregationStats> = {};
  for (const source of sources) {
    for (const [key, stats] of Object.entries(source)) {
      result[key] = result[key] || { leads: 0, purchases: 0, spend: 0 };
      result[key].leads += stats.leads;
      result[key].purchases += stats.purchases;
      result[key].spend += stats.spend;
    }
  }
  return result;
}

function findBestByLeads(statsByKey: Record<string, AggregationStats>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, stats] of Object.entries(statsByKey)) {
    if (stats.leads > bestCount) {
      bestCount = stats.leads;
      best = key;
    }
  }
  return best;
}
