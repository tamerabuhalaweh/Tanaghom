import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import type {
  CreateExecutiveReportPreviewInput,
  CreateExecutiveReportScheduleInput,
  ExecutiveAlert,
  ExecutiveDashboard,
  ExecutiveDashboardQueryInput,
  ExecutiveMetricSummary,
  ExecutiveReportCadence,
  ExecutiveReportScheduleSummary,
  ExecutiveReportSummary,
  ListExecutiveReportsQueryInput,
  ListExecutiveReportSchedulesQueryInput,
} from './types';

const CUSTOMER_VISIBLE_TEST_NAME_PATTERN = /\b(sprint\s*\d+|acceptance|smoke test|test tenant|customer review event)\b/i;

export async function getExecutiveDashboard(
  tenantKey: string,
  filters: ExecutiveDashboardQueryInput,
): Promise<ExecutiveDashboard> {
  const snapshot = await buildSnapshot(tenantKey, filters);
  return snapshot.dashboard;
}

export async function listReports(
  tenantKey: string,
  filters: ListExecutiveReportsQueryInput,
): Promise<ExecutiveReportSummary[]> {
  const reports = await prisma.commercialExecutiveReport.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.cadence ? { cadence: filters.cadence } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: filters.limit || 10,
  });
  return reports.map(mapReport);
}

export async function createReportPreview(
  tenantKey: string,
  userId: string,
  input: CreateExecutiveReportPreviewInput,
): Promise<ExecutiveReportSummary> {
  const period = inferPeriod(input.cadence, input.startDate, input.endDate);
  const dashboardFilters: ExecutiveDashboardQueryInput = {
    revenueLineType: input.revenueLineType,
    eventId: input.eventId,
    location: input.location,
    channel: input.channel,
    sourceType: input.sourceType,
    startDate: period.startDate,
    endDate: period.endDate,
  };
  const snapshot = await buildSnapshot(tenantKey, dashboardFilters);
  const title = input.title || `${titleCase(input.cadence)} commercial report`;
  const summary = buildExecutiveSummary(snapshot.dashboard);
  const report = await prisma.commercialExecutiveReport.create({
    data: {
      tenant_key: tenantKey,
      cadence: input.cadence,
      period_start: period.startDate,
      period_end: period.endDate,
      timezone: input.timezone || 'UTC',
      status: 'preview',
      title,
      summary,
      filters: toJsonObject(dashboardFilters),
      metrics: toJsonObject(snapshot.dashboard.metrics),
      alerts: toJsonArray(snapshot.dashboard.alerts),
      missing_sources: toJsonArray(snapshot.dashboard.missingSources),
      confidence: snapshot.dashboard.confidence,
      preview_payload: toJsonObject({
        title,
        summary,
        generatedAt: snapshot.dashboard.generatedAt,
        metrics: snapshot.dashboard.metrics,
        alerts: snapshot.dashboard.alerts,
        missingSources: snapshot.dashboard.missingSources,
        dataFreshness: snapshot.dashboard.dataFreshness,
        revenueLines: snapshot.dashboard.revenueLines,
        channelPerformance: snapshot.dashboard.channelPerformance,
        sourceBreakdown: snapshot.dashboard.sourceBreakdown,
      }),
      generated_by_user_id: userId,
    },
  });
  return mapReport(report);
}

export async function listSchedules(
  tenantKey: string,
  filters: ListExecutiveReportSchedulesQueryInput,
): Promise<ExecutiveReportScheduleSummary[]> {
  const schedules = await prisma.commercialExecutiveReportSchedule.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    take: 50,
  });
  return schedules.map(mapSchedule);
}

export async function createSchedule(
  tenantKey: string,
  userId: string,
  input: CreateExecutiveReportScheduleInput,
): Promise<ExecutiveReportScheduleSummary> {
  const schedule = await prisma.commercialExecutiveReportSchedule.create({
    data: {
      tenant_key: tenantKey,
      cadence: input.cadence,
      timezone: input.timezone || 'UTC',
      recipients: input.recipients || [],
      delivery_channels: input.deliveryChannels || ['dashboard'],
      status: 'active',
      approval_required: input.approvalRequired ?? true,
      next_run_at: input.nextRunAt ?? null,
      created_by_user_id: userId,
    },
  });
  return mapSchedule(schedule);
}

