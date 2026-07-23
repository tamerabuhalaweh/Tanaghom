import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import type {
  AmendKpiTargetInput,
  CreateKpiTargetInput,
  EventCapacityInput,
  ListKpiTargetsInput,
  TransitionKpiTargetInput,
  UpdateKpiTargetInput,
} from './types';

type Tx = Prisma.TransactionClient;

export async function listTargets(tenantKey: string, filters: ListKpiTargetsInput) {
  const records = await prisma.commercialKpiTarget.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.annualPlanId ? { annual_plan_id: filters.annualPlanId } : {}),
      ...(filters.monthlyItemId ? { monthly_item_id: filters.monthlyItemId } : {}),
      ...(filters.commercialPlanId ? { commercial_plan_id: filters.commercialPlanId } : {}),
      ...(filters.eventId ? { event_id: filters.eventId } : {}),
      ...(filters.campaignId ? { campaign_id: filters.campaignId } : {}),
      ...(filters.scope ? { scope: filters.scope } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      approved_by: { select: { id: true, name: true, role: true } },
      parent_target: { select: { id: true, metric_key: true, label: true } },
    },
    orderBy: [{ status: 'asc' }, { metric_key: 'asc' }, { created_at: 'desc' }],
  });
  return records.map(serializeTarget);
}

export async function listEffectiveEventTargets(tenantKey: string, eventId: string) {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: { id: true },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  const [directPlans, links] = await Promise.all([
    prisma.commercialPlan.findMany({
      where: { tenant_key: tenantKey, linked_event_id: eventId },
      select: { id: true },
    }),
    prisma.commercialPlanEventLink.findMany({
      where: { tenant_key: tenantKey, event_id: eventId, status: 'active' },
      select: { commercial_plan_id: true },
    }),
  ]);
  const planIds = [
    ...new Set([
      ...directPlans.map((plan) => plan.id),
      ...links.map((link) => link.commercial_plan_id),
    ]),
  ];
  const hierarchy = planIds.length
    ? await prisma.commercialPlanHierarchyAssignment.findMany({
        where: {
          tenant_key: tenantKey,
          commercial_plan_id: { in: planIds },
          status: 'active',
        },
        select: { annual_plan_id: true, monthly_portfolio_item_id: true },
      })
    : [];
  const annualPlanIds = [...new Set(hierarchy.map((item) => item.annual_plan_id))];
  const monthlyItemIds = [...new Set(hierarchy.map((item) => item.monthly_portfolio_item_id))];
  const records = await prisma.commercialKpiTarget.findMany({
    where: {
      tenant_key: tenantKey,
      status: 'approved',
      OR: [
        { event_id: eventId },
        ...(planIds.length ? [{ commercial_plan_id: { in: planIds } }] : []),
        ...(annualPlanIds.length ? [{ annual_plan_id: { in: annualPlanIds } }] : []),
        ...(monthlyItemIds.length ? [{ monthly_item_id: { in: monthlyItemIds } }] : []),
      ],
    },
    include: targetInclude,
    orderBy: [{ control_mode: 'asc' }, { scope: 'asc' }, { metric_key: 'asc' }],
  });
  return records.map((record) => ({
    ...serializeTarget(record),
    appliedAs: record.event_id === eventId ? 'event_specific' : 'inherited',
  }));
}

export async function createTarget(
  tenantKey: string,
  userId: string,
  input: CreateKpiTargetInput,
) {
  return prisma.$transaction(async (tx) => {
    await validateScopeOwnership(tx, tenantKey, input);
    if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);
    if (input.parentTargetId) {
      const parent = await tx.commercialKpiTarget.findFirst({
        where: { id: input.parentTargetId, tenant_key: tenantKey, status: 'approved' },
      });
      if (!parent) throw new NotFoundError('Approved parent KPI target', input.parentTargetId);
    }
    const record = await tx.commercialKpiTarget.create({
      data: toCreateData(tenantKey, userId, input),
      include: targetInclude,
    });
    await createAudit(tx, tenantKey, userId, 'commercial_kpi_target_created', record.id, {
      metricKey: record.metric_key,
      scope: record.scope,
      controlMode: record.control_mode,
      targetValue: record.target_value.toString(),
    });
    return serializeTarget(record);
  });
}

