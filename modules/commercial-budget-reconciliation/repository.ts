import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, NotFoundError, StateTransitionError, ValidationError } from '@shared/errors';
import type {
  BudgetAllocationSummary,
  BudgetStatus,
  BudgetTransitionInput,
  CommercialCurrency,
  CreateBudgetAllocationInput,
  CurrencyReconciliation,
  ReallocateBudgetInput,
  VerifyKpiEvidenceInput,
} from './types';

type Tx = Prisma.TransactionClient;

const allocationInclude = Prisma.validator<Prisma.CommercialBudgetAllocationInclude>()({
  monthly_portfolio_item: {
    include: { revenue_line: { select: { id: true, name: true } } },
  },
  commercial_plan: { select: { id: true, title: true } },
  event: { select: { id: true, name: true } },
  campaign: { select: { id: true, raw_message: true, objective: true } },
});

type AllocationRecord = Prisma.CommercialBudgetAllocationGetPayload<{
  include: typeof allocationInclude;
}>;

export async function getBudgetReconciliation(tenantKey: string, annualPlanId: string) {
  const annualPlan = await prisma.annualCommercialPlan.findFirst({
    where: { id: annualPlanId, tenant_key: tenantKey },
    include: {
      items: {
        where: { archived_at: null },
        include: { revenue_line: { select: { id: true, name: true } } },
        orderBy: [{ month: 'asc' }, { sort_order: 'asc' }],
      },
    },
  });
  if (!annualPlan) throw new NotFoundError('AnnualCommercialPlan', annualPlanId);

  const allocations = await prisma.commercialBudgetAllocation.findMany({
    where: { tenant_key: tenantKey, annual_plan_id: annualPlanId, archived_at: null },
    include: allocationInclude,
    orderBy: [{ created_at: 'asc' }],
  });
  const assignments = await prisma.commercialPlanHierarchyAssignment.findMany({
    where: { tenant_key: tenantKey, annual_plan_id: annualPlanId, status: 'active' },
    select: {
      commercial_plan_id: true,
      monthly_portfolio_item_id: true,
      commercial_plan: { select: { title: true } },
    },
  });
  const planIds = assignments.map((assignment) => assignment.commercial_plan_id);
  const [eventLinks, campaignLinks] = planIds.length
    ? await Promise.all([
        prisma.commercialPlanEventLink.findMany({
          where: { tenant_key: tenantKey, commercial_plan_id: { in: planIds }, status: 'active' },
          select: {
            event_id: true,
            commercial_plan_id: true,
            event: { select: { name: true } },
          },
        }),
        prisma.commercialPlanCampaignLink.findMany({
          where: { tenant_key: tenantKey, commercial_plan_id: { in: planIds }, status: 'active' },
          select: {
            campaign_id: true,
            commercial_plan_id: true,
            campaign: { select: { raw_message: true, objective: true } },
          },
        }),
      ])
    : [[], []];
  const eventIds = [...new Set(eventLinks.map((link) => link.event_id))];
  const campaignIds = [...new Set(campaignLinks.map((link) => link.campaign_id))];
  const evidenceWhere: Prisma.EventKpiRecordWhereInput = {
    tenant_key: tenantKey,
    OR: [
      ...(eventIds.length ? [{ event_id: { in: eventIds } }] : []),
      ...(campaignIds.length ? [{ campaign_id: { in: campaignIds } }] : []),
    ],
  };
  const [verifiedEvidence, evidenceCounts] = evidenceWhere.OR?.length
    ? await Promise.all([
        prisma.eventKpiRecord.findMany({
          where: { ...evidenceWhere, verification_status: 'verified' },
          select: {
            id: true,
            event_id: true,
            campaign_id: true,
            currency: true,
            spend: true,
            source_type: true,
            source_name: true,
            source_record_key: true,
            connector_import_job_id: true,
            metric_date: true,
            channel: true,
            verified_at: true,
          },
          orderBy: [{ metric_date: 'desc' }, { created_at: 'desc' }],
          take: 1000,
        }),
        prisma.eventKpiRecord.groupBy({
          by: ['verification_status'],
          where: evidenceWhere,
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const actualByAllocation = attributeActualSpend(
    allocations,
    assignments,
    eventLinks,
    campaignLinks,
    verifiedEvidence,
  );
  const roots = buildAllocationTree(allocations, actualByAllocation);
  const currencies = buildCurrencyReconciliation(
    annualPlan.currency,
    money(annualPlan.budget_target),
    allocations,
    verifiedEvidence,
  );
  const counts = new Map(evidenceCounts.map((entry) => [entry.verification_status, entry._count._all]));

  return {
    annualPlan: {
      id: annualPlan.id,
      title: annualPlan.title,
      year: annualPlan.year,
      status: annualPlan.status,
      currency: annualPlan.currency,
      budgetTarget: money(annualPlan.budget_target),
    },
    semantics: {
      requested: 'Budget targets entered during planning; they are not approved allocation authority.',
      allocated: 'Current governed allocation assigned from a parent envelope.',
      approved: 'Allocation approved by executive authority.',
      committed: 'Approved allocation reserved for execution.',
      actual: 'Spend from verified imported or approved evidence only.',
      remaining: 'Parent allocation minus active child allocations.',
      variance: 'Governed allocation minus verified actual spend.',
    },
    currencies,
    allocations: roots,
    monthlyItems: annualPlan.items.map((item) => {
      const allocation = allocations.find(
        (candidate) => candidate.monthly_portfolio_item_id === item.id,
      );
      return {
        id: item.id,
        month: item.month,
        title: item.title,
        revenueLineId: item.revenue_line_id,
        revenueLineName: item.revenue_line.name,
        currency: item.currency,
        requestedTarget: money(item.budget_allocation),
        allocationId: allocation?.id ?? null,
        governedAllocation: allocation ? money(allocation.amount) : 0,
        status: allocation?.status ?? null,
      };
    }),
    availableTargets: [
      ...assignments.map((assignment) => ({
        level: 'commercial_plan' as const,
        id: assignment.commercial_plan_id,
        label: assignment.commercial_plan.title,
        parentTargetId: assignment.monthly_portfolio_item_id,
      })),
      ...eventLinks.map((link) => ({
        level: 'event' as const,
        id: link.event_id,
        label: link.event.name,
        parentTargetId: link.commercial_plan_id,
      })),
      ...campaignLinks.map((link) => ({
        level: 'campaign' as const,
        id: link.campaign_id,
        label: firstLine(link.campaign.raw_message) || link.campaign.objective || 'Campaign',
        parentTargetId: link.commercial_plan_id,
      })),
    ],
    evidence: {
      verifiedCount: counts.get('verified') ?? 0,
      unverifiedCount: counts.get('unverified') ?? 0,
      rejectedCount: counts.get('rejected') ?? 0,
      sourceMissing: verifiedEvidence.length === 0,
      message:
        verifiedEvidence.length === 0
          ? 'No verified spend evidence is available for this annual plan yet.'
          : `${verifiedEvidence.length} verified spend record(s) support the actual totals.`,
      records: verifiedEvidence.map((record) => ({
        id: record.id,
        currency: record.currency,
        spend: money(record.spend),
        sourceType: record.source_type,
        sourceName: record.source_name,
        sourceRecordKey: record.source_record_key,
        importJobId: record.connector_import_job_id,
        metricDate: record.metric_date,
        channel: record.channel,
        eventId: record.event_id,
        campaignId: record.campaign_id,
        verifiedAt: record.verified_at,
      })),
    },
  };
}

export async function createBudgetAllocation(
  tenantKey: string,
  userId: string,
  exceptionApproverId: string | null,
  annualPlanId: string,
  input: CreateBudgetAllocationInput,
) {
  let changedAllocationId = '';
  await prisma.$transaction(async (tx) => {
    const annual = await annualPlan(tx, tenantKey, annualPlanId);
    const target = await resolveTarget(tx, tenantKey, annualPlanId, input);
    const duplicate = await tx.commercialBudgetAllocation.findFirst({
      where: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        archived_at: null,
        ...target.where,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('This work item already has an active budget allocation');

    const capacity = await validateCapacity(
      tx,
      tenantKey,
      annual,
      input.parentAllocationId ?? null,
      input.currency,
      input.amount,
      null,
      input.allowOverAllocation,
      input.exceptionReason,
      exceptionApproverId,
    );
    const allocation = await tx.commercialBudgetAllocation.create({
      data: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        parent_allocation_id: input.parentAllocationId ?? null,
        level: input.level,
        ...target.data,
        currency: input.currency,
        amount: decimal(input.amount),
        reason: input.reason,
        created_by_user_id: userId,
        ...capacity.exception,
      },
    });
    changedAllocationId = allocation.id;
    await ledger(tx, tenantKey, allocation.id, 'allocated', input.currency, userId, input.reason, {
      amountAfter: input.amount,
      statusAfter: allocation.status,
      metadata: { level: input.level, targetLabel: target.label },
    });
    if (capacity.exception.over_allocation_exception_reason) {
      await ledger(
        tx,
        tenantKey,
        allocation.id,
        'exception_approved',
        input.currency,
        userId,
        capacity.exception.over_allocation_exception_reason,
        { amountAfter: input.amount, statusAfter: allocation.status },
      );
    }
    await audit(tx, userId, 'commercial_budget_allocated', allocation.id, {
      annualPlanId,
      level: input.level,
      amount: input.amount,
      currency: input.currency,
      exceptionApproved: Boolean(capacity.exception.exception_approved_at),
    });
  });
  const reconciliation = await getBudgetReconciliation(tenantKey, annualPlanId);
  return { ...reconciliation, changedAllocationId };
}

export async function reallocateBudget(
  tenantKey: string,
  userId: string,
  exceptionApproverId: string | null,
  annualPlanId: string,
  allocationId: string,
  input: ReallocateBudgetInput,
) {
  await prisma.$transaction(async (tx) => {
    const annual = await annualPlan(tx, tenantKey, annualPlanId);
    const existing = await activeAllocation(tx, tenantKey, annualPlanId, allocationId);
    if (existing.status === 'committed') {
      throw new ValidationError('Committed budget cannot be reallocated; create an approved replacement allocation');
    }
    assertRevision(existing.revision, input.expectedRevision);
    const capacity = await validateCapacity(
      tx,
      tenantKey,
      annual,
      existing.parent_allocation_id,
      existing.currency,
      input.amount,
      existing.id,
      input.allowOverAllocation,
      input.exceptionReason,
      exceptionApproverId,
    );
    const children = await tx.commercialBudgetAllocation.aggregate({
      where: { parent_allocation_id: existing.id, archived_at: null },
      _sum: { amount: true },
    });
    const childTotal = money(children._sum.amount);
    if (childTotal > input.amount && !capacity.exception.exception_approved_at) {
      throw new ValidationError(
        `This allocation has ${childTotal.toFixed(2)} assigned to child work and cannot be reduced to ${input.amount.toFixed(2)}`,
      );
    }
    const updated = await tx.commercialBudgetAllocation.updateMany({
      where: { id: allocationId, tenant_key: tenantKey, revision: input.expectedRevision, archived_at: null },
      data: {
        amount: decimal(input.amount),
        reason: input.reason,
        revision: { increment: 1 },
        ...capacity.exception,
      },
    });
    if (!updated.count) throw new ConflictError('Budget allocation changed; refresh before saving again');
    await ledger(tx, tenantKey, allocationId, 'reallocated', existing.currency, userId, input.reason, {
      amountBefore: money(existing.amount),
      amountAfter: input.amount,
      statusBefore: existing.status,
      statusAfter: existing.status,
    });
    if (capacity.exception.over_allocation_exception_reason) {
      await ledger(
        tx,
        tenantKey,
        allocationId,
        'exception_approved',
        existing.currency,
        userId,
        capacity.exception.over_allocation_exception_reason,
        { amountBefore: money(existing.amount), amountAfter: input.amount, statusAfter: existing.status },
      );
    }
    await audit(tx, userId, 'commercial_budget_reallocated', allocationId, {
      before: money(existing.amount),
      after: input.amount,
      currency: existing.currency,
      expectedRevision: input.expectedRevision,
    });
  });
  return getBudgetReconciliation(tenantKey, annualPlanId);
}

export async function transitionBudgetAllocation(
  tenantKey: string,
  userId: string,
  annualPlanId: string,
  allocationId: string,
  target: 'approved' | 'committed' | 'archived',
  input: BudgetTransitionInput,
) {
  await prisma.$transaction(async (tx) => {
    const annual = await annualPlan(tx, tenantKey, annualPlanId);
    const existing = await activeAllocation(tx, tenantKey, annualPlanId, allocationId);
    assertRevision(existing.revision, input.expectedRevision);
    const allowed: Record<BudgetStatus, BudgetStatus[]> = {
      planned: ['approved', 'archived'],
      approved: ['committed', 'archived'],
      committed: [],
      archived: [],
    };
    if (!allowed[existing.status].includes(target)) {
      throw new StateTransitionError(existing.status, target);
    }
    if (target === 'approved' && !['approved', 'active'].includes(annual.status)) {
      throw new ValidationError('Approve the annual plan before approving its budget allocations');
    }
    if (target === 'archived') {
      const childCount = await tx.commercialBudgetAllocation.count({
        where: { parent_allocation_id: allocationId, archived_at: null },
      });
      if (childCount) throw new ValidationError('Archive child budget allocations first');
    }
    const now = new Date();
    const updated = await tx.commercialBudgetAllocation.updateMany({
      where: { id: allocationId, tenant_key: tenantKey, revision: input.expectedRevision, archived_at: null },
      data: {
        status: target,
        revision: { increment: 1 },
        ...(target === 'approved' ? { approved_by_user_id: userId, approved_at: now } : {}),
        ...(target === 'committed' ? { committed_by_user_id: userId, committed_at: now } : {}),
        ...(target === 'archived'
          ? { archived_by_user_id: userId, archived_at: now }
          : {}),
      },
    });
    if (!updated.count) throw new ConflictError('Budget allocation changed; refresh before continuing');
    await ledger(tx, tenantKey, allocationId, target, existing.currency, userId, input.reason, {
      amountBefore: money(existing.amount),
      amountAfter: money(existing.amount),
      statusBefore: existing.status,
      statusAfter: target,
    });
    await audit(tx, userId, `commercial_budget_${target}`, allocationId, {
      from: existing.status,
      to: target,
      reason: input.reason,
    });
  });
  return getBudgetReconciliation(tenantKey, annualPlanId);
}

export async function verifyKpiEvidence(
  tenantKey: string,
  userId: string,
  kpiId: string,
  input: VerifyKpiEvidenceInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.eventKpiRecord.findFirst({
      where: { id: kpiId, tenant_key: tenantKey },
    });
    if (!existing) throw new NotFoundError('EventKpiRecord', kpiId);
    assertRevision(existing.revision, input.expectedRevision);
    const now = new Date();
    const updated = await tx.eventKpiRecord.updateMany({
      where: { id: kpiId, tenant_key: tenantKey, revision: input.expectedRevision },
      data: {
        verification_status: input.decision,
        verification_reason: input.reason,
        verified_by_user_id: input.decision === 'verified' ? userId : null,
        verified_at: input.decision === 'verified' ? now : null,
        updated_by_user_id: userId,
        revision: { increment: 1 },
      },
    });
    if (!updated.count) throw new ConflictError('KPI evidence changed; refresh before reviewing again');
    await audit(tx, userId, `event_kpi_${input.decision}`, kpiId, {
      eventId: existing.event_id,
      sourceType: existing.source_type,
      sourceName: existing.source_name,
      spend: money(existing.spend),
      currency: existing.currency,
      reason: input.reason,
    });
    return {
      id: existing.id,
      verificationStatus: input.decision,
      revision: input.expectedRevision + 1,
      verifiedAt: input.decision === 'verified' ? now : null,
    };
  });
}

async function resolveTarget(
  tx: Tx,
  tenantKey: string,
  annualPlanId: string,
  input: CreateBudgetAllocationInput,
) {
  if (input.level === 'monthly_item') {
    const item = await tx.monthlyPortfolioItem.findFirst({
      where: {
        id: input.monthlyPortfolioItemId!,
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        archived_at: null,
      },
      select: { id: true, title: true },
    });
    if (!item) throw new NotFoundError('MonthlyPortfolioItem', input.monthlyPortfolioItemId!);
    return {
      label: item.title,
      where: { monthly_portfolio_item_id: item.id },
      data: { monthly_portfolio_item_id: item.id },
    };
  }
  const parent = await activeAllocation(tx, tenantKey, annualPlanId, input.parentAllocationId!);
  if (parent.currency !== input.currency) {
    throw new ValidationError('Child allocations must use the same currency as their parent');
  }
  if (input.level === 'commercial_plan') {
    if (parent.level !== 'monthly_item') throw new ValidationError('A commercial plan budget must belong to a monthly allocation');
    const assignment = await tx.commercialPlanHierarchyAssignment.findFirst({
      where: {
        tenant_key: tenantKey,
        annual_plan_id: annualPlanId,
        monthly_portfolio_item_id: parent.monthly_portfolio_item_id!,
        commercial_plan_id: input.commercialPlanId!,
        status: 'active',
      },
      include: { commercial_plan: { select: { id: true, title: true } } },
    });
    if (!assignment) throw new ValidationError('The commercial plan is not assigned to this annual month');
    return {
      label: assignment.commercial_plan.title,
      where: { commercial_plan_id: assignment.commercial_plan_id },
      data: { commercial_plan_id: assignment.commercial_plan_id },
    };
  }
  if (parent.level !== 'commercial_plan') {
    throw new ValidationError('Event and campaign budgets must belong to a commercial plan allocation');
  }
  if (input.level === 'event') {
    const link = await tx.commercialPlanEventLink.findFirst({
      where: {
        tenant_key: tenantKey,
        commercial_plan_id: parent.commercial_plan_id!,
        event_id: input.eventId!,
        status: 'active',
      },
      include: { event: { select: { id: true, name: true } } },
    });
    if (!link) throw new ValidationError('The event is not actively linked to this commercial plan');
    return {
      label: link.event.name,
      where: { event_id: link.event_id },
      data: { event_id: link.event_id },
    };
  }
  const link = await tx.commercialPlanCampaignLink.findFirst({
    where: {
      tenant_key: tenantKey,
      commercial_plan_id: parent.commercial_plan_id!,
      campaign_id: input.campaignId!,
      status: 'active',
    },
    include: { campaign: { select: { id: true, raw_message: true, objective: true } } },
  });
  if (!link) throw new ValidationError('The campaign is not actively linked to this commercial plan');
  return {
    label: firstLine(link.campaign.raw_message) || link.campaign.objective || 'Campaign',
    where: { campaign_id: link.campaign_id },
    data: { campaign_id: link.campaign_id },
  };
}

async function validateCapacity(
  tx: Tx,
  tenantKey: string,
  annual: { id: string; currency: CommercialCurrency; budget_target: Prisma.Decimal },
  parentAllocationId: string | null,
  currency: CommercialCurrency,
  amount: number,
  excludeAllocationId: string | null,
  allowOverAllocation: boolean,
  exceptionReason: string | undefined,
  exceptionApproverId: string | null,
) {
  let limit: number | null;
  let assigned: number;
  if (parentAllocationId) {
    const parent = await activeAllocation(tx, tenantKey, annual.id, parentAllocationId);
    if (parent.currency !== currency) {
      throw new ValidationError('Child allocations must use the same currency as their parent');
    }
    limit = money(parent.amount);
    const siblings = await tx.commercialBudgetAllocation.aggregate({
      where: {
        parent_allocation_id: parentAllocationId,
        archived_at: null,
        ...(excludeAllocationId ? { id: { not: excludeAllocationId } } : {}),
      },
      _sum: { amount: true },
    });
    assigned = money(siblings._sum.amount);
  } else {
    limit = currency === annual.currency ? money(annual.budget_target) : null;
    const roots = await tx.commercialBudgetAllocation.aggregate({
      where: {
        tenant_key: tenantKey,
        annual_plan_id: annual.id,
        parent_allocation_id: null,
        currency,
        archived_at: null,
        ...(excludeAllocationId ? { id: { not: excludeAllocationId } } : {}),
      },
      _sum: { amount: true },
    });
    assigned = money(roots._sum.amount);
  }
  const over = limit == null || roundMoney(assigned + amount) > limit;
  if (!over) return { exception: emptyException() };
  if (!allowOverAllocation || !exceptionReason || !exceptionApproverId) {
    const message =
      limit == null
        ? `The annual plan has no ${currency} envelope. An executive-approved currency exception is required.`
        : `This would allocate ${roundMoney(assigned + amount).toFixed(2)} ${currency} against ${limit.toFixed(2)} ${currency} available.`;
    throw new ValidationError(message);
  }
  return {
    exception: {
      over_allocation_exception_reason: exceptionReason,
      exception_approved_by_user_id: exceptionApproverId,
      exception_approved_at: new Date(),
    },
  };
}

async function annualPlan(tx: Tx, tenantKey: string, annualPlanId: string) {
  const plan = await tx.annualCommercialPlan.findFirst({
    where: { id: annualPlanId, tenant_key: tenantKey },
    select: { id: true, currency: true, budget_target: true, status: true },
  });
  if (!plan) throw new NotFoundError('AnnualCommercialPlan', annualPlanId);
  return plan;
}

async function activeAllocation(
  tx: Tx,
  tenantKey: string,
  annualPlanId: string,
  allocationId: string,
) {
  const allocation = await tx.commercialBudgetAllocation.findFirst({
    where: { id: allocationId, tenant_key: tenantKey, annual_plan_id: annualPlanId, archived_at: null },
  });
  if (!allocation) throw new NotFoundError('CommercialBudgetAllocation', allocationId);
  return allocation;
}

function attributeActualSpend(
  allocations: AllocationRecord[],
  assignments: Array<{ commercial_plan_id: string; monthly_portfolio_item_id: string }>,
  eventLinks: Array<{ event_id: string; commercial_plan_id: string }>,
  campaignLinks: Array<{ campaign_id: string; commercial_plan_id: string }>,
  evidence: Array<{
    id: string;
    event_id: string;
    campaign_id: string | null;
    currency: CommercialCurrency;
    spend: Prisma.Decimal;
  }>,
) {
  const byCampaign = new Map(allocations.filter((a) => a.campaign_id).map((a) => [a.campaign_id!, a]));
  const byEvent = new Map(allocations.filter((a) => a.event_id).map((a) => [a.event_id!, a]));
  const byPlan = new Map(allocations.filter((a) => a.commercial_plan_id).map((a) => [a.commercial_plan_id!, a]));
  const byMonth = new Map(allocations.filter((a) => a.monthly_portfolio_item_id).map((a) => [a.monthly_portfolio_item_id!, a]));
  const parent = new Map(allocations.map((a) => [a.id, a.parent_allocation_id]));
  const assignmentByPlan = new Map(assignments.map((a) => [a.commercial_plan_id, a]));
  const planByEvent = new Map(eventLinks.map((link) => [link.event_id, link.commercial_plan_id]));
  const planByCampaign = new Map(campaignLinks.map((link) => [link.campaign_id, link.commercial_plan_id]));
  const actual = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of evidence) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const planId =
      (row.campaign_id ? planByCampaign.get(row.campaign_id) : undefined) ??
      planByEvent.get(row.event_id);
    const assignment = planId ? assignmentByPlan.get(planId) : undefined;
    let allocation =
      (row.campaign_id ? byCampaign.get(row.campaign_id) : undefined) ??
      byEvent.get(row.event_id) ??
      (planId ? byPlan.get(planId) : undefined) ??
      (assignment ? byMonth.get(assignment.monthly_portfolio_item_id) : undefined);
    while (allocation) {
      if (allocation.currency === row.currency) {
        actual.set(allocation.id, roundMoney((actual.get(allocation.id) ?? 0) + money(row.spend)));
      }
      const parentId = parent.get(allocation.id);
      allocation = parentId ? allocations.find((candidate) => candidate.id === parentId) : undefined;
    }
  }
  return actual;
}

function buildAllocationTree(records: AllocationRecord[], actual: Map<string, number>) {
  const children = new Map<string | null, AllocationRecord[]>();
  for (const record of records) {
    const group = children.get(record.parent_allocation_id) ?? [];
    group.push(record);
    children.set(record.parent_allocation_id, group);
  }
  const map = (record: AllocationRecord): BudgetAllocationSummary => {
    const mappedChildren = (children.get(record.id) ?? []).map(map);
    const amount = money(record.amount);
    const verifiedActual = actual.get(record.id) ?? 0;
    const childAllocated = roundMoney(mappedChildren.reduce((sum, child) => sum + child.amount, 0));
    return {
      id: record.id,
      parentAllocationId: record.parent_allocation_id,
      level: record.level,
      target: targetSummary(record),
      currency: record.currency,
      amount,
      status: record.status,
      revision: record.revision,
      reason: record.reason,
      exceptionApproved: Boolean(record.exception_approved_at),
      exceptionReason: record.over_allocation_exception_reason,
      verifiedActual,
      remaining: roundMoney(amount - verifiedActual),
      variance: roundMoney(amount - verifiedActual),
      childAllocated,
      childRemaining: roundMoney(amount - childAllocated),
      children: mappedChildren,
    };
  };
  return (children.get(null) ?? []).map(map);
}

function buildCurrencyReconciliation(
  annualCurrency: CommercialCurrency,
  annualBudget: number,
  allocations: AllocationRecord[],
  evidence: Array<{ currency: CommercialCurrency; spend: Prisma.Decimal }>,
): CurrencyReconciliation[] {
  const currencies = new Set<CommercialCurrency>([annualCurrency]);
  allocations.forEach((allocation) => currencies.add(allocation.currency));
  evidence.forEach((row) => currencies.add(row.currency));
  return [...currencies]
    .sort()
    .map((currency) => {
      const roots = allocations.filter(
        (allocation) => allocation.parent_allocation_id == null && allocation.currency === currency,
      );
      const allocated = roundMoney(roots.reduce((sum, allocation) => sum + money(allocation.amount), 0));
      const approved = roundMoney(
        roots
          .filter((allocation) => allocation.status === 'approved' || allocation.status === 'committed')
          .reduce((sum, allocation) => sum + money(allocation.amount), 0),
      );
      const committed = roundMoney(
        roots
          .filter((allocation) => allocation.status === 'committed')
          .reduce((sum, allocation) => sum + money(allocation.amount), 0),
      );
      const verifiedActual = roundMoney(
        evidence
          .filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + money(row.spend), 0),
      );
      const annualEnvelope = currency === annualCurrency ? annualBudget : null;
      return {
        currency,
        annualEnvelope,
        allocated,
        approved,
        committed,
        verifiedActual,
        remaining: annualEnvelope == null ? null : roundMoney(annualEnvelope - allocated),
        variance: annualEnvelope == null ? null : roundMoney(annualEnvelope - verifiedActual),
        overAllocated: annualEnvelope != null ? allocated > annualEnvelope : allocated > 0,
        envelopeMissing: annualEnvelope == null,
      };
    });
}