async function buildSnapshot(tenantKey: string, filters: ExecutiveDashboardQueryInput) {
  const whereDates = dateWhere(filters.startDate, filters.endDate);
  const eventWhere: Prisma.CommercialEventWhereInput = {
    tenant_key: tenantKey,
    ...(filters.eventId ? { id: filters.eventId } : {}),
    ...(filters.location ? { location: { contains: filters.location, mode: 'insensitive' } } : {}),
  };

  const [
    revenueLines,
    plans,
    rawEvents,
    kpiRecords,
    leads,
    connectorJobs,
    disciplineRecords,
    signals,
    recentReports,
    schedules,
  ] = await Promise.all([
    prisma.commercialRevenueLine.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.revenueLineType ? { revenue_line_type: filters.revenueLineType } : {}),
      },
      select: {
        id: true,
        revenue_line_type: true,
        name: true,
        status: true,
      },
      take: 50,
    }),
    prisma.commercialPlan.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.revenueLineType ? { revenue_line: { revenue_line_type: filters.revenueLineType } } : {}),
        ...(filters.eventId ? { linked_event_id: filters.eventId } : {}),
      },
      select: {
        id: true,
        revenue_line_id: true,
        linked_event_id: true,
        budget_target: true,
        revenue_target: true,
        status: true,
        revenue_line: { select: { id: true, revenue_line_type: true, name: true } },
      },
      take: 500,
    }),
    prisma.commercialEvent.findMany({
      where: eventWhere,
      select: {
        id: true,
        name: true,
        planned_budget: true,
        revenue_target: true,
        event_date: true,
      },
      take: 500,
    }),
    prisma.eventKpiRecord.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.eventId ? { event_id: filters.eventId } : {}),
        ...(filters.channel ? { channel: filters.channel } : {}),
        ...(filters.sourceType ? { source_type: filters.sourceType } : {}),
        ...(Object.keys(whereDates).length ? { metric_date: whereDates } : {}),
      },
      select: {
        event_id: true,
        source_type: true,
        metric_date: true,
        channel: true,
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
      },
      take: 5000,
    }),
    prisma.leadCaptureRecord.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.eventId ? { event_id: filters.eventId } : {}),
        ...(Object.keys(whereDates).length ? { created_at: whereDates } : {}),
      },
      select: {
        event_id: true,
        lead_status: true,
        lead_temperature: true,
        channel_attribution: true,
        source_of_truth: true,
        purchase_amount: true,
        meeting_date: true,
        meeting_outcome: true,
        external_last_synced_at: true,
        created_at: true,
      },
      take: 5000,
    }),
    prisma.connectorImportJob.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.eventId ? { event_id: filters.eventId } : {}),
      },
      select: {
        event_id: true,
        connector_id: true,
        state: true,
        sync_status: true,
        last_dry_run_at: true,
        last_sync_at: true,
      },
      take: 1000,
    }),
    prisma.commercialDisciplineRecord.findMany({
      where: {
        tenant_key: tenantKey,
        ...(filters.revenueLineType ? { revenue_line: { revenue_line_type: filters.revenueLineType } } : {}),
        ...(filters.eventId ? { event_id: filters.eventId } : {}),
      },
      select: {
        status: true,
        priority: true,
        updated_at: true,
      },
      take: 1000,
    }),
    prisma.commercialAssessmentSignal.findMany({
      where: {
        tenant_key: tenantKey,
        status: { in: ['open', 'reviewing'] },
        ...(filters.revenueLineType ? { revenue_line: { revenue_line_type: filters.revenueLineType } } : {}),
      },
      select: {
        severity: true,
        title: true,
        recommended_action: true,
      },
      take: 200,
    }),
    prisma.commercialExecutiveReport.findMany({
      where: { tenant_key: tenantKey },
      orderBy: { created_at: 'desc' },
      take: 6,
    }),
    prisma.commercialExecutiveReportSchedule.findMany({
      where: { tenant_key: tenantKey, status: 'active' },
      orderBy: { created_at: 'desc' },
      take: 6,
    }),
  ]);

  const events = rawEvents.filter(event => isCustomerVisibleRecordName(event.name));
  const visibleEventIds = new Set(events.map(event => event.id));
  const filteredKpis = kpiRecords.filter(row => !row.event_id || visibleEventIds.has(row.event_id));
  const filteredLeads = leads.filter(row => !row.event_id || visibleEventIds.has(row.event_id));
  const filteredConnectorJobs = connectorJobs.filter(row => !row.event_id || visibleEventIds.has(row.event_id));
  const eventIdsWithPlans = new Set(plans.map(plan => plan.linked_event_id).filter((id): id is string => Boolean(id)));

  const metrics = summarizeMetrics(plans, events, filteredKpis, filteredLeads);
  const revenueLineRows = summarizeRevenueLines(revenueLines, plans, filteredKpis, filteredLeads);
  const channelPerformance = summarizeChannels(filteredKpis, filteredLeads);
  const sourceBreakdown = summarizeSourceTypes(filteredKpis);
  const disciplineSummary = summarizeDisciplines(disciplineRecords);
  const connectorReadiness = summarizeConnectorReadiness(filteredConnectorJobs);
  const missingSources = getMissingSources({
    plans: plans.length,
    events: events.length,
    kpis: filteredKpis.length,
    leads: filteredLeads.length,
    connectorJobs: filteredConnectorJobs.length,
    schedules: schedules.length,
    customerThresholdsConfigured: false,
  });
  const alerts = buildAlerts({
    metrics,
    missingSources,
    signals,
    disciplineSummary,
    connectorReadiness,
    eventIdsWithPlans: eventIdsWithPlans.size,
    kpiRecords: filteredKpis.length,
    leadRecords: filteredLeads.length,
  });
  const confidence = getConfidence(filteredKpis, filteredLeads, filteredConnectorJobs);
  const dataFreshness = buildFreshness(filteredKpis, filteredLeads, filteredConnectorJobs, disciplineRecords);

  const dashboard: ExecutiveDashboard = {
    generatedAt: new Date(),
    period: {
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
    },
    filters,
    metrics,
    confidence,
    missingSources,
    dataFreshness,
    revenueLines: revenueLineRows,
    channelPerformance,
    sourceBreakdown,
    disciplineSummary,
    connectorReadiness,
    alerts,
    reports: {
      recent: recentReports.map(mapReport),
      activeSchedules: schedules.map(mapSchedule),
      nextRecommendedCadence: 'weekly',
    },
    stitchi: {
      suggestedPrompt: 'Stitchi, summarize the executive dashboard, explain top risks, and propose the safest internal next actions.',
    },
  };

  return { dashboard };
}