export async function updateTarget(
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateKpiTargetInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getTarget(tx, tenantKey, id);
    assertRevision(existing.revision, input.expectedRevision);
    if (existing.status !== 'draft') {
      throw new ConflictError('Only a draft KPI target can be edited; amend an approved target');
    }
    if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);
    const updated = await tx.commercialKpiTarget.update({
      where: { id },
      data: {
        ...(input.metricKey !== undefined ? { metric_key: input.metricKey } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.controlMode !== undefined ? { control_mode: input.controlMode } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.targetValue !== undefined
          ? { target_value: new Prisma.Decimal(input.targetValue) }
          : {}),
        ...(input.warningValue !== undefined
          ? {
              warning_value:
                input.warningValue == null ? null : new Prisma.Decimal(input.warningValue),
            }
          : {}),
        ...(input.criticalValue !== undefined
          ? {
              critical_value:
                input.criticalValue == null ? null : new Prisma.Decimal(input.criticalValue),
            }
          : {}),
        ...(input.lowerBound !== undefined
          ? {
              lower_bound: input.lowerBound == null ? null : new Prisma.Decimal(input.lowerBound),
            }
          : {}),
        ...(input.upperBound !== undefined
          ? {
              upper_bound: input.upperBound == null ? null : new Prisma.Decimal(input.upperBound),
            }
          : {}),
        ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
        ...(input.effectiveFrom !== undefined ? { effective_from: input.effectiveFrom } : {}),
        ...(input.effectiveTo !== undefined ? { effective_to: input.effectiveTo } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        revision: { increment: 1 },
      },
      include: targetInclude,
    });
    await createAudit(tx, tenantKey, userId, 'commercial_kpi_target_updated', id, {
      revision: updated.revision,
    });
    return serializeTarget(updated);
  });
}

export async function transitionTarget(
  tenantKey: string,
  userId: string,
  id: string,
  input: TransitionKpiTargetInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getTarget(tx, tenantKey, id);
    assertRevision(existing.revision, input.expectedRevision);
    const allowed: Record<string, string[]> = {
      draft: ['submit', 'archive'],
      pending_approval: ['approve', 'archive'],
      approved: ['archive'],
      superseded: ['archive'],
      archived: [],
    };
    if (!allowed[existing.status].includes(input.action)) {
      throw new ConflictError(`Cannot ${input.action} a KPI target in '${existing.status}' state`);
    }
    const now = new Date();
    const status =
      input.action === 'submit'
        ? 'pending_approval'
        : input.action === 'approve'
          ? 'approved'
          : 'archived';
    const updated = await tx.commercialKpiTarget.update({
      where: { id },
      data: {
        status,
        revision: { increment: 1 },
        ...(input.action === 'submit'
          ? { submitted_by_user_id: userId, submitted_at: now }
          : {}),
        ...(input.action === 'approve'
          ? { approved_by_user_id: userId, approved_at: now }
          : {}),
        ...(input.action === 'archive' ? { archived_at: now } : {}),
        ...(input.reason ? { amendment_reason: input.reason } : {}),
      },
      include: targetInclude,
    });
    await createAudit(tx, tenantKey, userId, `commercial_kpi_target_${input.action}`, id, {
      from: existing.status,
      to: status,
      reason: input.reason,
    });
    return serializeTarget(updated);
  });
}

