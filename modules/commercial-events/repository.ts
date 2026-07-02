import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateEventInput,
  UpdateEventInput,
  UpdateStrategyInput,
  CreateKpiRecordInput,
  UpdateKpiRecordInput,
  CommercialEventSummary,
  CommercialEventStatus,
  EventDashboardSummary,
  EventKpiRecordSummary,
} from './types';

export async function listEvents(
  tenantKey: string,
  status?: CommercialEventStatus,
  eventType?: string,
): Promise<CommercialEventSummary[]> {
  const where: Prisma.CommercialEventWhereInput = { tenant_key: tenantKey };
  if (status) where.status = status;
  if (eventType) where.event_type = eventType as Prisma.EnumCommercialEventTypeFilter;

  const events = await prisma.commercialEvent.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
    orderBy: { event_date: 'asc' },
  });

  return events.map(mapEvent);
}

export async function getEventById(tenantKey: string, id: string): Promise<CommercialEventSummary> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id, tenant_key: tenantKey },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });
  if (!event) throw new NotFoundError('CommercialEvent', id);
  return mapEvent(event);
}

export async function createEvent(
  tenantKey: string,
  ownerUserId: string,
  input: CreateEventInput,
): Promise<CommercialEventSummary> {
  const eventDate = new Date(input.eventDate);

  // Auto-derive campaignStartDate if not provided: 30 days before event
  let campaignStartDate: Date | null = null;
  if (input.campaignStartDate) {
    campaignStartDate = new Date(input.campaignStartDate);
  } else {
    campaignStartDate = new Date(eventDate);
    campaignStartDate.setDate(campaignStartDate.getDate() - 30);
  }

  // Validate campaign dates
  if (campaignStartDate >= eventDate) {
    campaignStartDate = new Date(eventDate);
    campaignStartDate.setDate(campaignStartDate.getDate() - 30);
  }

  let campaignEndDate: Date | null = null;
  if (input.campaignEndDate) {
    campaignEndDate = new Date(input.campaignEndDate);
    if (campaignEndDate < campaignStartDate) {
      campaignEndDate = eventDate;
    }
  }

  const event = await prisma.commercialEvent.create({
    data: {
      tenant_key: tenantKey,
      name: input.name,
      event_type: input.eventType,
      event_date: eventDate,
      location: input.location,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      expected_attendance: input.expectedAttendance,
      revenue_target: input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null,
      planned_budget: input.plannedBudget != null ? new Prisma.Decimal(input.plannedBudget) : null,
      owner_user_id: ownerUserId,
      status: 'draft',
      offer: input.offer,
      audience: input.audience,
      geography: input.geography,
      fomo_angle: input.fomoAngle,
      upsell_plan: input.upsellPlan,
      selected_channels: input.selectedChannels ?? [],
      content_department_requirements: input.contentDepartmentRequirements,
      sales_team_requirements: input.salesTeamRequirements,
    },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEvent(
  tenantKey: string,
  id: string,
  input: UpdateEventInput,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const data: Prisma.CommercialEventUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.eventType !== undefined) data.event_type = input.eventType;
  if (input.eventDate !== undefined) data.event_date = new Date(input.eventDate);
  if (input.location !== undefined) data.location = input.location;
  if (input.campaignStartDate !== undefined) data.campaign_start_date = input.campaignStartDate ? new Date(input.campaignStartDate) : null;
  if (input.campaignEndDate !== undefined) data.campaign_end_date = input.campaignEndDate ? new Date(input.campaignEndDate) : null;
  if (input.expectedAttendance !== undefined) data.expected_attendance = input.expectedAttendance;
  if (input.revenueTarget !== undefined) data.revenue_target = input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null;
  if (input.plannedBudget !== undefined) data.planned_budget = input.plannedBudget != null ? new Prisma.Decimal(input.plannedBudget) : null;
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.geography !== undefined) data.geography = input.geography;
  if (input.fomoAngle !== undefined) data.fomo_angle = input.fomoAngle;
  if (input.upsellPlan !== undefined) data.upsell_plan = input.upsellPlan;
  if (input.selectedChannels !== undefined) data.selected_channels = input.selectedChannels;
  if (input.contentDepartmentRequirements !== undefined) data.content_department_requirements = input.contentDepartmentRequirements;
  if (input.salesTeamRequirements !== undefined) data.sales_team_requirements = input.salesTeamRequirements;

  const event = await prisma.commercialEvent.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEventStrategy(
  tenantKey: string,
  id: string,
  input: UpdateStrategyInput,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const data: Prisma.CommercialEventUpdateInput = {};
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.geography !== undefined) data.geography = input.geography;
  if (input.fomoAngle !== undefined) data.fomo_angle = input.fomoAngle;
  if (input.upsellPlan !== undefined) data.upsell_plan = input.upsellPlan;
  if (input.selectedChannels !== undefined) data.selected_channels = input.selectedChannels;
  if (input.contentDepartmentRequirements !== undefined) data.content_department_requirements = input.contentDepartmentRequirements;
  if (input.salesTeamRequirements !== undefined) data.sales_team_requirements = input.salesTeamRequirements;

  const event = await prisma.commercialEvent.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEventStatus(
  tenantKey: string,
  id: string,
  toStatus: CommercialEventStatus,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const event = await prisma.commercialEvent.update({
    where: { id },
    data: { status: toStatus },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function linkCampaign(
  tenantKey: string,
  eventId: string,
  campaignId: string,
): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const campaign = await prisma.contentRequest.findFirst({ where: { id: campaignId, tenant_key: tenantKey } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  await prisma.contentRequest.update({
    where: { id: campaignId },
    data: { event_id: eventId },
  });
}

export async function linkLead(
  tenantKey: string,
  eventId: string,
  leadId: string,
): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const lead = await prisma.leadCaptureRecord.findFirst({ where: { id: leadId, tenant_key: tenantKey } });
  if (!lead) throw new NotFoundError('Lead', leadId);

  await prisma.leadCaptureRecord.update({
    where: { id: leadId },
    data: { event_id: eventId },
  });
}

export async function createKpiRecord(
  tenantKey: string,
  eventId: string,
  userId: string,
  input: CreateKpiRecordInput,
): Promise<EventKpiRecordSummary> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey }, select: { id: true } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const record = await prisma.eventKpiRecord.create({
    data: {
      tenant_key: tenantKey,
      event_id: eventId,
      source_type: input.sourceType || 'manual',
      source_name: input.sourceName || 'manual',
      metric_date: new Date(input.metricDate),
      channel: input.channel || 'manual',
      reach: input.reach || 0,
      impressions: input.impressions || 0,
      interactions: input.interactions || 0,
      clicks: input.clicks || 0,
      form_completions: input.formCompletions || 0,
      leads: input.leads || 0,
      meetings_booked: input.meetingsBooked || 0,
      meetings_attended: input.meetingsAttended || 0,
      purchases: input.purchases || 0,
      no_shows: input.noShows || 0,
      spend: input.spend != null ? new Prisma.Decimal(input.spend) : new Prisma.Decimal(0),
      notes: input.notes || null,
      created_by_user_id: userId,
    },
  });

  return mapKpiRecord(record as unknown as Record<string, unknown>);
}

export async function updateKpiRecord(
  tenantKey: string,
  eventId: string,
  kpiId: string,
  userId: string,
  input: UpdateKpiRecordInput,
): Promise<EventKpiRecordSummary> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey }, select: { id: true } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const existing = await prisma.eventKpiRecord.findFirst({ where: { id: kpiId, event_id: eventId, tenant_key: tenantKey }, select: { id: true } });
  if (!existing) throw new NotFoundError('EventKpiRecord', kpiId);

  const data: Prisma.EventKpiRecordUpdateInput = { updated_by_user_id: userId };
  if (input.sourceType !== undefined) data.source_type = input.sourceType;
  if (input.sourceName !== undefined) data.source_name = input.sourceName;
  if (input.metricDate !== undefined) data.metric_date = new Date(input.metricDate);
  if (input.channel !== undefined) data.channel = input.channel;
  if (input.reach !== undefined) data.reach = input.reach;
  if (input.impressions !== undefined) data.impressions = input.impressions;
  if (input.interactions !== undefined) data.interactions = input.interactions;
  if (input.clicks !== undefined) data.clicks = input.clicks;
  if (input.formCompletions !== undefined) data.form_completions = input.formCompletions;
  if (input.leads !== undefined) data.leads = input.leads;
  if (input.meetingsBooked !== undefined) data.meetings_booked = input.meetingsBooked;
  if (input.meetingsAttended !== undefined) data.meetings_attended = input.meetingsAttended;
  if (input.purchases !== undefined) data.purchases = input.purchases;
  if (input.noShows !== undefined) data.no_shows = input.noShows;
  if (input.spend !== undefined) data.spend = new Prisma.Decimal(input.spend);
  if (input.notes !== undefined) data.notes = input.notes;

  const record = await prisma.eventKpiRecord.update({ where: { id: kpiId }, data });
  return mapKpiRecord(record as unknown as Record<string, unknown>);
}

export async function listEventCampaigns(tenantKey: string, eventId: string) {
  await getEventById(tenantKey, eventId);
  const campaigns = await prisma.contentRequest.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    select: {
      id: true,
      raw_message: true,
      objective: true,
      status: true,
      target_platforms: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  return campaigns.map(campaign => ({
    id: campaign.id,
    title: firstLine(campaign.raw_message) || 'Event campaign',
    objective: campaign.objective,
    status: campaign.status,
    platforms: campaign.target_platforms,
    createdAt: campaign.created_at,
  }));
}

export async function listEventLeads(tenantKey: string, eventId: string) {
  await getEventById(tenantKey, eventId);
  const leads = await prisma.leadCaptureRecord.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    select: {
      id: true,
      lead_status: true,
      platform: true,
      lead_name_placeholder: true,
      lead_email_placeholder: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  return leads.map(lead => ({
    id: lead.id,
    status: lead.lead_status,
    platform: lead.platform || 'manual',
    leadName: lead.lead_name_placeholder,
    leadEmail: lead.lead_email_placeholder,
    createdAt: lead.created_at,
  }));
}

export async function getEventDashboard(tenantKey: string, eventId: string): Promise<EventDashboardSummary> {
  const event = await getEventById(tenantKey, eventId);
  const [kpiRecords, campaigns, leads] = await Promise.all([
    prisma.eventKpiRecord.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      orderBy: [{ metric_date: 'desc' }, { created_at: 'desc' }],
      take: 200,
    }),
    listEventCampaigns(tenantKey, eventId),
    listEventLeads(tenantKey, eventId),
  ]);

  const records = kpiRecords.map(record => mapKpiRecord(record as unknown as Record<string, unknown>));
  const totals = aggregateRecords(records);
  const capturedLeads = leads.length;
  const newLeads = Math.max(capturedLeads, totals.leads);
  const actualSpend = totals.spend;
  const plannedBudget = event.plannedBudget || 0;
  const meetingsNotAttended = Math.max(0, totals.meetingsBooked - totals.meetingsAttended);
  const noShows = Math.max(totals.noShows, meetingsNotAttended);
  const noShowRate = totals.meetingsBooked > 0 ? percentage(noShows, totals.meetingsBooked) : 0;

  const dashboard: EventDashboardSummary = {
    event,
    kpis: {
      newLeads,
      capturedLeads,
      reportedLeads: totals.leads,
      formCompletions: totals.formCompletions,
      meetingsBooked: totals.meetingsBooked,
      meetingsAttended: totals.meetingsAttended,
      purchases: totals.purchases,
      noShows,
      noShowRate,
      plannedBudget,
      actualSpend,
      budgetVariance: plannedBudget - actualSpend,
      reach: totals.reach,
      impressions: totals.impressions,
      interactions: totals.interactions,
      clicks: totals.clicks,
      interactionRate: totals.impressions > 0 ? percentage(totals.interactions, totals.impressions) : 0,
      costPerLead: newLeads > 0 ? roundCurrency(actualSpend / newLeads) : 0,
      costPerPurchase: totals.purchases > 0 ? roundCurrency(actualSpend / totals.purchases) : 0,
    },
    funnel: [
      { label: 'Reach', value: totals.reach },
      { label: 'Interactions', value: totals.interactions },
      { label: 'Forms', value: totals.formCompletions },
      { label: 'Leads', value: newLeads },
      { label: 'Meetings', value: totals.meetingsBooked },
      { label: 'Purchases', value: totals.purchases },
    ],
    channelPerformance: buildChannelPerformance(records),
    leadTemperature: buildLeadTemperature(leads, totals.purchases, noShows),
    nextActions: buildNextActions(event, records, totals, capturedLeads, noShows),
    kpiRecords: records,
    campaigns,
    leads,
    sourceStatus: {
      manualRecords: records.filter(record => record.sourceType === 'manual').length,
      importedRecords: records.filter(record => record.sourceType === 'imported').length,
      connectorRecords: records.filter(record => record.sourceType === 'connector').length,
    },
  };

  return dashboard;
}

function mapEvent(e: Record<string, unknown>): CommercialEventSummary {
  const owner = e.owner as { name: string } | null;
  const campaigns = e.campaigns as { id: string }[] | undefined;
  const leads = e.leads as { id: string }[] | undefined;
  return {
    id: e.id as string,
    tenantKey: e.tenant_key as string,
    name: e.name as string,
    eventType: e.event_type as CommercialEventSummary['eventType'],
    eventDate: e.event_date as Date,
    location: e.location as string | null,
    campaignStartDate: e.campaign_start_date as Date | null,
    campaignEndDate: e.campaign_end_date as Date | null,
    expectedAttendance: e.expected_attendance as number | null,
    revenueTarget: e.revenue_target != null ? Number(e.revenue_target) : null,
    plannedBudget: e.planned_budget != null ? Number(e.planned_budget) : null,
    ownerUserId: e.owner_user_id as string,
    ownerUserName: owner?.name || null,
    status: e.status as CommercialEventSummary['status'],
    offer: e.offer as string | null,
    audience: e.audience as string | null,
    geography: e.geography as string | null,
    fomoAngle: e.fomo_angle as string | null,
    upsellPlan: e.upsell_plan as string | null,
    selectedChannels: (e.selected_channels as string[]) ?? [],
    contentDepartmentRequirements: e.content_department_requirements as string | null,
    salesTeamRequirements: e.sales_team_requirements as string | null,
    campaignCount: campaigns?.length ?? 0,
    leadCount: leads?.length ?? 0,
    createdAt: e.created_at as Date,
    updatedAt: e.updated_at as Date,
  };
}

function mapKpiRecord(record: Record<string, unknown>): EventKpiRecordSummary {
  return {
    id: record.id as string,
    tenantKey: record.tenant_key as string,
    eventId: record.event_id as string,
    sourceType: record.source_type as EventKpiRecordSummary['sourceType'],
    sourceName: record.source_name as string,
    metricDate: record.metric_date as Date,
    channel: record.channel as string,
    reach: Number(record.reach || 0),
    impressions: Number(record.impressions || 0),
    interactions: Number(record.interactions || 0),
    clicks: Number(record.clicks || 0),
    formCompletions: Number(record.form_completions || 0),
    leads: Number(record.leads || 0),
    meetingsBooked: Number(record.meetings_booked || 0),
    meetingsAttended: Number(record.meetings_attended || 0),
    purchases: Number(record.purchases || 0),
    noShows: Number(record.no_shows || 0),
    spend: Number(record.spend || 0),
    notes: record.notes as string | null,
    createdByUserId: record.created_by_user_id as string,
    updatedByUserId: record.updated_by_user_id as string | null,
    createdAt: record.created_at as Date,
    updatedAt: record.updated_at as Date,
  };
}

function aggregateRecords(records: EventKpiRecordSummary[]) {
  return records.reduce(
    (total, record) => ({
      reach: total.reach + record.reach,
      impressions: total.impressions + record.impressions,
      interactions: total.interactions + record.interactions,
      clicks: total.clicks + record.clicks,
      formCompletions: total.formCompletions + record.formCompletions,
      leads: total.leads + record.leads,
      meetingsBooked: total.meetingsBooked + record.meetingsBooked,
      meetingsAttended: total.meetingsAttended + record.meetingsAttended,
      purchases: total.purchases + record.purchases,
      noShows: total.noShows + record.noShows,
      spend: total.spend + record.spend,
    }),
    {
      reach: 0,
      impressions: 0,
      interactions: 0,
      clicks: 0,
      formCompletions: 0,
      leads: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      purchases: 0,
      noShows: 0,
      spend: 0,
    },
  );
}

function buildChannelPerformance(records: EventKpiRecordSummary[]) {
  const channels = new Map<string, ReturnType<typeof aggregateRecords>>();
  for (const record of records) {
    const key = record.channel || 'manual';
    const current = channels.get(key) || aggregateRecords([]);
    channels.set(key, aggregateRecords([
      {
        ...record,
        reach: current.reach + record.reach,
        impressions: current.impressions + record.impressions,
        interactions: current.interactions + record.interactions,
        clicks: current.clicks + record.clicks,
        formCompletions: current.formCompletions + record.formCompletions,
        leads: current.leads + record.leads,
        meetingsBooked: current.meetingsBooked + record.meetingsBooked,
        meetingsAttended: current.meetingsAttended + record.meetingsAttended,
        purchases: current.purchases + record.purchases,
        noShows: current.noShows + record.noShows,
        spend: current.spend + record.spend,
      },
    ]));
  }

  return Array.from(channels.entries())
    .map(([channel, total]) => ({
      channel,
      reach: total.reach,
      interactions: total.interactions,
      leads: total.leads,
      purchases: total.purchases,
      spend: total.spend,
      conversionRate: total.leads > 0 ? percentage(total.purchases, total.leads) : 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.interactions - a.interactions);
}

function buildLeadTemperature(
  leads: EventDashboardSummary['leads'],
  purchases: number,
  noShows: number,
) {
  const counts = { cold: 0, warm: 0, hot: 0, buyer: purchases, noShow: noShows };
  for (const lead of leads) {
    if (lead.status === 'converted') counts.buyer += 1;
    else if (lead.status === 'qualified') counts.hot += 1;
    else if (lead.status === 'contacted' || lead.status === 'nurturing') counts.warm += 1;
    else counts.cold += 1;
  }

  return [
    { label: 'Cold', value: counts.cold },
    { label: 'Warm', value: counts.warm },
    { label: 'Hot', value: counts.hot },
    { label: 'Buyer', value: counts.buyer },
    { label: 'No-show', value: counts.noShow },
  ];
}

function buildNextActions(
  event: CommercialEventSummary,
  records: EventKpiRecordSummary[],
  totals: ReturnType<typeof aggregateRecords>,
  capturedLeads: number,
  noShows: number,
): EventDashboardSummary['nextActions'] {
  const actions: EventDashboardSummary['nextActions'] = [];
  if (records.length === 0) {
    actions.push({
      title: 'Add the first event KPI update',
      detail: 'Enter today\'s reach, spend, forms, leads, meetings, and sales so the dashboard replaces the tracking sheet.',
      priority: 'high',
    });
  }
  if ((event.plannedBudget || 0) > 0 && totals.spend === 0) {
    actions.push({
      title: 'Enter actual spend',
      detail: 'Planned budget exists, but actual spend is still empty. Add Meta, YouTube, WhatsApp, or manual spend.',
      priority: 'high',
    });
  }
  if (totals.formCompletions > 0 && capturedLeads === 0) {
    actions.push({
      title: 'Convert form completions into lead records',
      detail: 'Forms are reported, but no lead records are linked to this event yet.',
      priority: 'high',
    });
  }
  if (capturedLeads > 0 && totals.meetingsBooked === 0) {
    actions.push({
      title: 'Book meetings for captured leads',
      detail: 'Leads exist, but meeting booking is still empty for this event.',
      priority: 'medium',
    });
  }
  if (noShows > 0) {
    actions.push({
      title: 'Run no-show recovery',
      detail: 'Some booked prospects did not attend. Prepare a follow-up message or SmartLabs handoff.',
      priority: 'medium',
    });
  }
  if (totals.leads > 0 && totals.purchases === 0) {
    actions.push({
      title: 'Review sales close path',
      detail: 'Leads are reported, but purchases are still zero. Check offer clarity, follow-up timing, and sales ownership.',
      priority: 'medium',
    });
  }

  return actions.slice(0, 6);
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function firstLine(value: string | null | undefined): string {
  return value?.split('\n')[0]?.trim() || '';
}