function summarizeMetrics(
  plans: Array<{ budget_target: unknown; revenue_target: unknown }>,
  events: Array<{ planned_budget: unknown; revenue_target: unknown }>,
  kpis: Array<{
    reach: number;
    impressions: number;
    interactions: number;
    clicks: number;
    form_completions: number;
    leads: number;
    meetings_booked: number;
    meetings_attended: number;
    purchases: number;
    no_shows: number;
    spend: unknown;
  }>,
  leads: Array<{ lead_status: unknown; purchase_amount: unknown; meeting_date: Date | null; meeting_outcome: string | null }>,
): ExecutiveMetricSummary {
  const plannedRevenueTarget = sumDecimal(plans, 'revenue_target') || sumDecimal(events, 'revenue_target');
  const plannedBudget = sumDecimal(plans, 'budget_target') || sumDecimal(events, 'planned_budget');
  const knownSpend = kpis.reduce((total, row) => total + (decimalToNumber(row.spend) || 0), 0);
  const knownRevenue = leads.reduce((total, lead) => total + (decimalToNumber(lead.purchase_amount) || 0), 0);
  const kpiLeads = kpis.reduce((total, row) => total + row.leads, 0);
  const leadRecords = leads.length;
  const totalLeads = Math.max(kpiLeads, leadRecords);
  const purchases = Math.max(
    kpis.reduce((total, row) => total + row.purchases, 0),
    leads.filter(lead => String(lead.lead_status) === 'purchased' || (decimalToNumber(lead.purchase_amount) || 0) > 0).length,
  );
  const meetingsBooked = Math.max(
    kpis.reduce((total, row) => total + row.meetings_booked, 0),
    leads.filter(lead => Boolean(lead.meeting_date)).length,
  );
  const meetingsAttended = Math.max(
    kpis.reduce((total, row) => total + row.meetings_attended, 0),
    leads.filter(lead => String(lead.meeting_outcome || '').toLowerCase().includes('attended')).length,
  );
  const noShows = Math.max(
    kpis.reduce((total, row) => total + row.no_shows, 0),
    leads.filter(lead => String(lead.lead_status) === 'no_show' || String(lead.meeting_outcome || '').toLowerCase().includes('no_show')).length,
  );
  const reach = kpis.reduce((total, row) => total + row.reach, 0);
  const impressions = kpis.reduce((total, row) => total + row.impressions, 0);
  const interactions = kpis.reduce((total, row) => total + row.interactions, 0);
  const clicks = kpis.reduce((total, row) => total + row.clicks, 0);
  const formCompletions = kpis.reduce((total, row) => total + row.form_completions, 0);

  return {
    plannedRevenueTarget: round2(plannedRevenueTarget),
    knownRevenue: round2(knownRevenue),
    plannedBudget: round2(plannedBudget),
    knownSpend: round2(knownSpend),
    budgetVariance: plannedBudget > 0 ? round2(plannedBudget - knownSpend) : null,
    leads: totalLeads,
    purchases,
    meetingsBooked,
    meetingsAttended,
    noShows,
    reach,
    impressions,
    interactions,
    clicks,
    formCompletions,
    costPerLead: totalLeads > 0 && knownSpend > 0 ? round2(knownSpend / totalLeads) : null,
    costPerPurchase: purchases > 0 && knownSpend > 0 ? round2(knownSpend / purchases) : null,
    leadToPurchaseRate: totalLeads > 0 ? round2((purchases / totalLeads) * 100) : null,
    meetingShowRate: meetingsBooked > 0 ? round2((meetingsAttended / meetingsBooked) * 100) : null,
    formCompletionRate: clicks > 0 ? round2((formCompletions / clicks) * 100) : null,
  };
}