export async function amendApprovedTarget(
  tenantKey: string,
  userId: string,
  id: string,
  input: AmendKpiTargetInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getTarget(tx, tenantKey, id);
    assertRevision(existing.revision, input.expectedRevision);
    if (existing.status !== 'approved') {
      throw new ConflictError('Only an approved KPI target can be amended');
    }
    const now = new Date();
    const replacement = await tx.commercialKpiTarget.create({
      data: {
        tenant_key: tenantKey,
        metric_key: existing.metric_key,
        label: existing.label,
        description: existing.description,
        unit: existing.unit,
        direction: existing.direction,
        scope: existing.scope,
        control_mode: existing.control_mode,
        status: 'approved',
        currency: existing.currency,
        target_value: new Prisma.Decimal(input.targetValue),
        warning_value:
          input.warningValue == null ? null : new Prisma.Decimal(input.warningValue),
        critical_value:
          input.criticalValue == null ? null : new Prisma.Decimal(input.criticalValue),
        lower_bound: input.lowerBound == null ? null : new Prisma.Decimal(input.lowerBound),
        upper_bound: input.upperBound == null ? null : new Prisma.Decimal(input.upperBound),
        annual_plan_id: existing.annual_plan_id,
        monthly_item_id: existing.monthly_item_id,
        commercial_plan_id: existing.commercial_plan_id,
        event_id: existing.event_id,
        campaign_id: existing.campaign_id,
        parent_target_id: existing.parent_target_id,
        supersedes_target_id: existing.id,
        owner_user_id: existing.owner_user_id,
        approved_by_user_id: userId,
        created_by_user_id: userId,
        approved_at: now,
        effective_from: input.effectiveFrom ?? now,
        effective_to: input.effectiveTo ?? null,
        amendment_reason: input.reason,
        metadata: existing.metadata ?? undefined,
      },
      include: targetInclude,
    });
    await tx.commercialKpiTarget.update({
      where: { id },
      data: { status: 'superseded', superseded_at: now, effective_to: now, revision: { increment: 1 } },
    });
    await createAudit(tx, tenantKey, userId, 'commercial_kpi_target_amended', replacement.id, {
      previousTargetId: id,
      reason: input.reason,
      targetValue: replacement.target_value.toString(),
    });
    return serializeTarget(replacement);
  });
}

export async function setEventCapacity(
  tenantKey: string,
  userId: string,
  eventId: string,
  input: EventCapacityInput,
) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.commercialEvent.findFirst({
      where: { id: eventId, tenant_key: tenantKey },
      select: { id: true, event_type: true, name: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', eventId);
    const updated = await tx.commercialEvent.update({
      where: { id: eventId },
      data: {
        venue_capacity: input.venueCapacity,
        sellable_ticket_capacity: input.sellableTicketCapacity,
        capacity_source: input.source,
        capacity_confirmed_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        event_type: true,
        venue_capacity: true,
        sellable_ticket_capacity: true,
        capacity_source: true,
        capacity_confirmed_at: true,
      },
    });
    await createAudit(
      tx,
      tenantKey,
      userId,
      'commercial_event_capacity_confirmed',
      eventId,
      {
        venueCapacity: input.venueCapacity,
        sellableTicketCapacity: input.sellableTicketCapacity,
        source: input.source,
      },
      'commercial_event',
    );
    return camelCaseCapacity(updated);
  });
}

export async function getEventCapacity(tenantKey: string, eventId: string) {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: {
      id: true,
      name: true,
      event_type: true,
      venue_capacity: true,
      sellable_ticket_capacity: true,
      capacity_source: true,
      capacity_confirmed_at: true,
    },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  return camelCaseCapacity(event);
}

