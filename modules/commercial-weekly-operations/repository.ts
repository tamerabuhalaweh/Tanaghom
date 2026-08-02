import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import type {
  CreateWeeklyWorkItemInput,
  TransitionWeeklyWorkItemInput,
  UpdateWeeklyWorkItemInput,
  WeeklyWorkspaceQuery,
  WeeklyWorkspaceSummary,
  WeeklyWorkItemSummary,
  WeeklyWorkLinkType,
} from './types';

const itemInclude = Prisma.validator<Prisma.CommercialWeeklyWorkItemInclude>()({
  owner: { select: { id: true, name: true, role: true } },
});

type WeeklyItemRecord = Prisma.CommercialWeeklyWorkItemGetPayload<{ include: typeof itemInclude }>;
type TransactionClient = Prisma.TransactionClient;

export async function getWeeklyWorkspace(
  tenantKey: string,
  commercialPlanId: string,
  query: WeeklyWorkspaceQuery,
): Promise<WeeklyWorkspaceSummary> {
  const plan = await getPlanContext(prisma, tenantKey, commercialPlanId);
  const selectedWeekStart = normalizeWeekStart(query.weekOf || dateInTimezone(new Date(), plan.tenant.timezone));
  const selectedWeekEnd = addDays(selectedWeekStart, 6);

  const [items, owners, linkOptions, planBudgetAggregate] = await Promise.all([
    prisma.commercialWeeklyWorkItem.findMany({
      where: {
        tenant_key: tenantKey,
        commercial_plan_id: commercialPlanId,
        week_start_date: fromDateOnly(selectedWeekStart),
      },
      include: itemInclude,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { due_date: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.user.findMany({
      where: { tenant_key: tenantKey, is_active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    loadLinkOptions(tenantKey, commercialPlanId, plan),
    prisma.commercialWeeklyWorkItem.aggregate({
      where: {
        tenant_key: tenantKey,
        commercial_plan_id: commercialPlanId,
        status: { not: 'cancelled' },
      },
      _sum: { budget_guardrail: true },
    }),
  ]);

  const mappedItems = items.map(mapItem);
  const activeItems = mappedItems.filter((item) => item.status !== 'cancelled');
  const budgetGuardrail = activeItems.reduce((sum, item) => sum + (item.budgetGuardrail || 0), 0);
  const planBudgetAllocated = Number(planBudgetAggregate._sum.budget_guardrail || 0);
  const planBudget = decimalToNullableNumber(plan.budget_target);

  return {
    timezone: plan.tenant.timezone,
    selectedWeek: {
      startDate: selectedWeekStart,
      endDate: selectedWeekEnd,
      label: formatWeekLabel(selectedWeekStart, selectedWeekEnd, plan.tenant.timezone),
    },
    plan: {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      currency: plan.currency,
      budgetTarget: planBudget,
      revenueTarget: decimalToNullableNumber(plan.revenue_target),
      revenueLineName: plan.revenue_line.name,
      annualPlanId: plan.hierarchy_assignment?.annual_plan.id || null,
      annualPlanTitle: plan.hierarchy_assignment?.annual_plan.title || null,
      annualPlanYear: plan.hierarchy_assignment?.annual_plan.year || null,
      monthlyPortfolioItemId: plan.hierarchy_assignment?.monthly_item.id || null,
      monthlyPortfolioTitle: plan.hierarchy_assignment?.monthly_item.title || null,
      monthlyPortfolioMonth: plan.hierarchy_assignment?.monthly_item.month || null,
      periodStartDate: toDateOnly(plan.hierarchy_assignment?.monthly_item.planned_start_date),
      periodEndDate: toDateOnly(plan.hierarchy_assignment?.monthly_item.planned_end_date),
    },
    rollup: {
      itemCount: mappedItems.length,
      completedCount: mappedItems.filter((item) => item.status === 'completed').length,
      blockedCount: mappedItems.filter((item) => item.status === 'blocked').length,
      awaitingApprovalCount: mappedItems.filter((item) => item.status === 'awaiting_approval').length,
      budgetGuardrail,
      remainingPlanBudget: planBudget == null ? null : Math.max(0, planBudget - planBudgetAllocated),
    },
    owners: owners.map((owner) => ({ id: owner.id, name: owner.name, role: owner.role })),
    linkOptions,
    items: mappedItems,
  };
}

export async function getWeeklyWorkItem(
  tenantKey: string,
  commercialPlanId: string,
  itemId: string,
): Promise<WeeklyWorkItemSummary> {
  const item = await prisma.commercialWeeklyWorkItem.findFirst({
    where: { id: itemId, tenant_key: tenantKey, commercial_plan_id: commercialPlanId },
    include: itemInclude,
  });
  if (!item) throw new NotFoundError('CommercialWeeklyWorkItem', itemId);
  return mapItem(item);
}

export async function createWeeklyWorkItem(
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  input: CreateWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  return prisma.$transaction(async (tx) => {
    const plan = await getPlanContext(tx, tenantKey, commercialPlanId);
    const weekStart = validateWeekAndPeriod(input.weekStartDate, input.startDate, input.dueDate, plan);
    await validateOwner(tx, tenantKey, input.ownerUserId);
    await validateLink(tx, tenantKey, commercialPlanId, input.linkType, input.linkObjectId, plan);
    const currency = input.currency || plan.currency;
    if (currency !== plan.currency) {
      throw new ValidationError(`Weekly budget currency must match the execution plan currency (${plan.currency})`);
    }
    await enforceBudgetGuardrail(tx, tenantKey, commercialPlanId, input.budgetGuardrail, null, plan.budget_target);

    const created = await tx.commercialWeeklyWorkItem.create({
      data: {
        tenant_key: tenantKey,
        commercial_plan_id: commercialPlanId,
        week_start_date: fromDateOnly(weekStart),
        title: input.title,
        business_outcome: input.businessOutcome,
        owner_user_id: input.ownerUserId || null,
        owner_role: input.ownerRole || null,
        start_date: input.startDate ? fromDateOnly(input.startDate) : null,
        due_date: input.dueDate ? fromDateOnly(input.dueDate) : null,
        status: input.status,
        priority: input.priority,
        budget_guardrail: input.budgetGuardrail,
        currency,
        link_type: input.linkType || null,
        link_object_id: input.linkObjectId || null,
        link_label: input.linkLabel || null,
        created_by_user_id: userId,
      },
      include: itemInclude,
    });
    await createAudit(tx, {
      action: 'commercial_weekly_work_created',
      userId,
      itemId: created.id,
      reason: `Weekly work created for ${weekStart}`,
      afterState: auditState(created),
    });
    return mapItem(created);
  });
}

export async function updateWeeklyWorkItem(
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  itemId: string,
  input: UpdateWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  return prisma.$transaction(async (tx) => {
    const [plan, current] = await Promise.all([
      getPlanContext(tx, tenantKey, commercialPlanId),
      tx.commercialWeeklyWorkItem.findFirst({
        where: { id: itemId, tenant_key: tenantKey, commercial_plan_id: commercialPlanId },
        include: itemInclude,
      }),
    ]);
    if (!current) throw new NotFoundError('CommercialWeeklyWorkItem', itemId);
    const weekStart = validateWeekAndPeriod(
      input.weekStartDate || toDateOnly(current.week_start_date)!,
      input.startDate === undefined ? toDateOnly(current.start_date) : input.startDate,
      input.dueDate === undefined ? toDateOnly(current.due_date) : input.dueDate,
      plan,
    );
    await validateOwner(tx, tenantKey, input.ownerUserId);
    const linkType = input.linkType === undefined ? current.link_type : input.linkType;
    const linkObjectId = input.linkObjectId === undefined ? current.link_object_id : input.linkObjectId;
    await validateLink(tx, tenantKey, commercialPlanId, linkType, linkObjectId, plan);
    const currency = input.currency || current.currency;
    if (currency !== plan.currency) {
      throw new ValidationError(`Weekly budget currency must match the execution plan currency (${plan.currency})`);
    }
    await enforceBudgetGuardrail(
      tx,
      tenantKey,
      commercialPlanId,
      input.budgetGuardrail === undefined ? decimalToNullableNumber(current.budget_guardrail) : input.budgetGuardrail,
      itemId,
      plan.budget_target,
    );

    const result = await tx.commercialWeeklyWorkItem.updateMany({
      where: { id: itemId, tenant_key: tenantKey, commercial_plan_id: commercialPlanId, revision: input.expectedRevision },
      data: {
        ...(input.weekStartDate !== undefined ? { week_start_date: fromDateOnly(weekStart) } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.businessOutcome !== undefined ? { business_outcome: input.businessOutcome } : {}),
        ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
        ...(input.ownerRole !== undefined ? { owner_role: input.ownerRole } : {}),
        ...(input.startDate !== undefined ? { start_date: input.startDate ? fromDateOnly(input.startDate) : null } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate ? fromDateOnly(input.dueDate) : null } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.budgetGuardrail !== undefined ? { budget_guardrail: input.budgetGuardrail } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.linkType !== undefined ? { link_type: input.linkType } : {}),
        ...(input.linkObjectId !== undefined ? { link_object_id: input.linkObjectId } : {}),
        ...(input.linkLabel !== undefined ? { link_label: input.linkLabel } : {}),
        revision: { increment: 1 },
      },
    });
    if (!result.count) throw new ConflictError('Weekly work changed while you were editing it. Refresh and try again.');
    const updated = await tx.commercialWeeklyWorkItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude });
    const reassigned = current.owner_user_id !== updated.owner_user_id || current.owner_role !== updated.owner_role;
    const budgetChanged = decimalToNullableNumber(current.budget_guardrail) !== decimalToNullableNumber(updated.budget_guardrail);
    await createAudit(tx, {
      action: reassigned
        ? 'commercial_weekly_work_reassigned'
        : budgetChanged
          ? 'commercial_weekly_budget_guardrail_changed'
          : 'commercial_weekly_work_updated',
      userId,
      itemId,
      reason: reassigned
        ? 'Weekly work ownership updated'
        : budgetChanged
          ? 'Weekly budget guardrail updated within the execution-plan budget'
          : 'Weekly work details updated',
      beforeState: auditState(current),
      afterState: auditState(updated),
    });
    return mapItem(updated);
  });
}

export async function transitionWeeklyWorkItem(
  tenantKey: string,
  userId: string,
  commercialPlanId: string,
  itemId: string,
  input: TransitionWeeklyWorkItemInput,
): Promise<WeeklyWorkItemSummary> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.commercialWeeklyWorkItem.findFirst({
      where: { id: itemId, tenant_key: tenantKey, commercial_plan_id: commercialPlanId },
      include: itemInclude,
    });
    if (!current) throw new NotFoundError('CommercialWeeklyWorkItem', itemId);
    const now = new Date();
    const data: Prisma.CommercialWeeklyWorkItemUncheckedUpdateManyInput = {
      status: input.targetStatus,
      blocker_reason: input.targetStatus === 'blocked' ? input.blockerReason : null,
      completion_evidence: input.targetStatus === 'completed' ? input.completionEvidence : current.completion_evidence,
      approved_by_user_id: input.targetStatus === 'ready' && current.status === 'awaiting_approval' ? userId : current.approved_by_user_id,
      approved_at: input.targetStatus === 'ready' && current.status === 'awaiting_approval' ? now : current.approved_at,
      completed_at: input.targetStatus === 'completed' ? now : null,
      cancelled_at: input.targetStatus === 'cancelled' ? now : null,
      revision: { increment: 1 },
    };
    const result = await tx.commercialWeeklyWorkItem.updateMany({
      where: { id: itemId, tenant_key: tenantKey, commercial_plan_id: commercialPlanId, revision: input.expectedRevision },
      data,
    });
    if (!result.count) throw new ConflictError('Weekly work changed before this status update. Refresh and try again.');
    const updated = await tx.commercialWeeklyWorkItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude });
    await createAudit(tx, {
      action: input.targetStatus === 'completed'
        ? 'commercial_weekly_work_completed'
        : input.targetStatus === 'ready' && current.status === 'awaiting_approval'
          ? 'commercial_weekly_work_approved'
          : 'commercial_weekly_work_status_changed',
      userId,
      itemId,
      reason: input.reason || `Weekly work moved from ${current.status} to ${input.targetStatus}`,
      beforeState: auditState(current),
      afterState: auditState(updated),
    });
    return mapItem(updated);
  });
}

