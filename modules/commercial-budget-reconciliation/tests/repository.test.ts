import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';

const db = vi.hoisted(() => ({
  annualCommercialPlan: { findFirst: vi.fn() },
  monthlyPortfolioItem: { findFirst: vi.fn() },
  commercialBudgetAllocation: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  commercialBudgetLedgerEntry: { create: vi.fn() },
  commercialPlanHierarchyAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  commercialPlanEventLink: { findFirst: vi.fn(), findMany: vi.fn() },
  commercialPlanCampaignLink: { findFirst: vi.fn(), findMany: vi.fn() },
  eventKpiRecord: { findFirst: vi.fn(), findMany: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn() },
  auditRecord: { create: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  ...db,
  $transaction: vi.fn(async (callback: (client: typeof db) => unknown) => callback(db)),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import {
  createBudgetAllocation,
  getBudgetReconciliation,
  reallocateBudget,
  verifyKpiEvidence,
} from '../repository';

const annualPlanId = '00000000-0000-0000-0000-000000000100';
const monthId = '00000000-0000-0000-0000-000000000200';
const allocationId = '00000000-0000-0000-0000-000000000300';
const actorId = '00000000-0000-0000-0000-000000000001';

function annual(overrides: Record<string, unknown> = {}) {
  return {
    id: annualPlanId,
    tenant_key: 'tenant-a',
    year: 2027,
    title: '2027 Commercial Plan',
    currency: 'AED',
    budget_target: new Prisma.Decimal(1000),
    status: 'approved',
    items: [],
    ...overrides,
  };
}

function allocation(overrides: Record<string, unknown> = {}) {
  return {
    id: allocationId,
    tenant_key: 'tenant-a',
    annual_plan_id: annualPlanId,
    parent_allocation_id: null,
    level: 'monthly_item',
    monthly_portfolio_item_id: monthId,
    commercial_plan_id: null,
    event_id: null,
    campaign_id: null,
    currency: 'AED',
    amount: new Prisma.Decimal(400),
    status: 'planned',
    revision: 1,
    reason: 'January allocation.',
    over_allocation_exception_reason: null,
    exception_approved_at: null,
    archived_at: null,
    monthly_portfolio_item: {
      id: monthId,
      title: 'January launch',
      month: 1,
      revenue_line_id: '00000000-0000-0000-0000-000000000400',
      revenue_line: {
        id: '00000000-0000-0000-0000-000000000400',
        name: 'Online Courses',
      },
    },
    commercial_plan: null,
    event: null,
    campaign: null,
    ...overrides,
  };
}

describe('commercial budget reconciliation repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.commercialBudgetAllocation.aggregate.mockResolvedValue({ _sum: { amount: null } });
    db.commercialBudgetAllocation.findMany.mockResolvedValue([]);
    db.commercialPlanHierarchyAssignment.findMany.mockResolvedValue([]);
    db.commercialPlanEventLink.findMany.mockResolvedValue([]);
    db.commercialPlanCampaignLink.findMany.mockResolvedValue([]);
    db.eventKpiRecord.findMany.mockResolvedValue([]);
    db.eventKpiRecord.groupBy.mockResolvedValue([]);
    db.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
    db.commercialBudgetLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
  });

  it('rejects cross-tenant annual plan access', async () => {
    db.annualCommercialPlan.findFirst.mockResolvedValue(null);
    await expect(getBudgetReconciliation('tenant-b', annualPlanId)).rejects.toThrow(NotFoundError);
  });

  it('rejects root allocations above the annual envelope without an executive exception', async () => {
    db.annualCommercialPlan.findFirst.mockResolvedValue(annual());
    db.monthlyPortfolioItem.findFirst.mockResolvedValue({ id: monthId, title: 'January launch' });
    db.commercialBudgetAllocation.findFirst.mockResolvedValue(null);
    db.commercialBudgetAllocation.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(900) } });

    await expect(createBudgetAllocation('tenant-a', actorId, null, annualPlanId, {
      level: 'monthly_item',
      monthlyPortfolioItemId: monthId,
      currency: 'AED',
      amount: 200,
      reason: 'January launch allocation.',
      allowOverAllocation: false,
    })).rejects.toThrow(ValidationError);

    expect(db.commercialBudgetAllocation.create).not.toHaveBeenCalled();
    expect(db.commercialBudgetLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('records immutable ledger and audit evidence for a governed allocation', async () => {
    db.annualCommercialPlan.findFirst
      .mockResolvedValueOnce(annual())
      .mockResolvedValueOnce(annual({ items: [] }));
    db.monthlyPortfolioItem.findFirst.mockResolvedValue({ id: monthId, title: 'January launch' });
    db.commercialBudgetAllocation.findFirst.mockResolvedValue(null);
    db.commercialBudgetAllocation.create.mockResolvedValue(allocation());
    db.commercialBudgetAllocation.findMany.mockResolvedValue([allocation()]);

    const result = await createBudgetAllocation('tenant-a', actorId, null, annualPlanId, {
      level: 'monthly_item',
      monthlyPortfolioItemId: monthId,
      currency: 'AED',
      amount: 400,
      reason: 'January launch allocation.',
      allowOverAllocation: false,
    });

    expect(db.commercialBudgetLedgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_key: 'tenant-a',
        allocation_id: allocationId,
        entry_type: 'allocated',
        amount_after: expect.any(Prisma.Decimal),
      }),
    }));
    expect(db.auditRecord.create).toHaveBeenCalled();
    expect(result.changedAllocationId).toBe(allocationId);
    expect(result.allocations[0]).toMatchObject({ amount: 400, status: 'planned' });
  });

  it('rejects stale allocation revisions before any write', async () => {
    db.annualCommercialPlan.findFirst.mockResolvedValue(annual());
    db.commercialBudgetAllocation.findFirst.mockResolvedValue(allocation({ revision: 3 }));

    await expect(reallocateBudget('tenant-a', actorId, null, annualPlanId, allocationId, {
      expectedRevision: 2,
      amount: 450,
      reason: 'Stale allocation change.',
      allowOverAllocation: false,
    })).rejects.toThrow(ConflictError);

    expect(db.commercialBudgetAllocation.updateMany).not.toHaveBeenCalled();
  });

  it('keeps AED and USD envelopes separate without implicit conversion', async () => {
    db.annualCommercialPlan.findFirst.mockResolvedValue(annual());
    db.commercialBudgetAllocation.findMany.mockResolvedValue([
      allocation({ amount: new Prisma.Decimal(600), status: 'approved' }),
      allocation({
        id: '00000000-0000-0000-0000-000000000301',
        monthly_portfolio_item_id: '00000000-0000-0000-0000-000000000201',
        currency: 'USD',
        amount: new Prisma.Decimal(100),
        monthly_portfolio_item: {
          id: '00000000-0000-0000-0000-000000000201',
          title: 'USD partnership',
          month: 2,
          revenue_line_id: '00000000-0000-0000-0000-000000000401',
          revenue_line: { id: '00000000-0000-0000-0000-000000000401', name: 'B2B' },
        },
      }),
    ]);

    const result = await getBudgetReconciliation('tenant-a', annualPlanId);
    expect(result.currencies).toEqual([
      expect.objectContaining({ currency: 'AED', annualEnvelope: 1000, allocated: 600, remaining: 400 }),
      expect.objectContaining({ currency: 'USD', annualEnvelope: null, allocated: 100, envelopeMissing: true }),
    ]);
  });

  it('uses optimistic concurrency and persistent audit when reviewing spend evidence', async () => {
    db.eventKpiRecord.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000901',
      tenant_key: 'tenant-a',
      event_id: '00000000-0000-0000-0000-000000000902',
      source_type: 'connector',
      source_name: 'meta_analytics',
      spend: new Prisma.Decimal(250),
      currency: 'AED',
      revision: 4,
    });
    db.eventKpiRecord.updateMany.mockResolvedValue({ count: 1 });

    const result = await verifyKpiEvidence(
      'tenant-a',
      actorId,
      '00000000-0000-0000-0000-000000000901',
      { expectedRevision: 4, decision: 'verified', reason: 'Matched connector evidence.' },
    );

    expect(db.eventKpiRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', revision: 4 }),
      data: expect.objectContaining({ verification_status: 'verified', revision: { increment: 1 } }),
    }));
    expect(db.auditRecord.create).toHaveBeenCalled();
    expect(result).toMatchObject({ verificationStatus: 'verified', revision: 5 });
  });
});
