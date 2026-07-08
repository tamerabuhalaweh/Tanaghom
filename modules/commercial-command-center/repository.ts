import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  REVENUE_LINE_CATALOG,
  type CommercialAssessmentSignalSummary,
  type CommercialCommandCenterDashboard,
  type CommercialOperatingStage,
  type CommercialPlanSummary,
  type CommercialRevenueLineSummary,
  type CreateAssessmentSignalInput,
  type CreateCommercialPlanInput,
  type CreateRevenueLineInput,
  type DashboardQueryInput,
  type ListAssessmentSignalsQueryInput,
  type ListPlansQueryInput,
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

  const plan = await prisma.commercialPlan.create({
    data: {
      tenant_key: tenantKey,
      revenue_line_id: input.revenueLineId,
      linked_event_id: input.linkedEventId ?? null,
      horizon: input.horizon,
      stage: input.stage || 'assess',
      title: input.title,
      objective: input.objective ?? null,
      audience: input.audience ?? null,
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
  const [revenueLines, plans, signals, eventCounts] = await Promise.all([
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
    linkedEventName: plan.linked_event?.name || null,
    horizon: String(plan.horizon) as CommercialPlanSummary['horizon'],
    stage: String(plan.stage) as CommercialPlanSummary['stage'],
    title: plan.title,
    objective: plan.objective,
    audience: plan.audience,
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
