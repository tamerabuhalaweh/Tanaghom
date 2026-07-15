import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  COMMERCIAL_CURRENCIES,
  REVENUE_LINE_CATALOG,
  type CommercialAssessmentSignalSummary,
  type CommercialCommandCenterDashboard,
  type CommercialEventBridgeSummary,
  type CommercialOperatingStage,
  type CommercialPlanSummary,
  type CommercialRevenueLineDashboard,
  type CommercialRevenueLineType,
  type CommercialRevenueLineSummary,
  type CreateAssessmentSignalInput,
  type CreateCommercialPlanInput,
  type CreateRevenueLineInput,
  type DashboardQueryInput,
  type ListAssessmentSignalsQueryInput,
  type ListPlansQueryInput,
  type UpdateCommercialPlanInput,
} from './types';

export async function listRevenueLines(tenantKey: string): Promise<CommercialRevenueLineSummary[]> {
  const lines = await prisma.commercialRevenueLine.findMany({
    where: { tenant_key: tenantKey },
    include: {
      _count: {
        select: {
          plans: true,
          assessment_signals: { where: { status: { in: ['open', 'reviewing'] } } },
        },
      },
    },
    orderBy: { revenue_line_type: 'asc' },
  });
  return mergeRevenueLineCatalog(tenantKey, lines.map(mapRevenueLine));
}

export async function createRevenueLine(
  tenantKey: string,
  userId: string,
  input: CreateRevenueLineInput,
): Promise<CommercialRevenueLineSummary> {
  if (input.ownerUserId) await assertUserInTenant(tenantKey, input.ownerUserId);

  const line = await prisma.commercialRevenueLine.upsert({
    where: {
      tenant_key_revenue_line_type: {
        tenant_key: tenantKey,
        revenue_line_type: input.revenueLineType,
      },
    },
    update: {
      name: input.name,
      description: input.description ?? null,
      status: input.status || 'active',
      system_of_record: input.systemOfRecord || 'tanaghum',
      owner_user_id: input.ownerUserId ?? null,
    },
    create: {
      tenant_key: tenantKey,
      revenue_line_type: input.revenueLineType,
      name: input.name,
      description: input.description ?? null,
      status: input.status || 'active',
      system_of_record: input.systemOfRecord || 'tanaghum',
      owner_user_id: input.ownerUserId ?? null,
      created_by_user_id: userId,
    },
    include: {
      _count: {
        select: {
          plans: true,
          assessment_signals: { where: { status: { in: ['open', 'reviewing'] } } },
        },
      },
    },
  });

  return mapRevenueLine(line);
}

export async function listPlans(tenantKey: string, filters: ListPlansQueryInput): Promise<CommercialPlanSummary[]> {
  const where: Prisma.CommercialPlanWhereInput = { tenant_key: tenantKey };
  if (filters.revenueLineId) where.revenue_line_id = filters.revenueLineId;
  if (filters.stage) where.stage = filters.stage;
  if (filters.horizon) where.horizon = filters.horizon;
  if (filters.status) where.status = filters.status;

  const plans = await prisma.commercialPlan.findMany({
    where,
    include: planInclude,
    orderBy: { updated_at: 'desc' },
    take: 100,
  });

  return plans.map(mapPlan);
}

export async function createPlan(
  tenantKey: string,
  userId: string,
  input: CreateCommercialPlanInput,
): Promise<CommercialPlanSummary> {
  await assertRevenueLineInTenant(tenantKey, input.revenueLineId);
  if (input.linkedEventId) await assertEventInTenant(tenantKey, input.linkedEventId);
  if (input.ownerUserId) await assertUserInTenant(tenantKey, input.ownerUserId);
  const defaultCurrency = input.currency || await getTenantDefaultCurrency(tenantKey);

  const plan = await prisma.commercialPlan.create({
    data: {
      tenant_key: tenantKey,
      revenue_line_id: input.revenueLineId,
      linked_event_id: input.linkedEventId ?? null,
      horizon: input.horizon,
      stage: input.stage || 'strategy_planning',
      title: input.title,
      objective: input.objective ?? null,
      audience: input.audience ?? null,
      currency: defaultCurrency,
      budget_target: input.budgetTarget != null ? new Prisma.Decimal(input.budgetTarget) : null,
      revenue_target: input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null,
      kpi_targets: input.kpiTargets == null ? Prisma.JsonNull : toJsonObject(input.kpiTargets),
      strategy_summary: input.strategySummary ?? null,
      action_plan: input.actionPlan ?? null,
      status: input.status || 'draft',
      owner_user_id: input.ownerUserId ?? null,
      created_by_user_id: userId,
    },
    include: planInclude,
  });

  return mapPlan(plan);
}

