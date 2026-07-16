import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import {
  ConflictError,
  NotFoundError,
  StateTransitionError,
  ValidationError,
} from '@shared/errors';
import type {
  AnnualPlanRollup,
  AnnualPlanStatus,
  AnnualPlanTransitionInput,
  ArchivePortfolioItemInput,
  CommercialCurrency,
  CreateAnnualPlanInput,
  CreateExecutionPlanForPortfolioItemInput,
  CreatePortfolioItemInput,
  LinkLearningSetsInput,
  ListAnnualPlansInput,
  PortfolioReadiness,
  RejectAnnualPlanInput,
  UpdateAnnualPlanInput,
  UpdatePortfolioItemInput,
} from './types';

const annualPlanInclude = Prisma.validator<Prisma.AnnualCommercialPlanInclude>()({
  owner: { select: { id: true, name: true, role: true } },
  created_by: { select: { id: true, name: true } },
  submitted_by: { select: { id: true, name: true } },
  approved_by: { select: { id: true, name: true } },
  items: {
    where: { archived_at: null },
    include: {
      revenue_line: { select: { id: true, name: true, revenue_line_type: true, status: true } },
      commercial_plan: { select: { id: true, title: true, status: true, horizon: true } },
      event: { select: { id: true, name: true, event_date: true, status: true } },
      owner: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ month: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
  },
  learning_links: {
    include: {
      learning_set: {
        include: {
          assessment_run: {
            select: {
              id: true,
              title: true,
              date_from: true,
              date_to: true,
              revenue_line_id: true,
            },
          },
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
          },
        },
      },
    },
    orderBy: { linked_at: 'asc' },
  },
});

type AnnualPlanRecord = Prisma.AnnualCommercialPlanGetPayload<{
  include: typeof annualPlanInclude;
}>;
type PortfolioRecord = AnnualPlanRecord['items'][number];

export async function listAnnualPlans(tenantKey: string, filters: ListAnnualPlansInput) {
  const records = await prisma.annualCommercialPlan.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: annualPlanInclude,
    orderBy: [{ year: 'desc' }, { scenario_version: 'desc' }],
    take: 100,
  });
  return records.map(mapAnnualPlan);
}

export async function getAnnualPlan(tenantKey: string, id: string) {
  const record = await prisma.annualCommercialPlan.findFirst({
    where: { id, tenant_key: tenantKey },
    include: annualPlanInclude,
  });
  if (!record) throw new NotFoundError('AnnualCommercialPlan', id);
  return mapAnnualPlan(record);
}

export async function createAnnualPlan(
  tenantKey: string,
  userId: string,
  input: CreateAnnualPlanInput,
) {
  return prisma.$transaction(async (tx) => {
    if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);
    await assertLearningSetsInTenant(tx, tenantKey, input.learningSetIds);
    const lastVersion = await tx.annualCommercialPlan.findFirst({
      where: { tenant_key: tenantKey, year: input.year },
      select: { scenario_version: true },
      orderBy: { scenario_version: 'desc' },
    });
    const tenant = await tx.tenant.findUnique({
      where: { tenant_key: tenantKey },
      select: { default_currency: true },
    });
    if (!tenant) throw new NotFoundError('Tenant', tenantKey);
    const plan = await tx.annualCommercialPlan.create({
      data: {
        tenant_key: tenantKey,
        year: input.year,
        scenario_version: (lastVersion?.scenario_version || 0) + 1,
        title: input.title,
        strategy: input.strategy ?? null,
        currency: input.currency || tenant.default_currency,
        budget_target: new Prisma.Decimal(input.budgetTarget),
        revenue_target: new Prisma.Decimal(input.revenueTarget),
        owner_user_id: input.ownerUserId ?? null,
        created_by_user_id: userId,
      },
    });
    if (input.learningSetIds.length) {
      await tx.annualCommercialPlanLearningSet.createMany({
        data: input.learningSetIds.map((learningSetId) => ({
          tenant_key: tenantKey,
          annual_plan_id: plan.id,
          learning_set_id: learningSetId,
        })),
      });
    }
    await createAudit(tx, {
      action: 'annual_commercial_plan_created',
      userId,
      targetObjectType: 'annual_commercial_plan',
      targetObjectId: plan.id,
      reason: `Annual commercial plan created for ${input.year}`,
      afterState: {
        year: input.year,
        currency: plan.currency,
        scenarioVersion: plan.scenario_version,
        learningSetCount: input.learningSetIds.length,
      },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, plan.id));
  });
}

