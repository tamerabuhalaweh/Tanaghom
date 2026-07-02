import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { CloseoutReport, EventSummary, EventTimelineEntry, BudgetSection, LeadFunnelSection, SalesOutcomesSection, TopBarrierRow, CampaignSummaryRow, ContentPackageRow, OpenFollowUpRow, PlannerSummarySection, DataCompletenessSection } from './types';

export async function generateCloseoutReport(tenantKey: string, eventId: string): Promise<CloseoutReport> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const [kpiRecords, leads, problems, campaigns, packages, emailPlans, whatsappPlans, upsellPlans, contentReqs, salesTasks] = await Promise.all([
    prisma.eventKpiRecord.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: {
        id: true, lead_status: true, lead_temperature: true,
        audience_source: true, channel_attribution: true,
        purchase_amount: true, purchase_date: true,
        follow_up_date: true, meeting_date: true, meeting_type: true,
        lead_name_placeholder: true, created_at: true,
      },
    }),
    prisma.eventProblem.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
    }),
    prisma.contentRequest.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: { id: true, raw_message: true, status: true, target_platforms: true, created_at: true },
    }),
    prisma.publishingPackage.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: { id: true, package_status: true, package_type: true, created_at: true },
    }),
    prisma.eventEmailPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventWhatsappPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventUpsellPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventContentRequirement.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventSalesTask.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
  ]);

  const owner = event.owner as { name: string } | null;

  const eventSummary: EventSummary = {
    eventId: event.id,
    eventName: event.name,
    eventType: event.event_type,
    eventDate: event.event_date,
    location: event.location,
    status: event.status,
    ownerName: owner?.name || null,
    geography: event.geography,
    expectedAttendance: event.expected_attendance,
    revenueTarget: event.revenue_target ? Number(event.revenue_target) : null,
    plannedBudget: event.planned_budget ? Number(event.planned_budget) : null,
    campaignStartDate: event.campaign_start_date,
    campaignEndDate: event.campaign_end_date,
  };

  const timeline = buildTimeline(event, campaigns, leads);
  const budget = buildBudget(kpiRecords, event);
  const leadFunnel = buildLeadFunnel(leads);
  const salesOutcomes = buildSalesOutcomes(leads, kpiRecords);
  const { channelRows, sourceRows } = buildPerformance(leads, kpiRecords);
  const topBarriers = buildTopBarriers(problems);
  const campaignRows: CampaignSummaryRow[] = campaigns.map(c => ({ id: c.id, title: c.raw_message, status: c.status, platforms: c.target_platforms, createdAt: c.created_at }));
  const packageRows: ContentPackageRow[] = packages.map(p => ({ id: p.id, packageStatus: p.package_status, packageType: p.package_type, createdAt: p.created_at }));
  const openFollowUps = buildOpenFollowUps(leads, salesTasks, contentReqs, problems);
  const plannerSummary: PlannerSummarySection = { emailPlans: emailPlans.length, whatsappPlans: whatsappPlans.length, upsellPlans: upsellPlans.length, contentRequirements: contentReqs.length, salesTasks: salesTasks.length };
  const dataCompleteness = buildDataCompleteness(kpiRecords, leads, campaigns, problems, packages, emailPlans, whatsappPlans, upsellPlans);

  return { event: eventSummary, timeline, budget, leadFunnel, salesOutcomes, channelPerformance: channelRows, sourcePerformance: sourceRows, topBarriers, campaigns: campaignRows, contentPackages: packageRows, openFollowUps, plannerSummary, dataCompleteness };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTimeline(event: any, campaigns: any[], leads: any[]): EventTimelineEntry[] {
  const entries: EventTimelineEntry[] = [];
  entries.push({ date: event.created_at, label: 'Event created', category: 'event' });
  if (event.campaign_start_date) entries.push({ date: event.campaign_start_date, label: 'Campaign start', category: 'campaign' });
  for (const c of campaigns.slice(0, 3)) entries.push({ date: c.created_at, label: `Campaign: ${c.raw_message}`, category: 'campaign' });
  if (leads.length > 0) entries.push({ date: leads[leads.length - 1].created_at, label: 'First lead captured', category: 'lead' });
  if (event.event_date) entries.push({ date: event.event_date, label: 'Event date', category: 'event' });
  if (event.campaign_end_date) entries.push({ date: event.campaign_end_date, label: 'Campaign end', category: 'campaign' });
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return entries;
}

function buildBudget(kpiRecords: Record<string, unknown>[], event: Record<string, unknown>): BudgetSection {
  let knownSpend = 0;
  for (const k of kpiRecords) knownSpend += k.spend ? Number(k.spend) : 0;
  const plannedBudget = event.planned_budget ? Number(event.planned_budget) : null;
  const budgetVariance = plannedBudget !== null ? plannedBudget - knownSpend : null;
  return { plannedBudget, knownSpend, budgetVariance, spendSource: kpiRecords.length > 0 ? 'kpi_records' : 'none' };
}

function buildLeadFunnel(leads: Record<string, unknown>[]): LeadFunnelSection {
  const byStatus: Record<string, number> = {};
  const byTemperature: Record<string, number> = {};
  for (const l of leads) {
    byStatus[l.lead_status as string] = (byStatus[l.lead_status as string] || 0) + 1;
    byTemperature[l.lead_temperature as string] = (byTemperature[l.lead_temperature as string] || 0) + 1;
  }
  return { totalLeads: leads.length, byStatus, byTemperature };
}

