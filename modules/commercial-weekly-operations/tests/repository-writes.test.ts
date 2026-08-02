import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '@shared/errors';

const tx = vi.hoisted(() => ({
  commercialPlan: { findFirst: vi.fn() },
  commercialWeeklyWorkItem: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  user: { findFirst: vi.fn() },
  auditRecord: { create: vi.fn() },
  contentItem: { findFirst: vi.fn() },
  leadCaptureRecord: { findFirst: vi.fn() },
  commercialDisciplineRecord: { findFirst: vi.fn() },
  connectorImportJob: { findFirst: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { createWeeklyWorkItem, updateWeeklyWorkItem } from '../repository';

const tenantKey = 'tenant-a';
const planId = '00000000-0000-0000-0000-000000000020';
const itemId = '00000000-0000-0000-0000-000000000010';
const userId = '00000000-0000-0000-0000-000000000001';

function plan() {
  return {
    id: planId,
    tenant_key: tenantKey,
    title: 'Leadership launch execution plan',
    status: 'active',
    currency: 'AED',
    budget_target: 10000,
    revenue_target: 50000,
    linked_event_id: null,
    tenant: { timezone: 'Asia/Dubai' },
    revenue_line: { name: 'Live Events' },
    hierarchy_assignment: {
      annual_plan: { id: 'annual-1', title: '2026 Commercial Plan', year: 2026 },
      monthly_item: {
        id: 'month-1',
        title: 'August launch',
        month: 8,
        planned_start_date: new Date('2026-08-01T12:00:00.000Z'),
        planned_end_date: new Date('2026-08-31T12:00:00.000Z'),
      },
    },
    event_links: [],
    campaign_links: [],
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: itemId,
    tenant_key: tenantKey,
    commercial_plan_id: planId,
    week_start_date: new Date('2026-08-03T12:00:00.000Z'),
    title: 'Approve campaign brief',
    business_outcome: 'Release campaign production.',
    owner_user_id: null,
    owner_role: null,
    start_date: null,
    due_date: new Date('2026-08-05T12:00:00.000Z'),
    status: 'planned',
    priority: 'high',
    budget_guardrail: 3000,
    currency: 'AED',
    link_type: null,
    link_object_id: null,
    link_label: null,
    blocker_reason: null,
    completion_evidence: null,
    revision: 1,
    created_by_user_id: userId,
    approved_by_user_id: null,
    approved_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: new Date('2026-08-02T12:00:00.000Z'),
    updated_at: new Date('2026-08-02T12:00:00.000Z'),
    owner: null,
    ...overrides,
  };
}

describe('weekly work repository writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.commercialPlan.findFirst.mockResolvedValue(plan());
    tx.commercialWeeklyWorkItem.aggregate.mockResolvedValue({ _sum: { budget_guardrail: 2000 } });
    tx.commercialWeeklyWorkItem.create.mockResolvedValue(item());
    tx.commercialWeeklyWorkItem.findFirst.mockResolvedValue(item());
    tx.commercialWeeklyWorkItem.updateMany.mockResolvedValue({ count: 1 });
    tx.commercialWeeklyWorkItem.findUniqueOrThrow.mockResolvedValue(item({ budget_guardrail: 4000, revision: 2 }));
    tx.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('creates tenant-scoped weekly work and persistent audit evidence', async () => {
    const result = await createWeeklyWorkItem(tenantKey, userId, planId, {
      weekStartDate: '2026-08-03',
      title: 'Approve campaign brief',
      businessOutcome: 'Release campaign production.',
      dueDate: '2026-08-05',
      status: 'planned',
      priority: 'high',
      budgetGuardrail: 3000,
    });

    expect(tx.commercialPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: planId, tenant_key: tenantKey },
    }));
    expect(tx.commercialWeeklyWorkItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenant_key: tenantKey, commercial_plan_id: planId, created_by_user_id: userId }),
    }));
    expect(tx.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'commercial_weekly_work_created',
        target_object_id: itemId,
        after_state: expect.objectContaining({ tenantKey, commercialPlanId: planId }),
      }),
    }));
    expect(result).toMatchObject({ id: itemId, revision: 1 });
  });

  it('rejects weekly guardrails that exceed the parent execution-plan budget', async () => {
    tx.commercialWeeklyWorkItem.aggregate.mockResolvedValue({ _sum: { budget_guardrail: 9000 } });
    await expect(createWeeklyWorkItem(tenantKey, userId, planId, {
      weekStartDate: '2026-08-03',
      title: 'Overallocated media work',
      businessOutcome: 'Protect launch reach.',
      status: 'planned',
      priority: 'high',
      budgetGuardrail: 2000,
    })).rejects.toThrow(ValidationError);
    expect(tx.commercialWeeklyWorkItem.create).not.toHaveBeenCalled();
  });

  it('records budget changes separately and rejects stale revisions', async () => {
    await updateWeeklyWorkItem(tenantKey, userId, planId, itemId, {
      expectedRevision: 1,
      budgetGuardrail: 4000,
    });
    expect(tx.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'commercial_weekly_budget_guardrail_changed' }),
    }));

    tx.commercialWeeklyWorkItem.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(updateWeeklyWorkItem(tenantKey, userId, planId, itemId, {
      expectedRevision: 1,
      title: 'Stale update',
    })).rejects.toThrow(ConflictError);
  });
});