export async function updateAnnualPlan(
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateAnnualPlanInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await fetchPlan(tx, tenantKey, id);
    assertEditable(existing.status);
    assertRevision(existing.revision, input.expectedRevision);
    if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);
    await bumpPlanRevision(tx, tenantKey, id, input.expectedRevision, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.budgetTarget !== undefined
        ? { budget_target: new Prisma.Decimal(input.budgetTarget) }
        : {}),
      ...(input.revenueTarget !== undefined
        ? { revenue_target: new Prisma.Decimal(input.revenueTarget) }
        : {}),
      ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
      rejection_reason: null,
    });
    await createAudit(tx, {
      action: 'annual_commercial_plan_updated',
      userId,
      targetObjectType: 'annual_commercial_plan',
      targetObjectId: id,
      reason: 'Annual commercial plan details updated',
      afterState: {
        changedFields: Object.keys(input).filter((key) => key !== 'expectedRevision'),
        revision: input.expectedRevision + 1,
      },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, id));
  });
}

export async function transitionAnnualPlan(
  tenantKey: string,
  userId: string,
  id: string,
  target: AnnualPlanStatus,
  input: AnnualPlanTransitionInput | RejectAnnualPlanInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await fetchPlan(tx, tenantKey, id);
    assertRevision(existing.revision, input.expectedRevision);
    assertAnnualPlanTransition(existing.status, target);
    if (target === 'approved' || target === 'active') {
      const current = await tx.annualCommercialPlan.findFirst({
        where: {
          tenant_key: tenantKey,
          year: existing.year,
          status: { in: ['approved', 'active'] },
          id: { not: id },
        },
        select: { id: true },
      });
      if (current)
        throw new ConflictError(
          `Another approved or active annual plan already exists for ${existing.year}`,
        );
    }
    const now = new Date();
    const data: Prisma.AnnualCommercialPlanUpdateManyMutationInput = {
      status: target,
      revision: { increment: 1 },
      ...(target === 'pending_approval'
        ? { submitted_by_user_id: userId, submitted_at: now, rejection_reason: null }
        : {}),
      ...(target === 'approved'
        ? { approved_by_user_id: userId, approved_at: now, rejection_reason: null }
        : {}),
      ...(target === 'rejected'
        ? {
            rejection_reason: input.reason || 'Changes requested by approver',
            approved_by_user_id: userId,
            approved_at: now,
          }
        : {}),
      ...(target === 'active' ? { activated_at: now } : {}),
      ...(target === 'closed' ? { closed_at: now } : {}),
      ...(target === 'archived' ? { archived_at: now } : {}),
    };
    await bumpPlanRevision(tx, tenantKey, id, input.expectedRevision, data, false);
    await createAudit(tx, {
      action: `annual_commercial_plan_${target}`,
      userId,
      targetObjectType: 'annual_commercial_plan',
      targetObjectId: id,
      reason: input.reason || `Annual plan moved from ${existing.status} to ${target}`,
      afterState: { from: existing.status, to: target, revision: input.expectedRevision + 1 },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, id));
  });
}

export async function updateLearningSets(
  tenantKey: string,
  userId: string,
  id: string,
  input: LinkLearningSetsInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await fetchPlan(tx, tenantKey, id);
    assertEditable(existing.status);
    assertRevision(existing.revision, input.expectedRevision);
    await assertLearningSetsInTenant(tx, tenantKey, input.learningSetIds);
    await bumpPlanRevision(tx, tenantKey, id, input.expectedRevision, {});
    await tx.annualCommercialPlanLearningSet.deleteMany({
      where: { tenant_key: tenantKey, annual_plan_id: id },
    });
    if (input.learningSetIds.length) {
      await tx.annualCommercialPlanLearningSet.createMany({
        data: input.learningSetIds.map((learningSetId) => ({
          tenant_key: tenantKey,
          annual_plan_id: id,
          learning_set_id: learningSetId,
        })),
      });
    }
    await createAudit(tx, {
      action: 'annual_commercial_plan_learning_updated',
      userId,
      targetObjectType: 'annual_commercial_plan',
      targetObjectId: id,
      reason: 'Approved historical learning linked to annual plan',
      afterState: { learningSetIds: input.learningSetIds, revision: input.expectedRevision + 1 },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, id));
  });
}