export async function updatePlan(
  tenantKey: string,
  id: string,
  input: UpdateCommercialPlanInput,
): Promise<CommercialPlanSummary> {
  const existing = await prisma.commercialPlan.findFirst({
    where: { id, tenant_key: tenantKey },
    select: { id: true, revenue_line_id: true },
  });
  if (!existing) throw new NotFoundError('CommercialPlan', id);

  if (input.revenueLineId) await assertRevenueLineInTenant(tenantKey, input.revenueLineId);
  if (input.linkedEventId) await assertEventInTenant(tenantKey, input.linkedEventId);
  if (input.ownerUserId) await assertUserInTenant(tenantKey, input.ownerUserId);

  const plan = await prisma.commercialPlan.update({
    where: { id },
    data: {
      ...(input.revenueLineId !== undefined ? { revenue_line_id: input.revenueLineId } : {}),
      ...(input.linkedEventId !== undefined ? { linked_event_id: input.linkedEventId } : {}),
      ...(input.horizon !== undefined ? { horizon: input.horizon } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.objective !== undefined ? { objective: input.objective } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.budgetTarget !== undefined ? { budget_target: input.budgetTarget != null ? new Prisma.Decimal(input.budgetTarget) : null } : {}),
      ...(input.revenueTarget !== undefined ? { revenue_target: input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null } : {}),
      ...(input.kpiTargets !== undefined ? { kpi_targets: input.kpiTargets == null ? Prisma.JsonNull : toJsonObject(input.kpiTargets) } : {}),
      ...(input.strategySummary !== undefined ? { strategy_summary: input.strategySummary } : {}),
      ...(input.actionPlan !== undefined ? { action_plan: input.actionPlan } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
    },
    include: planInclude,
  });

  return mapPlan(plan);
}

export async function listAssessmentSignals(
  tenantKey: string,
  filters: ListAssessmentSignalsQueryInput,
): Promise<CommercialAssessmentSignalSummary[]> {
  const where: Prisma.CommercialAssessmentSignalWhereInput = { tenant_key: tenantKey };
  if (filters.revenueLineId) where.revenue_line_id = filters.revenueLineId;
  if (filters.commercialPlanId) where.commercial_plan_id = filters.commercialPlanId;
  if (filters.status) where.status = filters.status;

  const signals = await prisma.commercialAssessmentSignal.findMany({
    where,
    include: assessmentSignalInclude,
    orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
    take: 100,
  });

  return signals.map(mapAssessmentSignal);
}

export async function createAssessmentSignal(
  tenantKey: string,
  userId: string,
  input: CreateAssessmentSignalInput,
): Promise<CommercialAssessmentSignalSummary> {
  let revenueLineId = input.revenueLineId ?? null;

  if (input.commercialPlanId) {
    const plan = await prisma.commercialPlan.findFirst({
      where: { id: input.commercialPlanId, tenant_key: tenantKey },
      select: { id: true, revenue_line_id: true },
    });
    if (!plan) throw new NotFoundError('CommercialPlan', input.commercialPlanId);
    if (revenueLineId && revenueLineId !== plan.revenue_line_id) {
      throw new ValidationError('Assessment signal revenue line must match the selected commercial plan');
    }
    revenueLineId = plan.revenue_line_id;
  }

  if (revenueLineId) await assertRevenueLineInTenant(tenantKey, revenueLineId);

  const signal = await prisma.commercialAssessmentSignal.create({
    data: {
      tenant_key: tenantKey,
      revenue_line_id: revenueLineId,
      commercial_plan_id: input.commercialPlanId ?? null,
      source_type: input.sourceType || 'manual',
      title: input.title,
      severity: input.severity || 'watch',
      finding: input.finding ?? null,
      recommended_action: input.recommendedAction ?? null,
      status: input.status || 'open',
      created_by_user_id: userId,
    },
    include: assessmentSignalInclude,
  });

  return mapAssessmentSignal(signal);
}

export async function getDashboard(
  tenantKey: string,
  filters: DashboardQueryInput,
): Promise<CommercialCommandCenterDashboard> {
  const [defaultCurrency, revenueLines, plans, signals, eventCounts] = await Promise.all([
    getTenantDefaultCurrency(tenantKey),
    listRevenueLines(tenantKey),
    listPlans(tenantKey, {
      stage: filters.stage,
      revenueLineId: undefined,
      horizon: undefined,
      status: undefined,
    }),
    listAssessmentSignals(tenantKey, { status: undefined }),
    prisma.commercialEvent.groupBy({
      by: ['status'],
      where: { tenant_key: tenantKey },
      _count: { _all: true },
    }),
  ]);

  const activePlans = plans.filter(plan => plan.status === 'active').length;
  const draftPlans = plans.filter(plan => plan.status === 'draft').length;
  const linkedToEvents = plans.filter(plan => plan.linkedEventId).length;
  const openSignals = signals.filter(signal => ['open', 'reviewing'].includes(signal.status));
  const stageSummary: Record<CommercialOperatingStage, number> = {
    assess: 0,
    strategy_planning: 0,
    implementation_engagement: 0,
  };
  for (const plan of plans) {
    stageSummary[plan.stage] += 1;
  }

  return {
    defaultCurrency,
    revenueLines: filters.revenueLineType
      ? revenueLines.filter(line => line.revenueLineType === filters.revenueLineType)
      : revenueLines,
    stageSummary,
    planSummary: {
      total: plans.length,
      active: activePlans,
      draft: draftPlans,
      linkedToEvents,
    },
    signalSummary: {
      open: openSignals.length,
      critical: openSignals.filter(signal => signal.severity === 'critical').length,
      risk: openSignals.filter(signal => signal.severity === 'risk').length,
    },
    recentPlans: plans.slice(0, 6),
    openSignals: openSignals.slice(0, 6),
    eventBridge: {
      activeEvents: getGroupedCount(eventCounts, 'active'),
      planningEvents: getGroupedCount(eventCounts, 'planning'),
      completedEvents: getGroupedCount(eventCounts, 'completed'),
      eventSectionPath: '/events',
    },
    stitchi: {
      supported: true,
      suggestedPrompt: 'Ask Stitchi to assess a revenue line, prepare a quarterly plan, or create an action item for this commercial workflow.',
    },
  };
}

export async function getRevenueLineDashboard(
  tenantKey: string,
  revenueLineType: CommercialRevenueLineType,
): Promise<CommercialRevenueLineDashboard> {
  const catalogLine = REVENUE_LINE_CATALOG.find(line => line.type === revenueLineType);
  if (!catalogLine) throw new NotFoundError('CommercialRevenueLineType', revenueLineType);
  const defaultCurrency = await getTenantDefaultCurrency(tenantKey);

  const configuredLine = await prisma.commercialRevenueLine.findUnique({
    where: {
      tenant_key_revenue_line_type: {
        tenant_key: tenantKey,
        revenue_line_type: revenueLineType,
      },
    },
    include: {
      _count: {
        select: {
          plans: true,
          assessment_signals: { where: { status: { in: ['open', 'reviewing'] } } },
        },
      },
    },
  });
  const revenueLine = configuredLine
    ? mapRevenueLine(configuredLine)
    : mergeRevenueLineCatalog(tenantKey, [])[REVENUE_LINE_CATALOG.findIndex(line => line.type === revenueLineType)];

  const plans = configuredLine
    ? await listPlans(tenantKey, { revenueLineId: configuredLine.id })
    : [];
  const planIds = plans.map(plan => plan.id);
  const planEventIds = [...new Set(plans.map(plan => plan.linkedEventId).filter((id): id is string => Boolean(id)))];
  const plansByEvent = new Map<string, CommercialPlanSummary[]>();
  for (const plan of plans) {
    if (!plan.linkedEventId) continue;
    const current = plansByEvent.get(plan.linkedEventId) || [];
    current.push(plan);
    plansByEvent.set(plan.linkedEventId, current);
  }
  const eventSelect = {
    id: true,
    name: true,
    status: true,
    event_type: true,
    event_date: true,
    planned_budget: true,
    revenue_target: true,
  } as const;

  const rawLinkedEvents = await prisma.commercialEvent.findMany({
    where: revenueLineType === 'live_event'
      ? { tenant_key: tenantKey }
      : { tenant_key: tenantKey, id: { in: planEventIds } },
    select: eventSelect,
    orderBy: { event_date: 'desc' },
    take: 50,
  });
  const linkedEvents = rawLinkedEvents.filter(event => isCustomerVisibleRecordName(event.name));
  const rawAvailableEvents = revenueLineType === 'live_event'
    ? rawLinkedEvents
    : await prisma.commercialEvent.findMany({
      where: { tenant_key: tenantKey },
      select: eventSelect,
      orderBy: { event_date: 'desc' },
      take: 100,
    });
  const availableEvents = rawAvailableEvents.filter(event => isCustomerVisibleRecordName(event.name));
  const eventIds = linkedEvents.map(event => event.id);

  const [signals, kpis, leads, connectorJobs, learningSets] = await Promise.all([
    configuredLine
      ? prisma.commercialAssessmentSignal.findMany({
        where: {
          tenant_key: tenantKey,
          status: { in: ['open', 'reviewing'] },
          OR: [
            { revenue_line_id: configuredLine.id },
            ...(planIds.length ? [{ commercial_plan_id: { in: planIds } }] : []),
          ],
        },
        include: assessmentSignalInclude,
        orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
        take: 20,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.eventKpiRecord.findMany({
        where: { tenant_key: tenantKey, event_id: { in: eventIds } },
        select: {
          source_type: true,
          spend: true,
          leads: true,
          meetings_booked: true,
          meetings_attended: true,
          purchases: true,
          no_shows: true,
        },
        take: 1000,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.leadCaptureRecord.findMany({
        where: { tenant_key: tenantKey, event_id: { in: eventIds } },
        select: {
          lead_status: true,
          purchase_amount: true,
          meeting_date: true,
          meeting_outcome: true,
        },
        take: 1000,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.connectorImportJob.findMany({
        where: { tenant_key: tenantKey, event_id: { in: eventIds } },
        select: { state: true, sync_status: true },
        take: 200,
      })
      : Promise.resolve([]),
    configuredLine
      ? prisma.commercialLearningSet.findMany({
        where: {
          tenant_key: tenantKey,
          status: 'active',
          OR: [
            { assessment_run: { revenue_line_id: configuredLine.id } },
            { assessment_run: { revenue_line_id: null } },
          ],
        },
        select: {
          approved_at: true,
          assessment_run: { select: { title: true } },
          findings: {
            where: { decision: 'approved' },
            select: {
              id: true,
              finding_type: true,
              title: true,
              recommendation: true,
              confidence: true,
            },
            orderBy: { created_at: 'asc' },
            take: 12,
          },
        },
        orderBy: { approved_at: 'desc' },
        take: 5,
      })
      : Promise.resolve([]),
  ]);

  const plannedRevenueTarget = plans.reduce((total, plan) => total + (plan.revenueTarget || 0), 0)
    || linkedEvents.reduce((total, event) => total + (decimalToNumber(event.revenue_target) || 0), 0);
  const plannedBudget = plans.reduce((total, plan) => total + (plan.budgetTarget || 0), 0)
    || linkedEvents.reduce((total, event) => total + (decimalToNumber(event.planned_budget) || 0), 0);
  const currencyBreakdown = buildCurrencyBreakdown(plans);
  const uniquePlanCurrencies = [...new Set(plans.map(plan => plan.currency))];
  const knownSpend = kpis.reduce((total, row) => total + (decimalToNumber(row.spend) || 0), 0);
  const knownRevenue = leads.reduce((total, lead) => total + (decimalToNumber(lead.purchase_amount) || 0), 0);
  const kpiLeads = kpis.reduce((total, row) => total + row.leads, 0);
  const leadRecords = leads.length;
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
    leads.filter(lead => String(lead.meeting_outcome).toLowerCase().includes('attended')).length,
  );
  const noShows = Math.max(
    kpis.reduce((total, row) => total + row.no_shows, 0),
    leads.filter(lead => String(lead.lead_status) === 'no_show' || String(lead.meeting_outcome).toLowerCase().includes('no_show')).length,
  );
  const totalLeads = Math.max(kpiLeads, leadRecords);

  const missingDataSources: string[] = [];
  if (!revenueLine.configured) missingDataSources.push('Configure this revenue line before planning work can be saved.');
  if (!eventIds.length) missingDataSources.push('Link an event or campaign so this revenue line has operating data.');
  if (!kpis.length) missingDataSources.push('Connect analytics or import KPI records to calculate spend, reach and efficiency.');
  if (!leads.length) missingDataSources.push('Connect CRM or capture leads so the funnel can show real lead and purchase movement.');
  if (!connectorJobs.length) missingDataSources.push('Set up connector dry-runs for this revenue line when customer credentials are available.');

  return {
    defaultCurrency,
    revenueLine,
    rollups: {
      plannedRevenueTarget,
      knownRevenue,
      currency: uniquePlanCurrencies.length === 0 ? defaultCurrency : uniquePlanCurrencies.length === 1 ? uniquePlanCurrencies[0] : 'mixed',
      currencyBreakdown,
      plannedBudget,
      knownSpend,
      budgetVariance: plannedBudget > 0 ? round2(plannedBudget - knownSpend) : null,
      leads: totalLeads,
      purchases,
      meetingsBooked,
      meetingsAttended,
      noShows,
      costPerLead: totalLeads > 0 && knownSpend > 0 ? round2(knownSpend / totalLeads) : null,
      costPerPurchase: purchases > 0 && knownSpend > 0 ? round2(knownSpend / purchases) : null,
      leadToPurchaseRate: totalLeads > 0 ? round2((purchases / totalLeads) * 100) : null,
    },
    dataStatus: {
      hasLinkedEvents: eventIds.length > 0,
      hasKpiRecords: kpis.length > 0,
      hasLeadRecords: leads.length > 0,
      hasConnectorRecords: kpis.some(row => String(row.source_type) === 'connector'),
      missingDataSources,
    },
    plans,
    approvedLearning: learningSets.flatMap(set => set.findings.map(finding => ({
      id: finding.id,
      type: String(finding.finding_type) as 'repeat' | 'improve' | 'avoid' | 'investigate',
      title: finding.title,
      recommendation: finding.recommendation,
      confidence: decimalToNumber(finding.confidence) || 0,
      assessmentTitle: set.assessment_run.title,
      approvedAt: set.approved_at.toISOString(),
    }))).slice(0, 12),
    openSignals: signals.map(mapAssessmentSignal),
    linkedEvents: linkedEvents.map(event => mapEventBridge(event, plansByEvent.get(event.id))),
    availableEvents: availableEvents.map(event => mapEventBridge(event, plansByEvent.get(event.id))),
    connectorStatus: {
      jobs: connectorJobs.length,
      readyForSync: connectorJobs.filter(job => String(job.sync_status) === 'ready_for_sync' || String(job.state) === 'test_passed').length,
      synced: connectorJobs.filter(job => String(job.sync_status) === 'synced').length,
      blocked: connectorJobs.filter(job => ['blocked', 'failed'].includes(String(job.sync_status)) || String(job.state) === 'blocked').length,
    },
    nextAction: chooseNextAction(revenueLine.configured, eventIds.length, kpis.length, leads.length, plans.length),
    reporting: {
      primaryDimension: 'revenue_line',
      countryGrouping: false,
      supportedCurrencies: [...COMMERCIAL_CURRENCIES],
    },
  };
}

export async function getTenantDefaultCurrency(tenantKey: string): Promise<(typeof COMMERCIAL_CURRENCIES)[number]> {
  const tenant = await prisma.tenant.findUnique({
    where: { tenant_key: tenantKey },
    select: { default_currency: true },
  });
  const value = String(tenant?.default_currency || 'AED');
  return COMMERCIAL_CURRENCIES.includes(value as (typeof COMMERCIAL_CURRENCIES)[number])
    ? value as (typeof COMMERCIAL_CURRENCIES)[number]
    : 'AED';
}

async function assertRevenueLineInTenant(tenantKey: string, id: string): Promise<void> {
  const line = await prisma.commercialRevenueLine.findFirst({ where: { id, tenant_key: tenantKey }, select: { id: true } });
  if (!line) throw new NotFoundError('CommercialRevenueLine', id);
}

async function assertEventInTenant(tenantKey: string, id: string): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey }, select: { id: true } });
  if (!event) throw new NotFoundError('CommercialEvent', id);
}

async function assertUserInTenant(tenantKey: string, id: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id, tenant_key: tenantKey }, select: { id: true } });
  if (!user) throw new NotFoundError('User', id);
}