function targetSummary(record: AllocationRecord) {
  if (record.monthly_portfolio_item) {
    return {
      id: record.monthly_portfolio_item.id,
      label: record.monthly_portfolio_item.title,
      month: record.monthly_portfolio_item.month,
      revenueLineId: record.monthly_portfolio_item.revenue_line_id,
      revenueLineName: record.monthly_portfolio_item.revenue_line.name,
    };
  }
  if (record.commercial_plan) {
    return { id: record.commercial_plan.id, label: record.commercial_plan.title, month: null, revenueLineId: null, revenueLineName: null };
  }
  if (record.event) {
    return { id: record.event.id, label: record.event.name, month: null, revenueLineId: null, revenueLineName: null };
  }
  return {
    id: record.campaign!.id,
    label: firstLine(record.campaign!.raw_message) || record.campaign!.objective || 'Campaign',
    month: null,
    revenueLineId: null,
    revenueLineName: null,
  };
}

async function ledger(
  tx: Tx,
  tenantKey: string,
  allocationId: string,
  entryType: 'allocated' | 'reallocated' | 'approved' | 'committed' | 'archived' | 'exception_approved',
  currency: CommercialCurrency,
  userId: string,
  reason: string,
  values: {
    amountBefore?: number;
    amountAfter?: number;
    statusBefore?: BudgetStatus;
    statusAfter?: BudgetStatus;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.commercialBudgetLedgerEntry.create({
    data: {
      tenant_key: tenantKey,
      allocation_id: allocationId,
      entry_type: entryType,
      currency,
      amount_before: values.amountBefore == null ? null : decimal(values.amountBefore),
      amount_after: values.amountAfter == null ? null : decimal(values.amountAfter),
      status_before: values.statusBefore ?? null,
      status_after: values.statusAfter ?? null,
      reason,
      actor_user_id: userId,
      metadata: values.metadata,
    },
  });
}

async function audit(tx: Tx, userId: string, action: string, targetId: string, afterState: unknown) {
  await tx.auditRecord.create({
    data: {
      audit_type: 'commercial_budget_reconciliation',
      action,
      result: 'success',
      human_user_id: userId,
      target_object_type: action.startsWith('event_kpi') ? 'event_kpi_record' : 'commercial_budget_allocation',
      target_object_id: targetId,
      source_module: 'commercial-budget-reconciliation',
      reason: action.replaceAll('_', ' '),
      after_state: JSON.parse(JSON.stringify(afterState)) as Prisma.InputJsonValue,
    },
  });
}

function emptyException() {
  return {
    over_allocation_exception_reason: null,
    exception_approved_by_user_id: null,
    exception_approved_at: null,
  };
}

function assertRevision(current: number, expected: number) {
  if (current !== expected) throw new ConflictError('Record changed; refresh before saving again');
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function money(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return roundMoney(value.toNumber());
  }
  return roundMoney(Number(value));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function firstLine(value: string | null | undefined) {
  return value?.split(/\r?\n/, 1)[0]?.trim() ?? '';
}