function summarizeRevenueLines(
  lines: Array<{ id: string; revenue_line_type: unknown; name: string; status: unknown }>,
  plans: Array<{ revenue_line_id: string; revenue_line: { revenue_line_type: unknown; name: string }; linked_event_id: string | null; budget_target: unknown; revenue_target: unknown }>,
  kpis: Array<{ event_id: string; spend: unknown; leads: number; purchases: number }>,
  leads: Array<{ event_id: string | null; purchase_amount: unknown; lead_status: unknown }>,
) {
  const byType = new Map<string, {
    type: string;
    name: string;
    status: string;
    plannedRevenueTarget: number;
    plannedBudget: number;
    knownRevenue: number;
    knownSpend: number;
    leads: number;
    purchases: number;
  }>();

  for (const line of lines) {
    byType.set(String(line.revenue_line_type), {
      type: String(line.revenue_line_type),
      name: line.name,
      status: String(line.status),
      plannedRevenueTarget: 0,
      plannedBudget: 0,
      knownRevenue: 0,
      knownSpend: 0,
      leads: 0,
      purchases: 0,
    });
  }

  const eventToType = new Map<string, string>();
  for (const plan of plans) {
    const type = String(plan.revenue_line.revenue_line_type);
    const row = ensureRevenueLine(byType, type, plan.revenue_line.name);
    row.plannedBudget += decimalToNumber(plan.budget_target) || 0;
    row.plannedRevenueTarget += decimalToNumber(plan.revenue_target) || 0;
    if (plan.linked_event_id) eventToType.set(plan.linked_event_id, type);
  }

  for (const kpi of kpis) {
    const type = eventToType.get(kpi.event_id) || 'live_event';
    const row = ensureRevenueLine(byType, type, titleCase(type));
    row.knownSpend += decimalToNumber(kpi.spend) || 0;
    row.leads += kpi.leads;
    row.purchases += kpi.purchases;
  }

  for (const lead of leads) {
    const type = lead.event_id ? eventToType.get(lead.event_id) || 'live_event' : 'live_event';
    const row = ensureRevenueLine(byType, type, titleCase(type));
    row.leads += 1;
    row.knownRevenue += decimalToNumber(lead.purchase_amount) || 0;
    row.purchases = Math.max(row.purchases, String(lead.lead_status) === 'purchased' ? row.purchases + 1 : row.purchases);
  }

  return Array.from(byType.values()).map(row => ({
    ...row,
    plannedRevenueTarget: round2(row.plannedRevenueTarget),
    plannedBudget: round2(row.plannedBudget),
    knownRevenue: round2(row.knownRevenue),
    knownSpend: round2(row.knownSpend),
  })).sort((a, b) => b.plannedRevenueTarget - a.plannedRevenueTarget || a.name.localeCompare(b.name));
}