const planInclude = {
  revenue_line: { select: { id: true, revenue_line_type: true, name: true } },
  linked_event: { select: { id: true, name: true } },
} as const;

const assessmentSignalInclude = {
  revenue_line: { select: { id: true, revenue_line_type: true } },
} as const;

function mergeRevenueLineCatalog(
  tenantKey: string,
  configuredLines: CommercialRevenueLineSummary[],
): CommercialRevenueLineSummary[] {
  const byType = new Map(configuredLines.map(line => [line.revenueLineType, line]));
  return REVENUE_LINE_CATALOG.map(catalogLine => {
    const configured = byType.get(catalogLine.type);
    if (configured) return configured;
    return {
      id: null,
      tenantKey,
      revenueLineType: catalogLine.type,
      name: catalogLine.label,
      description: catalogLine.purpose,
      status: 'not_configured',
      availability: catalogLine.availability,
      systemOfRecord: 'tanaghum',
      ownerUserId: null,
      configured: false,
      planCount: 0,
      openSignalCount: 0,
      createdAt: null,
      updatedAt: null,
    };
  });
}

function mapRevenueLine(line: {
  id: string;
  tenant_key: string;
  revenue_line_type: unknown;
  name: string;
  description: string | null;
  status: unknown;
  system_of_record: string;
  owner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  _count?: { plans?: number; assessment_signals?: number };
}): CommercialRevenueLineSummary {
  return {
    id: line.id,
    tenantKey: line.tenant_key,
    revenueLineType: String(line.revenue_line_type) as CommercialRevenueLineSummary['revenueLineType'],
    name: line.name,
    description: line.description,
    status: String(line.status) as CommercialRevenueLineSummary['status'],
    availability: REVENUE_LINE_CATALOG.find(catalogLine => catalogLine.type === String(line.revenue_line_type))?.availability || 'future',
    systemOfRecord: line.system_of_record,
    ownerUserId: line.owner_user_id,
    configured: true,
    planCount: line._count?.plans || 0,
    openSignalCount: line._count?.assessment_signals || 0,
    createdAt: line.created_at,
    updatedAt: line.updated_at,
  };
}