export async function syncApprovedAnnualStrategyTargets(
  tx: Tx,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
): Promise<void> {
  const plan = await tx.annualCommercialPlan.findFirst({
    where: { id: annualPlanId, tenant_key: tenantKey },
    include: { items: { where: { archived_at: null }, select: { budget_allocation: true } } },
  });
  if (!plan) throw new NotFoundError('AnnualCommercialPlan', annualPlanId);
  const allocated = plan.items.reduce(
    (sum, item) => sum.plus(item.budget_allocation),
    new Prisma.Decimal(0),
  );
  const targets = [
    {
      metric_key: 'annual_revenue_target',
      label: 'Annual revenue target',
      target_value: plan.revenue_target,
    },
    {
      metric_key: 'annual_budget_target',
      label: 'Annual budget',
      target_value: plan.budget_target,
    },
    {
      metric_key: 'allocated_budget',
      label: 'Allocated annual budget',
      target_value: allocated,
    },
  ];
  for (const target of targets) {
    const exists = await tx.commercialKpiTarget.findFirst({
      where: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        metric_key: target.metric_key,
        status: 'approved',
      },
      select: { id: true },
    });
    if (exists) continue;
    await tx.commercialKpiTarget.create({
      data: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        metric_key: target.metric_key,
        label: target.label,
        description: 'Locked from the CCO-approved annual commercial strategy.',
        unit: 'currency',
        direction: 'target',
        scope: 'annual_strategy',
        control_mode: 'locked',
        status: 'approved',
        currency: plan.currency,
        target_value: target.target_value,
        approved_by_user_id: userId,
        created_by_user_id: userId,
        approved_at: new Date(),
        effective_from: new Date(plan.year, 0, 1),
        effective_to: new Date(plan.year, 11, 31, 23, 59, 59, 999),
        metadata: { source: 'annual_plan_approval', annualPlanRevision: plan.revision },
      },
    });
  }
}