function summarizeChannels(
  kpis: Array<{ channel: string; spend: unknown; reach: number; leads: number; purchases: number }>,
  leads: Array<{ channel_attribution: unknown }>,
) {
  const byChannel = new Map<string, { channel: string; spend: number; reach: number; leads: number; purchases: number }>();
  for (const kpi of kpis) {
    const channel = kpi.channel || 'manual';
    const row = ensureChannel(byChannel, channel);
    row.spend += decimalToNumber(kpi.spend) || 0;
    row.reach += kpi.reach;
    row.leads += kpi.leads;
    row.purchases += kpi.purchases;
  }
  for (const lead of leads) {
    const channel = lead.channel_attribution ? String(lead.channel_attribution) : 'manual';
    ensureChannel(byChannel, channel);
  }
  return Array.from(byChannel.values()).map(row => ({
    ...row,
    spend: round2(row.spend),
    costPerLead: row.leads > 0 && row.spend > 0 ? round2(row.spend / row.leads) : null,
    costPerPurchase: row.purchases > 0 && row.spend > 0 ? round2(row.spend / row.purchases) : null,
  })).sort((a, b) => b.spend - a.spend || b.leads - a.leads).slice(0, 12);
}

function summarizeSourceTypes(kpis: Array<{ source_type: unknown; spend: unknown; leads: number; purchases: number }>) {
  const bySource = new Map<string, { sourceType: string; records: number; spend: number; leads: number; purchases: number }>();
  for (const kpi of kpis) {
    const sourceType = String(kpi.source_type);
    const row = bySource.get(sourceType) || { sourceType, records: 0, spend: 0, leads: 0, purchases: 0 };
    row.records += 1;
    row.spend += decimalToNumber(kpi.spend) || 0;
    row.leads += kpi.leads;
    row.purchases += kpi.purchases;
    bySource.set(sourceType, row);
  }
  return Array.from(bySource.values()).map(row => ({ ...row, spend: round2(row.spend) }));
}

function summarizeDisciplines(records: Array<{ status: unknown; priority: unknown }>) {
  return {
    total: records.length,
    active: records.filter(record => String(record.status) === 'active').length,
    blocked: records.filter(record => String(record.status) === 'blocked').length,
    completed: records.filter(record => String(record.status) === 'completed').length,
    critical: records.filter(record => String(record.priority) === 'critical').length,
  };
}

function summarizeConnectorReadiness(jobs: Array<{ state: unknown; sync_status: unknown; last_sync_at: Date | null }>) {
  const lastSyncAt = latestDate(jobs.map(job => job.last_sync_at).filter((value): value is Date => Boolean(value)));
  return {
    jobs: jobs.length,
    readyForSync: jobs.filter(job => String(job.sync_status) === 'ready_for_sync' || String(job.state) === 'test_passed').length,
    synced: jobs.filter(job => String(job.sync_status) === 'synced').length,
    blocked: jobs.filter(job => ['blocked', 'failed'].includes(String(job.sync_status)) || String(job.state) === 'blocked').length,
    lastSyncAt,
  };
}

