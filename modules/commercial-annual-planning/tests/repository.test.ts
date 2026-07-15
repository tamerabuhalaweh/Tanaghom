import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';

const tx = vi.hoisted(() => ({
  annualCommercialPlan: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  annualCommercialPlanLearningSet: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  monthlyPortfolioItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  commercialPlanHierarchyAssignment: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  commercialPlanEventLink: { count: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  commercialPlanCampaignLink: { count: vi.fn() },
  commercialRevenueLine: { findFirst: vi.fn() },
  commercialPlan: { findFirst: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  commercialLearningSet: { findMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  auditRecord: { create: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { createAnnualPlan, createPortfolioItem, updateAnnualPlan, updatePortfolioItem } from '../repository';

function planRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2027-01-01T00:00:00.000Z');
  return {
    id: '00000000-0000-0000-0000-000000000100',
    tenant_key: 'tenant-a',
    year: 2027,
    scenario_version: 1,
    revision: 2,
    title: '2027 Commercial Plan',
    strategy: 'Approved-learning strategy',
    currency: 'AED',
    budget_target: new Prisma.Decimal(500000),
    revenue_target: new Prisma.Decimal(2500000),
    status: 'draft',
    owner_user_id: null,
    created_by_user_id: '00000000-0000-0000-0000-000000000001',
    submitted_by_user_id: null,
    submitted_at: null,
    approved_by_user_id: null,
    approved_at: null,
    rejection_reason: null,
    activated_at: null,
    closed_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
    owner: null,
    created_by: { id: '00000000-0000-0000-0000-000000000001', name: 'Department Head' },
    submitted_by: null,
    approved_by: null,
    items: [],
    learning_links: [],
    ...overrides,
  };
}

describe('annual commercial planning repository governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.tenant.findUnique.mockResolvedValue({ default_currency: 'AED' });
    tx.annualCommercialPlan.updateMany.mockResolvedValue({ count: 1 });
    tx.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('rejects a learning set that is not active in the same tenant', async () => {
    tx.commercialLearningSet.findMany.mockResolvedValue([]);

    await expect(
      createAnnualPlan('tenant-a', '00000000-0000-0000-0000-000000000001', {
        year: 2027,
        title: '2027 Commercial Plan',
        currency: 'AED',
        budgetTarget: 500000,
        revenueTarget: 2500000,
        learningSetIds: ['00000000-0000-0000-0000-000000000090'],
      }),
    ).rejects.toThrow(ValidationError);

    expect(tx.annualCommercialPlan.create).not.toHaveBeenCalled();
  });

  it('rejects a monthly initiative whose revenue line is outside the tenant', async () => {
    tx.annualCommercialPlan.findFirst.mockResolvedValue(planRecord());
    tx.commercialRevenueLine.findFirst.mockResolvedValue(null);

    await expect(
      createPortfolioItem(
        'tenant-a',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        {
          expectedRevision: 2,
          month: 3,
          revenueLineId: '00000000-0000-0000-0000-000000000200',
          title: 'Ramadan virtual event',
          budgetAllocation: 50000,
          revenueTarget: 250000,
          priority: 'high',
          readiness: 'planned',
        },
      ),
    ).rejects.toThrow(NotFoundError);

    expect(tx.annualCommercialPlan.updateMany).not.toHaveBeenCalled();
    expect(tx.monthlyPortfolioItem.create).not.toHaveBeenCalled();
  });

  it('rejects stale revisions before applying changes', async () => {
    tx.annualCommercialPlan.findFirst.mockResolvedValue(planRecord({ revision: 4 }));

    await expect(
      updateAnnualPlan(
        'tenant-a',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        {
          expectedRevision: 3,
          title: 'Stale edit',
        },
      ),
    ).rejects.toThrow(ConflictError);

    expect(tx.annualCommercialPlan.updateMany).not.toHaveBeenCalled();
  });

  it('detects a concurrent update when the atomic revision write matches no row', async () => {
    tx.annualCommercialPlan.findFirst.mockResolvedValue(planRecord());
    tx.annualCommercialPlan.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateAnnualPlan(
        'tenant-a',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        {
          expectedRevision: 2,
          title: 'Concurrent edit',
        },
      ),
    ).rejects.toThrow(ConflictError);

    expect(tx.auditRecord.create).not.toHaveBeenCalled();
  });

  it('requires governed supersession instead of silently replacing a monthly execution plan', async () => {
    const oldPlanId = '00000000-0000-0000-0000-000000000301';
    const replacementPlanId = '00000000-0000-0000-0000-000000000302';
    tx.annualCommercialPlan.findFirst.mockResolvedValue(planRecord());
    tx.monthlyPortfolioItem.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000401',
      month: 3,
      revenue_line_id: '00000000-0000-0000-0000-000000000200',
      commercial_plan_id: oldPlanId,
      event_id: null,
      planned_start_date: null,
      planned_end_date: null,
      owner_user_id: null,
    });
    tx.commercialRevenueLine.findFirst.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000200' });
    tx.commercialPlan.findFirst.mockResolvedValue({
      id: replacementPlanId,
      linked_event_id: null,
      revenue_line_id: '00000000-0000-0000-0000-000000000200',
      status: 'draft',
      superseded_by_plan_id: null,
    });

    await expect(updatePortfolioItem(
      'tenant-a',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000100',
      '00000000-0000-0000-0000-000000000401',
      { expectedRevision: 2, commercialPlanId: replacementPlanId },
    )).rejects.toThrow(/governed supersede action/);

    expect(tx.commercialPlanHierarchyAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('records persistent audit evidence after a successful atomic annual-plan update', async () => {
    tx.annualCommercialPlan.findFirst
      .mockResolvedValueOnce(planRecord())
      .mockResolvedValueOnce(planRecord({ revision: 3, title: 'Updated 2027 Commercial Plan' }));

    const result = await updateAnnualPlan(
      'tenant-a',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000100',
      { expectedRevision: 2, title: 'Updated 2027 Commercial Plan' },
    );

    expect(tx.annualCommercialPlan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_key: 'tenant-a', revision: 2 }),
      }),
    );
    expect(tx.auditRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        audit_type: 'annual_commercial_planning',
        action: 'annual_commercial_plan_updated',
        target_object_id: '00000000-0000-0000-0000-000000000100',
        result: 'success',
      }),
    });
    expect(result).toMatchObject({ revision: 3, title: 'Updated 2027 Commercial Plan' });
  });
});