async function getPlanContext(client: TransactionClient | typeof prisma, tenantKey: string, planId: string) {
  const plan = await client.commercialPlan.findFirst({
    where: { id: planId, tenant_key: tenantKey },
    include: {
      tenant: { select: { timezone: true } },
      revenue_line: { select: { name: true } },
      hierarchy_assignment: {
        include: {
          annual_plan: { select: { id: true, title: true, year: true } },
          monthly_item: {
            select: { id: true, title: true, month: true, planned_start_date: true, planned_end_date: true },
          },
        },
      },
      event_links: { where: { status: 'active' }, select: { event_id: true } },
      campaign_links: { where: { status: 'active' }, select: { campaign_id: true } },
    },
  });
  if (!plan) throw new NotFoundError('CommercialPlan', planId);
  return plan;
}

async function validateOwner(client: TransactionClient, tenantKey: string, ownerUserId: string | null | undefined) {
  if (!ownerUserId) return;
  const owner = await client.user.findFirst({ where: { id: ownerUserId, tenant_key: tenantKey, is_active: true }, select: { id: true } });
  if (!owner) throw new ValidationError('Weekly work owner must be an active user in this workspace');
}

async function validateLink(
  client: TransactionClient,
  tenantKey: string,
  planId: string,
  linkType: WeeklyWorkLinkType | null | undefined,
  linkObjectId: string | null | undefined,
  plan: Awaited<ReturnType<typeof getPlanContext>>,
): Promise<void> {
  if (!linkType && !linkObjectId) return;
  if (!linkType || !linkObjectId) throw new ValidationError('Link type and linked record must be provided together');
  let exists = false;
  if (linkType === 'event') {
    exists = plan.linked_event_id === linkObjectId || plan.event_links.some((link) => link.event_id === linkObjectId);
  } else if (linkType === 'campaign') {
    exists = plan.campaign_links.some((link) => link.campaign_id === linkObjectId);
  } else if (linkType === 'content_item') {
    exists = Boolean(await client.contentItem.findFirst({
      where: {
        id: linkObjectId,
        tenant_key: tenantKey,
        request: { commercial_plan_links: { some: { commercial_plan_id: planId, status: 'active' } } },
      },
      select: { id: true },
    }));
  } else if (linkType === 'lead') {
    exists = Boolean(await client.leadCaptureRecord.findFirst({
      where: { id: linkObjectId, tenant_key: tenantKey, commercial_plan_id: planId },
      select: { id: true },
    }));
  } else if (linkType === 'discipline_record') {
    exists = Boolean(await client.commercialDisciplineRecord.findFirst({
      where: { id: linkObjectId, tenant_key: tenantKey, commercial_plan_id: planId },
      select: { id: true },
    }));
  } else if (linkType === 'connector_evidence') {
    const eventIds = plan.event_links.map((link) => link.event_id);
    if (plan.linked_event_id) eventIds.push(plan.linked_event_id);
    exists = Boolean(eventIds.length && await client.connectorImportJob.findFirst({
      where: { id: linkObjectId, tenant_key: tenantKey, event_id: { in: eventIds } },
      select: { id: true },
    }));
  }
  if (!exists) throw new ValidationError('Linked evidence must belong to this workspace and execution plan');
}