function getMissingSources(input: {
  plans: number;
  events: number;
  kpis: number;
  leads: number;
  connectorJobs: number;
  schedules: number;
  customerThresholdsConfigured: boolean;
}) {
  const missing: string[] = [];
  if (input.plans === 0) missing.push('No commercial plans exist for the selected filters.');
  if (input.events === 0) missing.push('No customer-visible events are linked for the selected filters.');
  if (input.kpis === 0) missing.push('No KPI records from manual import or connectors are available.');
  if (input.leads === 0) missing.push('No lead or purchase records are available from CRM or lead capture.');
  if (input.connectorJobs === 0) missing.push('No connector dry-run or sync jobs are recorded yet.');
  if (input.schedules === 0) missing.push('No executive report schedule is configured yet.');
  if (!input.customerThresholdsConfigured) missing.push('Customer-specific KPI thresholds are not finalized; default alert thresholds are being used.');
  return missing;
}

function buildAlerts(input: {
  metrics: ExecutiveMetricSummary;
  missingSources: string[];
  signals: Array<{ severity: unknown; title: string; recommended_action: string | null }>;
  disciplineSummary: { blocked: number; critical: number };
  connectorReadiness: { blocked: number };
  eventIdsWithPlans: number;
  kpiRecords: number;
  leadRecords: number;
}): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];
  if (input.missingSources.length > 0) {
    alerts.push({
      code: 'missing_sources',
      severity: 'watch',
      title: 'Missing reporting sources',
      detail: `${input.missingSources.length} source or configuration item(s) are missing.`,
      recommendedAction: 'Connect/import the missing data sources or confirm that they are intentionally out of scope.',
    });
  }
  if (input.metrics.plannedBudget > 0 && input.metrics.knownSpend > input.metrics.plannedBudget) {
    alerts.push({
      code: 'budget_overrun',
      severity: 'risk',
      title: 'Spend is above planned budget',
      detail: `Known spend is ${round2(input.metrics.knownSpend - input.metrics.plannedBudget)} above planned budget.`,
      recommendedAction: 'Review channel spend and pause low-efficiency campaigns before increasing budget.',
    });
  }
  if (input.metrics.leads > 0 && input.metrics.leadToPurchaseRate != null && input.metrics.leadToPurchaseRate < 2) {
    alerts.push({
      code: 'low_purchase_conversion',
      severity: 'risk',
      title: 'Purchase conversion is low',
      detail: `Lead-to-purchase rate is ${input.metrics.leadToPurchaseRate}%.`,
      recommendedAction: 'Review offer, follow-up speed, objections, and sales handoff for this period.',
    });
  }
  if (input.metrics.meetingsBooked > 0 && input.metrics.noShows / input.metrics.meetingsBooked > 0.2) {
    alerts.push({
      code: 'high_no_show_rate',
      severity: 'risk',
      title: 'No-show rate needs attention',
      detail: `${input.metrics.noShows} no-show(s) out of ${input.metrics.meetingsBooked} booked meeting(s).`,
      recommendedAction: 'Add reminder workflow, confirmation messaging, and same-day follow-up.',
    });
  }
  if (input.metrics.costPerLead != null && input.metrics.costPerLead > 0 && input.kpiRecords > 0 && input.leadRecords === 0) {
    alerts.push({
      code: 'lead_source_gap',
      severity: 'watch',
      title: 'Spend exists but CRM leads are missing',
      detail: 'KPI records show spend/leads, but CRM lead records have not been mirrored.',
      recommendedAction: 'Run GHL/Formaloo read-sync once customer credentials and mappings are available.',
    });
  }
  if (input.disciplineSummary.blocked > 0 || input.disciplineSummary.critical > 0) {
    alerts.push({
      code: 'blocked_department_work',
      severity: input.disciplineSummary.critical > 0 ? 'critical' : 'risk',
      title: 'Department work has blockers',
      detail: `${input.disciplineSummary.blocked} blocked work item(s), ${input.disciplineSummary.critical} critical item(s).`,
      recommendedAction: 'Open department workspaces and assign owners for blocked commercial tasks.',
    });
  }
  if (input.connectorReadiness.blocked > 0) {
    alerts.push({
      code: 'connector_blocked',
      severity: 'watch',
      title: 'Connector setup has blocked jobs',
      detail: `${input.connectorReadiness.blocked} connector job(s) are blocked.`,
      recommendedAction: 'Review Connector Setup and resolve customer credential or mapping blockers.',
    });
  }
  for (const signal of input.signals.slice(0, 4)) {
    alerts.push({
      code: 'commercial_signal',
      severity: String(signal.severity) === 'critical' ? 'critical' : String(signal.severity) === 'risk' ? 'risk' : 'watch',
      title: signal.title,
      detail: 'Open commercial assessment signal requires review.',
      recommendedAction: signal.recommended_action || 'Assign an owner and record the next action.',
    });
  }
  if (input.eventIdsWithPlans === 0 && input.metrics.plannedRevenueTarget > 0) {
    alerts.push({
      code: 'plan_event_bridge_missing',
      severity: 'watch',
      title: 'Commercial plans are not linked to operating events',
      detail: 'Revenue targets exist, but no selected event bridge is visible for execution tracking.',
      recommendedAction: 'Link commercial plans to the event or campaign they support.',
    });
  }
  return alerts.slice(0, 12);
}