export async function createPortfolioItem(
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  input: CreatePortfolioItemInput,
) {
  return prisma.$transaction(async (tx) => {
    const plan = await fetchPlan(tx, tenantKey, annualPlanId);
    assertEditable(plan.status);
    assertRevision(plan.revision, input.expectedRevision);
    await validatePortfolioReferences(tx, tenantKey, plan.year, input);
    const last = await tx.monthlyPortfolioItem.findFirst({
      where: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        month: input.month,
        archived_at: null,
      },
      select: { sort_order: true },
      orderBy: { sort_order: 'desc' },
    });
    await bumpPlanRevision(tx, tenantKey, annualPlanId, input.expectedRevision, {});
    const item = await tx.monthlyPortfolioItem.create({
      data: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        month: input.month,
        sort_order: input.sortOrder ?? (last?.sort_order ?? -1) + 1,
        revenue_line_id: input.revenueLineId,
        commercial_plan_id: input.commercialPlanId ?? null,
        event_id: input.eventId ?? null,
        title: input.title,
        planned_start_date: input.plannedStartDate ?? null,
        planned_end_date: input.plannedEndDate ?? null,
        currency: input.currency || plan.currency,
        budget_allocation: new Prisma.Decimal(input.budgetAllocation),
        revenue_target: new Prisma.Decimal(input.revenueTarget),
        priority: input.priority,
        readiness: input.readiness,
        owner_user_id: input.ownerUserId ?? null,
        created_by_user_id: userId,
      },
    });
    await syncExecutionPlanAssignment(
      tx,
      tenantKey,
      userId,
      annualPlanId,
      item.id,
      null,
      input.commercialPlanId ?? null,
      input.eventId ?? null,
    );
    await createAudit(tx, {
      action: 'monthly_portfolio_item_created',
      userId,
      targetObjectType: 'monthly_portfolio_item',
      targetObjectId: item.id,
      reason: `Portfolio initiative added to month ${input.month}`,
      afterState: {
        annualPlanId,
        month: input.month,
        revenueLineId: input.revenueLineId,
        currency: item.currency,
      },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, annualPlanId));
  });
}

export async function createExecutionPlanForPortfolioItem(
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  input: CreateExecutionPlanForPortfolioItemInput,
) {
  return prisma.$transaction(async (tx) => {
    const annualPlan = await fetchPlan(tx, tenantKey, annualPlanId);
    assertEditable(annualPlan.status);
    assertRevision(annualPlan.revision, input.expectedRevision);
    const item = await tx.monthlyPortfolioItem.findFirst({
      where: {
        id: itemId,
        annual_plan_id: annualPlanId,
        tenant_key: tenantKey,
        archived_at: null,
      },
    });
    if (!item) throw new NotFoundError('MonthlyPortfolioItem', itemId);
    if (item.commercial_plan_id) {
      throw new ConflictError('This monthly initiative already has an execution plan');
    }
    if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);

    await bumpPlanRevision(tx, tenantKey, annualPlanId, input.expectedRevision, {});
    const executionPlan = await tx.commercialPlan.create({
      data: {
        tenant_key: tenantKey,
        revenue_line_id: item.revenue_line_id,
        linked_event_id: item.event_id,
        horizon: 'product_or_event',
        stage: 'strategy_planning',
        title: input.title,
        objective: input.objective ?? null,
        audience: input.audience ?? null,
        currency: item.currency,
        budget_target: item.budget_allocation,
        revenue_target: item.revenue_target,
        kpi_targets: Prisma.JsonNull,
        strategy_summary: input.strategySummary ?? null,
        action_plan: input.actionPlan ?? null,
        status: 'draft',
        origin: 'annual_month',
        standalone_reason: null,
        owner_user_id: input.ownerUserId ?? item.owner_user_id,
        created_by_user_id: userId,
      },
    });
    await tx.monthlyPortfolioItem.update({
      where: { id: itemId },
      data: { commercial_plan_id: executionPlan.id },
    });
    await syncExecutionPlanAssignment(
      tx,
      tenantKey,
      userId,
      annualPlanId,
      itemId,
      null,
      executionPlan.id,
      item.event_id,
    );

    const approvedFindings = annualPlan.learning_links.flatMap((link) =>
      link.learning_set.findings.map((finding) => ({
        tenant_key: tenantKey,
        commercial_plan_id: executionPlan.id,
        learning_set_id: link.learning_set.id,
        finding_id: finding.id,
        rationale: `Inherited from approved annual learning: ${finding.title}`,
        linked_by_user_id: userId,
      })),
    );
    if (approvedFindings.length) {
      await tx.commercialPlanLearningInfluence.createMany({
        data: approvedFindings,
        skipDuplicates: true,
      });
    }

    await createAudit(tx, {
      action: 'monthly_execution_plan_created',
      userId,
      targetObjectType: 'commercial_plan',
      targetObjectId: executionPlan.id,
      reason: 'Execution plan created from an annual monthly initiative',
      afterState: {
        origin: 'annual_month',
        annualPlanId,
        monthlyPortfolioItemId: itemId,
        revenueLineId: item.revenue_line_id,
        eventId: item.event_id,
        currency: item.currency,
        budgetTarget: decimal(item.budget_allocation),
        revenueTarget: decimal(item.revenue_target),
        approvedLearningCount: approvedFindings.length,
      },
    });
    return {
      annualPlan: mapAnnualPlan(await fetchPlan(tx, tenantKey, annualPlanId)),
      executionPlan: {
        id: executionPlan.id,
        title: executionPlan.title,
        origin: executionPlan.origin,
        annualPlanId,
        monthlyPortfolioItemId: itemId,
      },
    };
  });
}