async function enforceBudgetGuardrail(
  client: TransactionClient,
  tenantKey: string,
  planId: string,
  proposedBudget: number | null | undefined,
  excludedItemId: string | null,
  planBudget: Prisma.Decimal | null,
): Promise<void> {
  if (proposedBudget == null || planBudget == null) return;
  const aggregate = await client.commercialWeeklyWorkItem.aggregate({
    where: {
      tenant_key: tenantKey,
      commercial_plan_id: planId,
      status: { not: 'cancelled' },
      ...(excludedItemId ? { id: { not: excludedItemId } } : {}),
    },
    _sum: { budget_guardrail: true },
  });
  const total = Number(aggregate._sum.budget_guardrail || 0) + proposedBudget;
  if (total > Number(planBudget)) {
    throw new ValidationError('Weekly budget guardrails cannot exceed the execution plan budget target');
  }
}

async function loadLinkOptions(
  tenantKey: string,
  planId: string,
  plan: Awaited<ReturnType<typeof getPlanContext>>,
): Promise<WeeklyWorkspaceSummary['linkOptions']> {
  const eventIds = [...new Set([
    ...plan.event_links.map((link) => link.event_id),
    ...(plan.linked_event_id ? [plan.linked_event_id] : []),
  ])];
  const campaignIds = plan.campaign_links.map((link) => link.campaign_id);
  const [events, campaigns, content, leads, disciplines, connectors] = await Promise.all([
    eventIds.length ? prisma.commercialEvent.findMany({ where: { tenant_key: tenantKey, id: { in: eventIds } }, select: { id: true, name: true } }) : [],
    campaignIds.length ? prisma.contentRequest.findMany({ where: { tenant_key: tenantKey, id: { in: campaignIds } }, select: { id: true, objective: true } }) : [],
    campaignIds.length ? prisma.contentItem.findMany({ where: { tenant_key: tenantKey, request_id: { in: campaignIds } }, select: { id: true, platform: true, content_type: true } }) : [],
    prisma.leadCaptureRecord.findMany({ where: { tenant_key: tenantKey, commercial_plan_id: planId }, select: { id: true, lead_name_placeholder: true, external_source_provider: true }, take: 50 }),
    prisma.commercialDisciplineRecord.findMany({ where: { tenant_key: tenantKey, commercial_plan_id: planId, status: { not: 'archived' } }, select: { id: true, title: true }, take: 50 }),
    eventIds.length ? prisma.connectorImportJob.findMany({ where: { tenant_key: tenantKey, event_id: { in: eventIds } }, select: { id: true, display_name: true }, take: 50 }) : [],
  ]);
  return [
    ...events.map((item) => ({ type: 'event' as const, id: item.id, label: item.name })),
    ...campaigns.map((item) => ({ type: 'campaign' as const, id: item.id, label: item.objective })),
    ...content.map((item) => ({ type: 'content_item' as const, id: item.id, label: `${item.platform} ${item.content_type}` })),
    ...leads.map((item) => ({ type: 'lead' as const, id: item.id, label: item.lead_name_placeholder || item.external_source_provider || 'Lead record' })),
    ...disciplines.map((item) => ({ type: 'discipline_record' as const, id: item.id, label: item.title })),
    ...connectors.map((item) => ({ type: 'connector_evidence' as const, id: item.id, label: item.display_name })),
  ];
}