function buildFreshness(
  kpis: Array<{ metric_date: Date }>,
  leads: Array<{ external_last_synced_at: Date | null; created_at: Date }>,
  connectors: Array<{ last_sync_at: Date | null; last_dry_run_at: Date | null }>,
  disciplineRecords: Array<{ updated_at: Date }>,
) {
  const rows = [
    {
      source: 'KPI records',
      lastSeenAt: latestDate(kpis.map(row => row.metric_date)),
      missingDetail: 'No KPI records have been imported or entered for this filter.',
    },
    {
      source: 'CRM and leads',
      lastSeenAt: latestDate(leads.map(row => row.external_last_synced_at || row.created_at)),
      missingDetail: 'No CRM or lead capture records are available for this filter.',
    },
    {
      source: 'Connector jobs',
      lastSeenAt: latestDate(connectors.map(row => row.last_sync_at || row.last_dry_run_at).filter((value): value is Date => Boolean(value))),
      missingDetail: 'No connector dry-run or sync evidence is available.',
    },
    {
      source: 'Department work',
      lastSeenAt: latestDate(disciplineRecords.map(row => row.updated_at)),
      missingDetail: 'No department work records are available.',
    },
  ];
  return rows.map(row => {
    if (!row.lastSeenAt) {
      return { source: row.source, status: 'missing' as const, lastSeenAt: null, detail: row.missingDetail };
    }
    const ageDays = (Date.now() - row.lastSeenAt.getTime()) / 86_400_000;
    return {
      source: row.source,
      status: ageDays > 14 ? 'stale' as const : 'current' as const,
      lastSeenAt: row.lastSeenAt,
      detail: ageDays > 14 ? 'Data exists but is older than 14 days.' : 'Recent data is available.',
    };
  });
}

function getConfidence(
  kpis: Array<{ source_type: unknown }>,
  leads: unknown[],
  connectorJobs: Array<{ sync_status: unknown }>,
): ExecutiveDashboard['confidence'] {
  const hasConnectorKpis = kpis.some(row => String(row.source_type) === 'connector');
  const hasImportedKpis = kpis.some(row => ['connector', 'imported'].includes(String(row.source_type)));
  const hasSyncedConnector = connectorJobs.some(job => String(job.sync_status) === 'synced');
  if (hasConnectorKpis && leads.length > 0 && hasSyncedConnector) return 'high';
  if ((hasImportedKpis || kpis.length > 0) && leads.length > 0) return 'medium';
  return 'low';
}