export async function updatePortfolioItem(
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
) {
  return prisma.$transaction(async (tx) => {
    const plan = await fetchPlan(tx, tenantKey, annualPlanId);
    assertEditable(plan.status);
    assertRevision(plan.revision, input.expectedRevision);
    const existing = await tx.monthlyPortfolioItem.findFirst({
      where: { id: itemId, annual_plan_id: annualPlanId, tenant_key: tenantKey, archived_at: null },
    });
    if (!existing) throw new NotFoundError('MonthlyPortfolioItem', itemId);
    const merged = {
      month: input.month ?? existing.month,
      revenueLineId: input.revenueLineId ?? existing.revenue_line_id,
      commercialPlanId:
        input.commercialPlanId === undefined ? existing.commercial_plan_id : input.commercialPlanId,
      eventId: input.eventId === undefined ? existing.event_id : input.eventId,
      plannedStartDate:
        input.plannedStartDate === undefined ? existing.planned_start_date : input.plannedStartDate,
      plannedEndDate:
        input.plannedEndDate === undefined ? existing.planned_end_date : input.plannedEndDate,
      ownerUserId: input.ownerUserId === undefined ? existing.owner_user_id : input.ownerUserId,
    };
    await validatePortfolioReferences(tx, tenantKey, plan.year, merged);
    await bumpPlanRevision(tx, tenantKey, annualPlanId, input.expectedRevision, {});
    await tx.monthlyPortfolioItem.update({
      where: { id: itemId },
      data: {
        ...(input.month !== undefined ? { month: input.month } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
        ...(input.revenueLineId !== undefined ? { revenue_line_id: input.revenueLineId } : {}),
        ...(input.commercialPlanId !== undefined
          ? { commercial_plan_id: input.commercialPlanId }
          : {}),
        ...(input.eventId !== undefined ? { event_id: input.eventId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.plannedStartDate !== undefined
          ? { planned_start_date: input.plannedStartDate }
          : {}),
        ...(input.plannedEndDate !== undefined ? { planned_end_date: input.plannedEndDate } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.budgetAllocation !== undefined
          ? { budget_allocation: new Prisma.Decimal(input.budgetAllocation) }
          : {}),
        ...(input.revenueTarget !== undefined
          ? { revenue_target: new Prisma.Decimal(input.revenueTarget) }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.readiness !== undefined ? { readiness: input.readiness } : {}),
        ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
      },
    });
    await syncExecutionPlanAssignment(
      tx,
      tenantKey,
      userId,
      annualPlanId,
      itemId,
      existing.commercial_plan_id,
      merged.commercialPlanId,
      merged.eventId,
    );
    await createAudit(tx, {
      action: 'monthly_portfolio_item_updated',
      userId,
      targetObjectType: 'monthly_portfolio_item',
      targetObjectId: itemId,
      reason: 'Monthly portfolio initiative updated or moved',
      afterState: {
        annualPlanId,
        changedFields: Object.keys(input).filter((key) => key !== 'expectedRevision'),
      },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, annualPlanId));
  });
}

export async function archivePortfolioItem(
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  input: ArchivePortfolioItemInput,
) {
  return prisma.$transaction(async (tx) => {
    const plan = await fetchPlan(tx, tenantKey, annualPlanId);
    assertEditable(plan.status);
    assertRevision(plan.revision, input.expectedRevision);
    const item = await tx.monthlyPortfolioItem.findFirst({
      where: { id: itemId, annual_plan_id: annualPlanId, tenant_key: tenantKey, archived_at: null },
      select: {
        id: true,
        execution_plan_assignments: {
          where: { status: 'active' },
          select: { id: true, commercial_plan: { select: { status: true } } },
        },
      },
    });
    if (!item) throw new NotFoundError('MonthlyPortfolioItem', itemId);
    if (item.execution_plan_assignments.some((assignment) => assignment.commercial_plan.status !== 'archived')) {
      throw new ValidationError(
        'Archive or supersede the linked execution plan before archiving this monthly initiative',
      );
    }
    await bumpPlanRevision(tx, tenantKey, annualPlanId, input.expectedRevision, {});
    await tx.monthlyPortfolioItem.update({
      where: { id: itemId },
      data: { archived_at: new Date() },
    });
    await tx.commercialPlanHierarchyAssignment.updateMany({
      where: { monthly_portfolio_item_id: itemId, status: 'active' },
      data: { status: 'archived', archived_at: new Date() },
    });
    await createAudit(tx, {
      action: 'monthly_portfolio_item_archived',
      userId,
      targetObjectType: 'monthly_portfolio_item',
      targetObjectId: itemId,
      reason: 'Monthly portfolio initiative archived',
      afterState: { annualPlanId },
    });
    return mapAnnualPlan(await fetchPlan(tx, tenantKey, annualPlanId));
  });
}

export function buildAnnualPlanRollup(
  items: Array<{
    month: number;
    currency: CommercialCurrency;
    budgetAllocation: number;
    revenueTarget: number;
    readiness: PortfolioReadiness;
  }>,
  planCurrency: CommercialCurrency,
  annualBudgetTarget: number,
  annualRevenueTarget: number,
): AnnualPlanRollup {
  const readiness = emptyReadiness();
  const currencies = new Map<
    CommercialCurrency,
    { budgetAllocation: number; revenueTarget: number; itemCount: number }
  >();
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    itemCount: 0,
    readiness: emptyReadiness(),
    currencyMap: new Map<
      CommercialCurrency,
      { budgetAllocation: number; revenueTarget: number; itemCount: number }
    >(),
  }));
  for (const item of items) {
    readiness[item.readiness] += 1;
    addCurrency(currencies, item.currency, item.budgetAllocation, item.revenueTarget);
    const month = months[item.month - 1];
    if (!month) continue;
    month.itemCount += 1;
    month.readiness[item.readiness] += 1;
    addCurrency(month.currencyMap, item.currency, item.budgetAllocation, item.revenueTarget);
  }
  const planTotals = currencies.get(planCurrency) || {
    budgetAllocation: 0,
    revenueTarget: 0,
    itemCount: 0,
  };
  const unallocatedBudget = roundMoney(annualBudgetTarget - planTotals.budgetAllocation);
  return {
    planCurrency,
    annualBudgetTarget: roundMoney(annualBudgetTarget),
    annualRevenueTarget: roundMoney(annualRevenueTarget),
    allocatedBudget: roundMoney(planTotals.budgetAllocation),
    allocatedRevenueTarget: roundMoney(planTotals.revenueTarget),
    unallocatedBudget,
    overAllocated: unallocatedBudget < 0,
    readiness,
    currencies: mapCurrencyRollups(currencies),
    months: months.map((month) => ({
      month: month.month,
      itemCount: month.itemCount,
      readiness: month.readiness,
      currencies: mapCurrencyRollups(month.currencyMap),
    })),
  };
}