function mapPlan(plan: {
  id: string;
  tenant_key: string;
  revenue_line_id: string;
  revenue_line: { revenue_line_type: unknown; name: string };
  linked_event_id: string | null;
  linked_event: { name: string } | null;
  horizon: unknown;
  stage: unknown;
  title: string;
  objective: string | null;
  audience: string | null;
  currency?: unknown;
  budget_target: unknown;
  revenue_target: unknown;
  kpi_targets: unknown;
  strategy_summary: string | null;
  action_plan: string | null;
  status: unknown;
  owner_user_id: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}): CommercialPlanSummary {
  return {
    id: plan.id,
    tenantKey: plan.tenant_key,
    revenueLineId: plan.revenue_line_id,
    revenueLineType: String(plan.revenue_line.revenue_line_type) as CommercialPlanSummary['revenueLineType'],
    revenueLineName: plan.revenue_line.name,
    linkedEventId: plan.linked_event_id,
    linkedEventName: plan.linked_event && isCustomerVisibleRecordName(plan.linked_event.name)
      ? plan.linked_event.name
      : null,
    horizon: String(plan.horizon) as CommercialPlanSummary['horizon'],
    stage: String(plan.stage) as CommercialPlanSummary['stage'],
    title: plan.title,
    objective: plan.objective,
    audience: plan.audience,
    currency: String(plan.currency || 'AED') as CommercialPlanSummary['currency'],
    budgetTarget: decimalToNumber(plan.budget_target),
    revenueTarget: decimalToNumber(plan.revenue_target),
    kpiTargets: plan.kpi_targets,
    strategySummary: plan.strategy_summary,
    actionPlan: plan.action_plan,
    status: String(plan.status) as CommercialPlanSummary['status'],
    ownerUserId: plan.owner_user_id,
    createdByUserId: plan.created_by_user_id,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

function mapAssessmentSignal(signal: {
  id: string;
  tenant_key: string;
  revenue_line_id: string | null;
  revenue_line: { revenue_line_type: unknown } | null;
  commercial_plan_id: string | null;
  source_type: string;
  title: string;
  severity: unknown;
  finding: string | null;
  recommended_action: string | null;
  status: unknown;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}): CommercialAssessmentSignalSummary {
  return {
    id: signal.id,
    tenantKey: signal.tenant_key,
    revenueLineId: signal.revenue_line_id,
    revenueLineType: signal.revenue_line ? String(signal.revenue_line.revenue_line_type) as CommercialAssessmentSignalSummary['revenueLineType'] : null,
    commercialPlanId: signal.commercial_plan_id,
    sourceType: signal.source_type,
    title: signal.title,
    severity: String(signal.severity) as CommercialAssessmentSignalSummary['severity'],
    finding: signal.finding,
    recommendedAction: signal.recommended_action,
    status: String(signal.status) as CommercialAssessmentSignalSummary['status'],
    createdByUserId: signal.created_by_user_id,
    createdAt: signal.created_at,
    updatedAt: signal.updated_at,
  };
}

function getGroupedCount(rows: Array<{ status: unknown; _count: { _all: number } }>, status: string): number {
  return rows.find(row => String(row.status) === status)?._count._all || 0;
}

function chooseNextAction(
  configured: boolean,
  eventCount: number,
  kpiCount: number,
  leadCount: number,
  planCount: number,
): CommercialRevenueLineDashboard['nextAction'] {
  if (!configured) {
    return {
      label: 'Configure revenue line',
      description: 'Set up this revenue line so planning records, ownership, and Stitchi actions can attach to it.',
      path: '/command-center',
    };
  }
  if (planCount === 0) {
    return {
      label: 'Create first plan',
      description: 'Add the first planning item for this revenue line with objective, stage, owner, budget, and expected outcome.',
      path: '/command-center',
    };
  }
  if (eventCount === 0) {
    return {
      label: 'Link operating work',
      description: 'Connect an event or campaign so this revenue line can show execution progress and outcomes.',
      path: '/events',
    };
  }
  if (kpiCount === 0) {
    return {
      label: 'Connect performance data',
      description: 'Import KPI records or connect customer-owned analytics credentials to calculate spend and efficiency.',
      path: '/integration-credentials',
    };
  }
  if (leadCount === 0) {
    return {
      label: 'Connect lead source',
      description: 'Connect CRM or lead capture records so purchases, meetings, and follow-up can be tracked.',
      path: '/integration-credentials',
    };
  }
  return {
    label: 'Review next action with Stitchi',
    description: 'Ask Stitchi to summarize risks, next steps, and planning updates based on current commercial data.',
    path: '/stitchi',
  };
}

function mapEventBridge(
  event: {
    id: string;
    name: string;
    status: unknown;
    event_type: unknown;
    event_date: Date;
    planned_budget: unknown;
    revenue_target: unknown;
  },
  plans: CommercialPlanSummary[] = [],
): CommercialEventBridgeSummary {
  return {
    id: event.id,
    name: isCustomerVisibleRecordName(event.name) ? event.name : 'Linked live event',
    status: String(event.status),
    eventType: String(event.event_type),
    eventDate: event.event_date,
    plannedBudget: decimalToNumber(event.planned_budget),
    revenueTarget: decimalToNumber(event.revenue_target),
    linkedPlanCount: plans.length,
    linkedPlanTitles: plans.map(plan => plan.title).slice(0, 4),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCurrencyBreakdown(plans: CommercialPlanSummary[]): CommercialRevenueLineDashboard['rollups']['currencyBreakdown'] {
  const byCurrency = new Map<CommercialPlanSummary['currency'], { plannedRevenueTarget: number; plannedBudget: number; planCount: number }>();
  for (const plan of plans) {
    const current = byCurrency.get(plan.currency) || { plannedRevenueTarget: 0, plannedBudget: 0, planCount: 0 };
    current.plannedRevenueTarget += plan.revenueTarget || 0;
    current.plannedBudget += plan.budgetTarget || 0;
    current.planCount += 1;
    byCurrency.set(plan.currency, current);
  }
  return [...byCurrency.entries()].map(([currency, values]) => ({
    currency,
    plannedRevenueTarget: round2(values.plannedRevenueTarget),
    plannedBudget: round2(values.plannedBudget),
    planCount: values.planCount,
  }));
}

function isCustomerVisibleRecordName(name: string): boolean {
  return !/\b(sprint\s*\d+|acceptance|smoke test|test tenant|customer review event)\b/i.test(name);
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toJsonObject(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