function validateWeekAndPeriod(
  weekStartDate: string,
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  plan: Awaited<ReturnType<typeof getPlanContext>>,
): string {
  const normalized = normalizeWeekStart(weekStartDate);
  if (normalized !== weekStartDate) throw new ValidationError('Week start date must be a Monday');
  const weekEnd = addDays(normalized, 6);
  if (startDate && (startDate < normalized || startDate > weekEnd)) throw new ValidationError('Start date must be inside the selected week');
  if (dueDate && (dueDate < normalized || dueDate > weekEnd)) throw new ValidationError('Due date must be inside the selected week');
  const periodStart = toDateOnly(plan.hierarchy_assignment?.monthly_item.planned_start_date);
  const periodEnd = toDateOnly(plan.hierarchy_assignment?.monthly_item.planned_end_date);
  if (periodStart && weekEnd < periodStart) throw new ValidationError('Selected week is before the monthly initiative starts');
  if (periodEnd && normalized > periodEnd) throw new ValidationError('Selected week is after the monthly initiative ends');
  return normalized;
}

async function createAudit(
  client: TransactionClient,
  input: {
    action: string;
    userId: string;
    itemId: string;
    reason: string;
    beforeState?: Prisma.InputJsonValue;
    afterState?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditRecord.create({
    data: {
      audit_type: 'commercial_weekly_operations',
      action: input.action,
      result: 'success',
      human_user_id: input.userId,
      target_object_type: 'commercial_weekly_work_item',
      target_object_id: input.itemId,
      source_module: 'commercial-weekly-operations',
      reason: input.reason,
      before_state: input.beforeState,
      after_state: input.afterState,
    },
  });
}

function mapItem(item: WeeklyItemRecord): WeeklyWorkItemSummary {
  const weekStart = toDateOnly(item.week_start_date)!;
  return {
    id: item.id,
    commercialPlanId: item.commercial_plan_id,
    weekStartDate: weekStart,
    weekEndDate: addDays(weekStart, 6),
    title: item.title,
    businessOutcome: item.business_outcome,
    ownerUserId: item.owner_user_id,
    ownerName: item.owner?.name || null,
    ownerRole: item.owner_role || item.owner?.role || null,
    startDate: toDateOnly(item.start_date),
    dueDate: toDateOnly(item.due_date),
    status: item.status,
    priority: item.priority,
    budgetGuardrail: decimalToNullableNumber(item.budget_guardrail),
    currency: item.currency,
    linkType: item.link_type,
    linkObjectId: item.link_object_id,
    linkLabel: item.link_label,
    blockerReason: item.blocker_reason,
    completionEvidence: item.completion_evidence,
    revision: item.revision,
    createdByUserId: item.created_by_user_id,
    approvedByUserId: item.approved_by_user_id,
    approvedAt: item.approved_at,
    completedAt: item.completed_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function auditState(item: WeeklyItemRecord): Prisma.InputJsonValue {
  return {
    tenantKey: item.tenant_key,
    commercialPlanId: item.commercial_plan_id,
    status: item.status,
    title: item.title,
    ownerUserId: item.owner_user_id,
    ownerRole: item.owner_role,
    weekStartDate: toDateOnly(item.week_start_date),
    dueDate: toDateOnly(item.due_date),
    priority: item.priority,
    budgetGuardrail: decimalToNullableNumber(item.budget_guardrail),
    currency: item.currency,
    linkType: item.link_type,
    linkObjectId: item.link_object_id,
    revision: item.revision,
  };
}

export function normalizeWeekStart(date: string): string {
  const value = fromDateOnly(date);
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function dateInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatWeekLabel(start: string, end: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, month: 'short', day: 'numeric' });
  return `${formatter.format(fromDateOnly(start))} - ${formatter.format(fromDateOnly(end))}`;
}

function fromDateOnly(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function addDays(date: string, days: number): string {
  const value = fromDateOnly(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function decimalToNullableNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}