function buildSalesOutcomes(leads: Record<string, unknown>[], kpiRecords: Record<string, unknown>[]): SalesOutcomesSection {
  let meetingsBooked = 0, meetingsAttended = 0, noShows = 0, purchases = 0, revenue = 0;
  for (const l of leads) {
    if (l.meeting_date || l.lead_status === 'meeting_booked') meetingsBooked++;
    if (l.lead_status === 'meeting_attended') meetingsAttended++;
    if (l.lead_status === 'no_show') noShows++;
    if (l.lead_status === 'purchased' || l.purchase_date) { purchases++; revenue += l.purchase_amount ? Number(l.purchase_amount) : 0; }
  }
  for (const k of kpiRecords) { meetingsBooked += Number(k.meetings_booked) || 0; meetingsAttended += Number(k.meetings_attended) || 0; noShows += Number(k.no_shows) || 0; purchases += Number(k.purchases) || 0; }
  return { meetingsBooked, meetingsAttended, noShows, noShowRate: meetingsBooked > 0 ? noShows / meetingsBooked : 0, purchases, revenue };
}

function buildPerformance(leads: Record<string, unknown>[], kpiRecords: Record<string, unknown>[]) {
  const channelMap: Record<string, { leads: number; purchases: number; spend: number }> = {};
  const sourceMap: Record<string, { leads: number; purchases: number }> = {};
  for (const l of leads) {
    const ch = (l.channel_attribution as string) || 'unknown';
    const src = (l.audience_source as string) || 'unknown';
    channelMap[ch] = channelMap[ch] || { leads: 0, purchases: 0, spend: 0 }; channelMap[ch].leads++;
    if (l.lead_status === 'purchased' || l.purchase_date) channelMap[ch].purchases++;
    sourceMap[src] = sourceMap[src] || { leads: 0, purchases: 0 }; sourceMap[src].leads++;
    if (l.lead_status === 'purchased' || l.purchase_date) sourceMap[src].purchases++;
  }
  for (const k of kpiRecords) {
    const ch = (k.channel as string) || 'unknown';
    channelMap[ch] = channelMap[ch] || { leads: 0, purchases: 0, spend: 0 };
    channelMap[ch].leads += Number(k.leads) || 0; channelMap[ch].purchases += Number(k.purchases) || 0;
    channelMap[ch].spend += k.spend ? Number(k.spend) : 0;
  }
  return { channelRows: Object.entries(channelMap).map(([channel, d]) => ({ channel, ...d })), sourceRows: Object.entries(sourceMap).map(([source, d]) => ({ source, ...d })) };
}

function buildTopBarriers(problems: Record<string, unknown>[]): TopBarrierRow[] {
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...problems].sort((a, b) => (sevOrder[a.severity as string] ?? 4) - (sevOrder[b.severity as string] ?? 4)).slice(0, 10).map(p => ({
    id: p.id as string, title: p.title as string, severity: p.severity as string, category: p.category as string, status: p.status as string, ownerRole: p.owner_role as string | null,
  }));
}

function buildOpenFollowUps(leads: Record<string, unknown>[], salesTasks: Record<string, unknown>[], contentReqs: Record<string, unknown>[], problems: Record<string, unknown>[]): OpenFollowUpRow[] {
  const rows: OpenFollowUpRow[] = [];
  for (const l of leads) { if (l.follow_up_date && l.lead_status !== 'purchased' && l.lead_status !== 'lost') rows.push({ type: 'lead_follow_up', id: l.id as string, title: `Follow up: ${l.lead_name_placeholder || 'Lead'}`, dueDate: l.follow_up_date as Date, ownerRole: null, severity: null }); }
  for (const t of salesTasks) { if (t.status !== 'completed') rows.push({ type: 'sales_task', id: t.id as string, title: (t.description as string) || (t.task_type as string), dueDate: t.due_date as Date | null, ownerRole: t.owner_role as string | null, severity: null }); }
  for (const c of contentReqs) { if (c.status !== 'delivered' && c.status !== 'ready') rows.push({ type: 'content_requirement', id: c.id as string, title: `${c.asset_type}: ${c.description || 'No description'}`, dueDate: c.due_date as Date | null, ownerRole: null, severity: null }); }
  for (const p of problems) { if (p.status === 'open' || p.status === 'investigating') rows.push({ type: 'problem', id: p.id as string, title: p.title as string, dueDate: p.due_date as Date | null, ownerRole: p.owner_role as string | null, severity: p.severity as string }); }
  rows.sort((a, b) => { if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime(); if (a.dueDate) return -1; if (b.dueDate) return 1; return 0; });
  return rows;
}

function buildDataCompleteness(kpiRecords: unknown[], leads: unknown[], campaigns: unknown[], problems: unknown[], packages: unknown[], emailPlans: unknown[], whatsappPlans: unknown[], upsellPlans: unknown[]): DataCompletenessSection {
  const missing: string[] = [];
  if (kpiRecords.length === 0) missing.push('kpi_records');
  if (leads.length === 0) missing.push('leads');
  if (campaigns.length === 0) missing.push('campaigns');
  if (problems.length === 0) missing.push('problems');
  if (packages.length === 0) missing.push('content_packages');
  if (emailPlans.length === 0 && whatsappPlans.length === 0 && upsellPlans.length === 0) missing.push('planner');
  return { hasKpiRecords: kpiRecords.length > 0, hasLeads: leads.length > 0, hasCampaigns: campaigns.length > 0, hasProblems: problems.length > 0, hasContentPackages: packages.length > 0, hasPlannerData: emailPlans.length > 0 || whatsappPlans.length > 0 || upsellPlans.length > 0, missingSections: missing };
}