function mapAnnualPlan(record: AnnualPlanRecord) {
  const items = record.items.map(mapItem);
  return {
    id: record.id,
    year: record.year,
    scenarioVersion: record.scenario_version,
    revision: record.revision,
    title: record.title,
    strategy: record.strategy,
    currency: record.currency,
    budgetTarget: decimal(record.budget_target),
    revenueTarget: decimal(record.revenue_target),
    status: record.status,
    owner: record.owner,
    createdBy: record.created_by,
    submittedBy: record.submitted_by,
    submittedAt: record.submitted_at,
    approvedBy: record.approved_by,
    approvedAt: record.approved_at,
    rejectionReason: record.rejection_reason,
    activatedAt: record.activated_at,
    closedAt: record.closed_at,
    archivedAt: record.archived_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    items,
    learningSets: record.learning_links.map((link) => ({
      id: link.learning_set.id,
      title: link.learning_set.title,
      status: link.learning_set.status,
      approvedAt: link.learning_set.approved_at,
      assessment: {
        id: link.learning_set.assessment_run.id,
        title: link.learning_set.assessment_run.title,
        dateFrom: link.learning_set.assessment_run.date_from,
        dateTo: link.learning_set.assessment_run.date_to,
        revenueLineId: link.learning_set.assessment_run.revenue_line_id,
      },
      findings: link.learning_set.findings.map((finding) => ({
        id: finding.id,
        type: finding.finding_type,
        title: finding.title,
        recommendation: finding.recommendation,
        confidence: decimal(finding.confidence),
      })),
    })),
    rollup: buildAnnualPlanRollup(
      items.map((item) => ({
        month: item.month,
        currency: item.currency,
        budgetAllocation: item.budgetAllocation,
        revenueTarget: item.revenueTarget,
        readiness: item.readiness,
      })),
      record.currency,
      decimal(record.budget_target),
      decimal(record.revenue_target),
    ),
  };
}