function mapReport(report: {
  id: string;
  cadence: unknown;
  period_start: Date;
  period_end: Date;
  timezone: string;
  status: unknown;
  title: string;
  summary: string | null;
  metrics: unknown;
  alerts: unknown;
  missing_sources: unknown;
  confidence: string;
  created_at: Date;
}): ExecutiveReportSummary {
  return {
    id: report.id,
    cadence: String(report.cadence) as ExecutiveReportSummary['cadence'],
    periodStart: report.period_start,
    periodEnd: report.period_end,
    timezone: report.timezone,
    status: String(report.status) as ExecutiveReportSummary['status'],
    title: report.title,
    summary: report.summary,
    metrics: report.metrics,
    alerts: report.alerts,
    missingSources: report.missing_sources,
    confidence: report.confidence,
    createdAt: report.created_at,
  };
}

function mapSchedule(schedule: {
  id: string;
  cadence: unknown;
  timezone: string;
  recipients: string[];
  delivery_channels: unknown[];
  status: unknown;
  approval_required: boolean;
  next_run_at: Date | null;
  last_preview_report_id: string | null;
  created_at: Date;
}): ExecutiveReportScheduleSummary {
  return {
    id: schedule.id,
    cadence: String(schedule.cadence) as ExecutiveReportScheduleSummary['cadence'],
    timezone: schedule.timezone,
    recipients: schedule.recipients,
    deliveryChannels: schedule.delivery_channels.map(String) as ExecutiveReportScheduleSummary['deliveryChannels'],
    status: String(schedule.status) as ExecutiveReportScheduleSummary['status'],
    approvalRequired: schedule.approval_required,
    nextRunAt: schedule.next_run_at,
    lastPreviewReportId: schedule.last_preview_report_id,
    createdAt: schedule.created_at,
  };
}

function inferPeriod(cadence: ExecutiveReportCadence, startDate?: Date, endDate?: Date) {
  const end = endDate || new Date();
  const start = startDate || new Date(end);
  if (!startDate) {
    const days = cadence === 'daily' ? 1 : cadence === 'weekly' ? 7 : cadence === 'monthly' ? 30 : cadence === 'quarterly' ? 90 : cadence === 'annual' ? 365 : 30;
    start.setUTCDate(start.getUTCDate() - days);
  }
  return { startDate: start, endDate: end };
}

function dateWhere(startDate?: Date, endDate?: Date): Prisma.DateTimeFilter {
  const where: Prisma.DateTimeFilter = {};
  if (startDate) where.gte = startDate;
  if (endDate) where.lte = endDate;
  return where;
}

function ensureRevenueLine(map: Map<string, ReturnType<typeof emptyRevenueLine>>, type: string, name: string) {
  const existing = map.get(type);
  if (existing) return existing;
  const row = emptyRevenueLine(type, name);
  map.set(type, row);
  return row;
}

function emptyRevenueLine(type: string, name: string) {
  return {
    type,
    name,
    status: 'active',
    plannedRevenueTarget: 0,
    plannedBudget: 0,
    knownRevenue: 0,
    knownSpend: 0,
    leads: 0,
    purchases: 0,
  };
}

function ensureChannel(map: Map<string, { channel: string; spend: number; reach: number; leads: number; purchases: number }>, channel: string) {
  const existing = map.get(channel);
  if (existing) return existing;
  const row = { channel, spend: 0, reach: 0, leads: 0, purchases: 0 };
  map.set(channel, row);
  return row;
}

function buildExecutiveSummary(dashboard: ExecutiveDashboard): string {
  const alerts = dashboard.alerts.filter(alert => ['risk', 'critical'].includes(alert.severity)).length;
  return `Known revenue ${dashboard.metrics.knownRevenue}, spend ${dashboard.metrics.knownSpend}, leads ${dashboard.metrics.leads}, purchases ${dashboard.metrics.purchases}. Confidence is ${dashboard.confidence}. ${alerts} risk/critical alert(s) need executive attention.`;
}

function isCustomerVisibleRecordName(name: string): boolean {
  return !CUSTOMER_VISIBLE_TEST_NAME_PATTERN.test(name);
}

function latestDate(values: Date[]): Date | null {
  if (!values.length) return null;
  return new Date(Math.max(...values.map(value => value.getTime())));
}

function sumDecimal<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + (decimalToNumber(row[key]) || 0), 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toJsonObject(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function toJsonArray(value: unknown[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? [])) as Prisma.InputJsonValue;
}