async function validateScopeOwnership(
  tx: Tx,
  tenantKey: string,
  input: CreateKpiTargetInput,
): Promise<void> {
  if (input.annualPlanId) {
    await requireOwned(tx.annualCommercialPlan, tenantKey, input.annualPlanId, 'AnnualCommercialPlan');
  }
  if (input.monthlyItemId) {
    await requireOwned(tx.monthlyPortfolioItem, tenantKey, input.monthlyItemId, 'MonthlyPortfolioItem');
  }
  if (input.commercialPlanId) {
    await requireOwned(tx.commercialPlan, tenantKey, input.commercialPlanId, 'CommercialPlan');
  }
  if (input.eventId) {
    const event = await tx.commercialEvent.findFirst({
      where: { id: input.eventId, tenant_key: tenantKey },
      select: { id: true, sellable_ticket_capacity: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
    if (
      input.metricKey === 'ticket_sales' &&
      event.sellable_ticket_capacity != null &&
      input.targetValue > event.sellable_ticket_capacity
    ) {
      throw new ValidationError(
        `Ticket-sales target cannot exceed the absolute sellable capacity of ${event.sellable_ticket_capacity}`,
      );
    }
  }
  if (input.campaignId) {
    await requireOwned(tx.contentRequest, tenantKey, input.campaignId, 'ContentRequest');
  }
}

async function requireOwned(
  model: { findFirst(args: object): Promise<{ id: string } | null> },
  tenantKey: string,
  id: string,
  resource: string,
): Promise<void> {
  const found = await model.findFirst({ where: { id, tenant_key: tenantKey }, select: { id: true } });
  if (!found) throw new NotFoundError(resource, id);
}

async function getTarget(tx: Tx, tenantKey: string, id: string) {
  const target = await tx.commercialKpiTarget.findFirst({
    where: { id, tenant_key: tenantKey },
  });
  if (!target) throw new NotFoundError('CommercialKpiTarget', id);
  return target;
}

async function assertUserInTenant(tx: Tx, tenantKey: string, userId: string): Promise<void> {
  const user = await tx.user.findFirst({ where: { id: userId, tenant_key: tenantKey }, select: { id: true } });
  if (!user) throw new NotFoundError('User', userId);
}

function assertRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ConflictError(`Revision conflict: expected ${expected}, current ${actual}`);
  }
}

function toCreateData(tenantKey: string, userId: string, input: CreateKpiTargetInput) {
  return {
    tenant_key: tenantKey,
    metric_key: input.metricKey,
    label: input.label,
    description: input.description ?? null,
    unit: input.unit,
    direction: input.direction,
    scope: input.scope,
    control_mode: input.controlMode,
    currency: input.currency ?? null,
    target_value: new Prisma.Decimal(input.targetValue),
    warning_value: input.warningValue == null ? null : new Prisma.Decimal(input.warningValue),
    critical_value: input.criticalValue == null ? null : new Prisma.Decimal(input.criticalValue),
    lower_bound: input.lowerBound == null ? null : new Prisma.Decimal(input.lowerBound),
    upper_bound: input.upperBound == null ? null : new Prisma.Decimal(input.upperBound),
    annual_plan_id: input.annualPlanId ?? null,
    monthly_item_id: input.monthlyItemId ?? null,
    commercial_plan_id: input.commercialPlanId ?? null,
    event_id: input.eventId ?? null,
    campaign_id: input.campaignId ?? null,
    parent_target_id: input.parentTargetId ?? null,
    owner_user_id: input.ownerUserId ?? null,
    created_by_user_id: userId,
    effective_from: input.effectiveFrom ?? null,
    effective_to: input.effectiveTo ?? null,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
  };
}

const targetInclude = {
  owner: { select: { id: true, name: true, role: true } },
  approved_by: { select: { id: true, name: true, role: true } },
  parent_target: { select: { id: true, metric_key: true, label: true } },
} satisfies Prisma.CommercialKpiTargetInclude;

function serializeTarget(record: Record<string, unknown>) {
  const decimal = (value: unknown) =>
    value == null ? null : Number((value as { toString(): string }).toString());
  return {
    id: record.id,
    metricKey: record.metric_key,
    label: record.label,
    description: record.description,
    unit: record.unit,
    direction: record.direction,
    scope: record.scope,
    controlMode: record.control_mode,
    status: record.status,
    currency: record.currency,
    targetValue: decimal(record.target_value),
    warningValue: decimal(record.warning_value),
    criticalValue: decimal(record.critical_value),
    lowerBound: decimal(record.lower_bound),
    upperBound: decimal(record.upper_bound),
    annualPlanId: record.annual_plan_id,
    monthlyItemId: record.monthly_item_id,
    commercialPlanId: record.commercial_plan_id,
    eventId: record.event_id,
    campaignId: record.campaign_id,
    parentTargetId: record.parent_target_id,
    supersedesTargetId: record.supersedes_target_id,
    owner: record.owner,
    approvedBy: record.approved_by,
    parentTarget: record.parent_target,
    revision: record.revision,
    effectiveFrom: record.effective_from,
    effectiveTo: record.effective_to,
    submittedAt: record.submitted_at,
    approvedAt: record.approved_at,
    amendmentReason: record.amendment_reason,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function camelCaseCapacity(record: Record<string, unknown>) {
  return {
    eventId: record.id,
    eventName: record.name,
    eventType: record.event_type,
    venueCapacity: record.venue_capacity,
    sellableTicketCapacity: record.sellable_ticket_capacity,
    source: record.capacity_source,
    confirmedAt: record.capacity_confirmed_at,
    isAbsolute:
      record.venue_capacity != null && record.sellable_ticket_capacity != null,
  };
}

async function createAudit(
  tx: Tx,
  _tenantKey: string,
  userId: string,
  action: string,
  targetObjectId: string,
  afterState: Prisma.InputJsonValue,
  targetObjectType = 'commercial_kpi_target',
): Promise<void> {
  await tx.auditRecord.create({
    data: {
      audit_type: 'commercial_kpi_governance',
      action,
      human_user_id: userId,
      target_object_type: targetObjectType,
      target_object_id: targetObjectId,
      result: 'success',
      source_module: 'commercial-kpi-governance',
      reason: action,
      after_state: afterState,
    },
  });
}