function mapItem(item: PortfolioRecord) {
  return {
    id: item.id,
    month: item.month,
    sortOrder: item.sort_order,
    title: item.title,
    plannedStartDate: item.planned_start_date,
    plannedEndDate: item.planned_end_date,
    currency: item.currency,
    budgetAllocation: decimal(item.budget_allocation),
    revenueTarget: decimal(item.revenue_target),
    priority: item.priority,
    readiness: item.readiness,
    revenueLine: {
      id: item.revenue_line.id,
      name: item.revenue_line.name,
      type: item.revenue_line.revenue_line_type,
      status: item.revenue_line.status,
    },
    commercialPlan: item.commercial_plan,
    event: item.event,
    owner: item.owner,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

async function fetchPlan(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  id: string,
): Promise<AnnualPlanRecord> {
  const record = await tx.annualCommercialPlan.findFirst({
    where: { id, tenant_key: tenantKey },
    include: annualPlanInclude,
  });
  if (!record) throw new NotFoundError('AnnualCommercialPlan', id);
  return record;
}

async function bumpPlanRevision(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  id: string,
  expectedRevision: number,
  data: Prisma.AnnualCommercialPlanUpdateManyMutationInput,
  addRevision = true,
): Promise<void> {
  const result = await tx.annualCommercialPlan.updateMany({
    where: { id, tenant_key: tenantKey, revision: expectedRevision },
    data: addRevision ? { ...data, revision: { increment: 1 } } : data,
  });
  if (result.count !== 1)
    throw new ConflictError(
      'This annual plan was changed by another user. Refresh before saving again.',
    );
}

async function validatePortfolioReferences(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  year: number,
  input: {
    month: number;
    revenueLineId: string;
    commercialPlanId?: string | null;
    eventId?: string | null;
    plannedStartDate?: Date | null;
    plannedEndDate?: Date | null;
    ownerUserId?: string | null;
  },
): Promise<void> {
  const revenueLine = await tx.commercialRevenueLine.findFirst({
    where: { id: input.revenueLineId, tenant_key: tenantKey },
    select: { id: true },
  });
  if (!revenueLine) throw new NotFoundError('CommercialRevenueLine', input.revenueLineId);
  if (input.ownerUserId) await assertUserInTenant(tx, tenantKey, input.ownerUserId);
  if (input.commercialPlanId) {
    const plan = await tx.commercialPlan.findFirst({
      where: { id: input.commercialPlanId, tenant_key: tenantKey },
      select: { id: true, revenue_line_id: true, linked_event_id: true },
    });
    if (!plan) throw new NotFoundError('CommercialPlan', input.commercialPlanId);
    if (plan.revenue_line_id !== input.revenueLineId)
      throw new ValidationError(
        'Detailed commercial plan must use the same revenue line as the monthly initiative',
      );
    if (input.eventId && plan.linked_event_id && plan.linked_event_id !== input.eventId)
      throw new ValidationError(
        'Monthly initiative event must match the detailed commercial plan event',
      );
  }
  if (input.eventId) {
    const event = await tx.commercialEvent.findFirst({
      where: { id: input.eventId, tenant_key: tenantKey },
      select: { id: true, event_date: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
    if (event.event_date.getUTCFullYear() !== year || event.event_date.getUTCMonth() + 1 !== input.month) {
      throw new ValidationError(
        'Linked event date must fall inside the selected portfolio month; use an approved hierarchy exception for intentional moves',
      );
    }
  }
  assertDateInYear(input.plannedStartDate, year, 'Planned start date');
  assertDateInYear(input.plannedEndDate, year, 'Planned end date');
  if (
    input.plannedStartDate &&
    input.plannedEndDate &&
    input.plannedEndDate < input.plannedStartDate
  ) {
    throw new ValidationError('Planned end date must be on or after the start date');
  }
  for (const value of [input.plannedStartDate, input.plannedEndDate]) {
    if (value && value.getUTCMonth() + 1 !== input.month) {
      throw new ValidationError('Planned dates must fall inside the selected portfolio month');
    }
  }
}

async function syncExecutionPlanAssignment(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  itemId: string,
  previousPlanId: string | null,
  nextPlanId: string | null,
  eventId: string | null,
): Promise<void> {
  if (previousPlanId && previousPlanId !== nextPlanId) {
    if (nextPlanId) {
      throw new ConflictError(
        'Replace an assigned execution plan through the governed supersede action so its history remains traceable',
      );
    }
    const [previousPlan, activeEvents, activeCampaigns] = await Promise.all([
      tx.commercialPlan.findFirst({
        where: { id: previousPlanId, tenant_key: tenantKey },
        select: { status: true },
      }),
      tx.commercialPlanEventLink.count({
        where: { commercial_plan_id: previousPlanId, tenant_key: tenantKey, status: 'active' },
      }),
      tx.commercialPlanCampaignLink.count({
        where: { commercial_plan_id: previousPlanId, tenant_key: tenantKey, status: 'active' },
      }),
    ]);
    if (!previousPlan) throw new NotFoundError('CommercialPlan', previousPlanId);
    if (previousPlan.status !== 'archived' || activeEvents + activeCampaigns > 0) {
      throw new ConflictError(
        'Archive the execution plan and its active event or campaign links before clearing the monthly assignment',
      );
    }
    await tx.commercialPlanHierarchyAssignment.updateMany({
      where: { commercial_plan_id: previousPlanId, monthly_portfolio_item_id: itemId, status: 'active' },
      data: { status: 'archived', archived_at: new Date() },
    });
  }
  if (!nextPlanId) return;

  const occupied = await tx.commercialPlanHierarchyAssignment.findFirst({
    where: {
      monthly_portfolio_item_id: itemId,
      status: 'active',
      commercial_plan_id: { not: nextPlanId },
    },
    select: { commercial_plan_id: true },
  });
  if (occupied) throw new ConflictError('This monthly initiative already has an active execution plan');

  const existing = await tx.commercialPlanHierarchyAssignment.findUnique({
    where: { commercial_plan_id: nextPlanId },
    select: { annual_plan_id: true, monthly_portfolio_item_id: true },
  });
  if (existing && existing.monthly_portfolio_item_id !== itemId) {
    throw new ConflictError(
      'This execution plan already has a historical monthly assignment; create a replacement plan and supersede it instead',
    );
  }
  if (existing && existing.annual_plan_id !== annualPlanId) {
    throw new ConflictError(
      'This execution plan already belongs to another annual plan; create a replacement plan and supersede it instead',
    );
  }
  await tx.commercialPlanHierarchyAssignment.upsert({
    where: { commercial_plan_id: nextPlanId },
    create: {
      tenant_key: tenantKey,
      commercial_plan_id: nextPlanId,
      annual_plan_id: annualPlanId,
      monthly_portfolio_item_id: itemId,
      linked_by_user_id: userId,
    },
    update: {
      annual_plan_id: annualPlanId,
      monthly_portfolio_item_id: itemId,
      status: 'active',
      linked_by_user_id: userId,
      archived_at: null,
    },
  });
  if (eventId) {
    await tx.commercialPlanEventLink.updateMany({
      where: { commercial_plan_id: nextPlanId, status: 'active' },
      data: { is_primary: false },
    });
    await tx.commercialPlanEventLink.upsert({
      where: {
        commercial_plan_id_event_id: { commercial_plan_id: nextPlanId, event_id: eventId },
      },
      create: {
        tenant_key: tenantKey,
        commercial_plan_id: nextPlanId,
        event_id: eventId,
        is_primary: true,
        linked_by_user_id: userId,
      },
      update: {
        status: 'active',
        is_primary: true,
        linked_by_user_id: userId,
        archived_at: null,
      },
    });
    await tx.commercialPlan.update({
      where: { id: nextPlanId },
      data: { linked_event_id: eventId },
    });
  }
}

async function assertUserInTenant(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  userId: string,
): Promise<void> {
  const user = await tx.user.findFirst({
    where: { id: userId, tenant_key: tenantKey, is_active: true },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('User', userId);
}

async function assertLearningSetsInTenant(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  learningSetIds: string[],
): Promise<void> {
  if (!learningSetIds.length) return;
  if (new Set(learningSetIds).size !== learningSetIds.length)
    throw new ValidationError('Learning set ids must be unique');
  const records = await tx.commercialLearningSet.findMany({
    where: { id: { in: learningSetIds }, tenant_key: tenantKey, status: 'active' },
    select: { id: true },
  });
  if (records.length !== learningSetIds.length)
    throw new ValidationError(
      'Every linked learning set must be active and owned by this workspace',
    );
}

function assertDateInYear(value: Date | null | undefined, year: number, label: string): void {
  if (value && value.getUTCFullYear() !== year)
    throw new ValidationError(`${label} must fall inside annual plan year ${year}`);
}

function assertEditable(status: AnnualPlanStatus): void {
  if (!['draft', 'rejected'].includes(status))
    throw new ValidationError('Only draft or rejected annual plans can be edited');
}

function assertRevision(actual: number, expected: number): void {
  if (actual !== expected)
    throw new ConflictError(
      'This annual plan was changed by another user. Refresh before saving again.',
    );
}

export function assertAnnualPlanTransition(from: AnnualPlanStatus, to: AnnualPlanStatus): void {
  const allowed: Record<AnnualPlanStatus, AnnualPlanStatus[]> = {
    draft: ['pending_approval', 'archived'],
    pending_approval: ['approved', 'rejected'],
    approved: ['active', 'archived'],
    rejected: ['pending_approval', 'archived'],
    active: ['closed'],
    closed: ['archived'],
    archived: [],
  };
  if (!allowed[from].includes(to)) throw new StateTransitionError(from, to);
}

function decimal(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function emptyReadiness(): Record<PortfolioReadiness, number> {
  return { planned: 0, needs_brief: 0, ready: 0, blocked: 0, completed: 0 };
}

function addCurrency(
  map: Map<
    CommercialCurrency,
    { budgetAllocation: number; revenueTarget: number; itemCount: number }
  >,
  currency: CommercialCurrency,
  budgetAllocation: number,
  revenueTarget: number,
): void {
  const current = map.get(currency) || { budgetAllocation: 0, revenueTarget: 0, itemCount: 0 };
  current.budgetAllocation += budgetAllocation;
  current.revenueTarget += revenueTarget;
  current.itemCount += 1;
  map.set(currency, current);
}

function mapCurrencyRollups(
  map: Map<
    CommercialCurrency,
    { budgetAllocation: number; revenueTarget: number; itemCount: number }
  >,
) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => ({
      currency,
      budgetAllocation: roundMoney(value.budgetAllocation),
      revenueTarget: roundMoney(value.revenueTarget),
      itemCount: value.itemCount,
    }));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function createAudit(
  tx: Prisma.TransactionClient,
  input: {
    action: string;
    userId: string;
    targetObjectType: string;
    targetObjectId: string;
    reason: string;
    afterState?: unknown;
  },
): Promise<void> {
  await tx.auditRecord.create({
    data: {
      audit_type: 'annual_commercial_planning',
      action: input.action,
      result: 'success',
      human_user_id: input.userId,
      target_object_type: input.targetObjectType,
      target_object_id: input.targetObjectId,
      source_module: 'commercial-annual-planning',
      reason: input.reason,
      after_state:
        input.afterState == null
          ? Prisma.JsonNull
          : (JSON.parse(JSON.stringify(input.afterState)) as Prisma.InputJsonValue),
    },
  });
}
