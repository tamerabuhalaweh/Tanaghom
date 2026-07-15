import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@shared/errors';

const tx = vi.hoisted(() => ({
  commercialPlan: { findFirst: vi.fn(), update: vi.fn() },
  annualCommercialPlan: { findFirst: vi.fn() },
  monthlyPortfolioItem: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  commercialPlanHierarchyAssignment: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  commercialPlanEventLink: { count: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  commercialPlanCampaignLink: { count: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  commercialPlanLearningInfluence: { upsert: vi.fn(), updateMany: vi.fn() },
  commercialEvent: { findFirst: vi.fn() },
  contentRequest: { findFirst: vi.fn() },
  annualCommercialPlanLearningSet: { findFirst: vi.fn() },
  commercialHistoricalAssessmentFinding: { findMany: vi.fn() },
  auditRecord: { create: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  ...tx,
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  eventKpiRecord: { findMany: vi.fn() },
  leadCaptureRecord: { findMany: vi.fn() },
  publishingPackage: { findMany: vi.fn() },
  contentItem: { count: vi.fn() },
  commercialLearningSet: { findFirst: vi.fn() },
  contentRequest: { ...tx.contentRequest },
  annualCommercialPlan: { ...tx.annualCommercialPlan },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import {
  assignPlan,
  getAnnualHierarchy,
  linkCampaign,
  linkEvent,
  linkLearning,
  supersedePlan,
  unlinkParent,
} from '../repository';

const ids = {
  user: '00000000-0000-0000-0000-000000000001',
  plan: '00000000-0000-0000-0000-000000000010',
  annual: '00000000-0000-0000-0000-000000000020',
  item: '00000000-0000-0000-0000-000000000030',
  event: '00000000-0000-0000-0000-000000000040',
  learning: '00000000-0000-0000-0000-000000000050',
  finding: '00000000-0000-0000-0000-000000000060',
};

function assignedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.plan,
    tenant_key: 'tenant-a',
    revenue_line_id: '00000000-0000-0000-0000-000000000070',
    status: 'active',
    superseded_by_plan_id: null,
    hierarchy_assignment: {
      status: 'active',
      annual_plan: { id: ids.annual, year: 2027, status: 'active' },
      monthly_item: { id: ids.item, month: 5, archived_at: null },
    },
    ...overrides,
  };
}

describe('commercial hierarchy repository integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.auditRecord.create.mockResolvedValue({ id: 'audit' });
    tx.commercialPlanEventLink.count.mockResolvedValue(0);
    tx.commercialPlanCampaignLink.count.mockResolvedValue(0);
    tx.commercialPlanEventLink.updateMany.mockResolvedValue({ count: 0 });
    tx.commercialPlanEventLink.findFirst.mockResolvedValue(null);
    tx.commercialPlanCampaignLink.findFirst.mockResolvedValue(null);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);
    prismaMocks.publishingPackage.findMany.mockResolvedValue([]);
    prismaMocks.contentItem.count.mockResolvedValue(0);
  });

  it('rejects a monthly item that belongs to a different annual plan', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue({
      id: ids.plan,
      status: 'draft',
      revenue_line_id: 'line-a',
      superseded_by_plan_id: null,
    });
    tx.annualCommercialPlan.findFirst.mockResolvedValue({ id: ids.annual, year: 2027, status: 'draft' });
    tx.monthlyPortfolioItem.findFirst.mockResolvedValue({
      id: ids.item,
      annual_plan_id: '00000000-0000-0000-0000-000000000099',
      revenue_line_id: 'line-a',
      archived_at: null,
    });

    await expect(assignPlan('tenant-a', ids.user, ids.plan, {
      annualPlanId: ids.annual,
      monthlyPortfolioItemId: ids.item,
    })).rejects.toThrow(ValidationError);
    expect(tx.commercialPlanHierarchyAssignment.upsert).not.toHaveBeenCalled();
  });

  it('rejects a plan that is not owned by the authenticated tenant', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue(null);
    tx.annualCommercialPlan.findFirst.mockResolvedValue({ id: ids.annual, year: 2027, status: 'draft' });
    tx.monthlyPortfolioItem.findFirst.mockResolvedValue({
      id: ids.item,
      annual_plan_id: ids.annual,
      revenue_line_id: 'line-a',
      archived_at: null,
    });

    await expect(assignPlan('tenant-a', ids.user, ids.plan, {
      annualPlanId: ids.annual,
      monthlyPortfolioItemId: ids.item,
    })).rejects.toThrow(/CommercialPlan.*not found/);
    expect(tx.commercialPlanHierarchyAssignment.upsert).not.toHaveBeenCalled();
  });

  it('preserves history by rejecting silent re-parenting to another month', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue({
      id: ids.plan,
      status: 'draft',
      revenue_line_id: 'line-a',
      superseded_by_plan_id: null,
    });
    tx.annualCommercialPlan.findFirst.mockResolvedValue({ id: ids.annual, year: 2027, status: 'draft' });
    tx.monthlyPortfolioItem.findFirst.mockResolvedValue({
      id: ids.item,
      annual_plan_id: ids.annual,
      revenue_line_id: 'line-a',
      archived_at: null,
    });
    tx.commercialPlanHierarchyAssignment.findFirst.mockResolvedValue(null);
    tx.commercialPlanHierarchyAssignment.findUnique.mockResolvedValue({
      annual_plan_id: ids.annual,
      monthly_portfolio_item_id: '00000000-0000-0000-0000-000000000031',
    });

    await expect(assignPlan('tenant-a', ids.user, ids.plan, {
      annualPlanId: ids.annual,
      monthlyPortfolioItemId: ids.item,
    })).rejects.toThrow(/historical annual assignment/);
    expect(tx.commercialPlanHierarchyAssignment.upsert).not.toHaveBeenCalled();
    expect(tx.monthlyPortfolioItem.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an event outside the assigned month without an approved exception', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue(assignedPlan());
    tx.commercialEvent.findFirst.mockResolvedValue({ id: ids.event, event_date: new Date('2027-06-15T00:00:00Z') });

    await expect(linkEvent('tenant-a', ids.user, null, ids.plan, {
      eventId: ids.event,
      primary: true,
    })).rejects.toThrow(/must fall in 2027-05/);
    expect(tx.commercialPlanEventLink.upsert).not.toHaveBeenCalled();
  });

  it('prevents one event from feeding two active commercial plans', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue(assignedPlan());
    tx.commercialEvent.findFirst.mockResolvedValue({ id: ids.event, event_date: new Date('2027-05-15T00:00:00Z') });
    tx.commercialPlanEventLink.findFirst.mockResolvedValue({
      commercial_plan_id: '00000000-0000-0000-0000-000000000012',
    });

    await expect(linkEvent('tenant-a', ids.user, null, ids.plan, {
      eventId: ids.event,
      primary: true,
    })).rejects.toThrow(/already connected to another active commercial plan/);
    expect(tx.commercialPlanEventLink.upsert).not.toHaveBeenCalled();
  });

  it('prevents one campaign from feeding two active commercial plans', async () => {
    const campaignId = '00000000-0000-0000-0000-000000000041';
    tx.commercialPlan.findFirst.mockResolvedValue(assignedPlan());
    tx.contentRequest.findFirst.mockResolvedValue({ id: campaignId, deadline: null, event: null });
    tx.commercialPlanCampaignLink.findFirst.mockResolvedValue({
      commercial_plan_id: '00000000-0000-0000-0000-000000000012',
    });

    await expect(linkCampaign('tenant-a', ids.user, null, ids.plan, {
      campaignId,
    })).rejects.toThrow(/already connected to another active commercial plan/);
    expect(tx.commercialPlanCampaignLink.upsert).not.toHaveBeenCalled();
  });

  it('records executive evidence when an out-of-period event is approved', async () => {
    tx.commercialPlan.findFirst
      .mockResolvedValueOnce(assignedPlan())
      .mockResolvedValueOnce({
        ...assignedPlan(),
        revenue_line: { id: 'line', name: 'Live Events', revenue_line_type: 'live_event' },
        owner: null,
        superseded_by: null,
        event_links: [],
        campaign_links: [],
        learning_influences: [],
      });
    tx.commercialEvent.findFirst.mockResolvedValue({ id: ids.event, event_date: new Date('2027-06-15T00:00:00Z') });
    tx.commercialPlanEventLink.upsert.mockResolvedValue({ id: 'event-link' });
    tx.commercialPlan.update.mockResolvedValue({ id: ids.plan });
    tx.monthlyPortfolioItem.update.mockResolvedValue({ id: ids.item });

    await linkEvent('tenant-a', ids.user, ids.user, ids.plan, {
      eventId: ids.event,
      primary: true,
      periodExceptionReason: 'Executive-approved launch moved into June',
    });

    expect(tx.commercialPlanEventLink.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        exception_approved_by_user_id: ids.user,
        period_exception_reason: 'Executive-approved launch moved into June',
      }),
    }));
    expect(tx.auditRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'commercial_plan_event_linked', result: 'success' }),
    });
  });

  it('blocks parent removal while execution links remain', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue({
      id: ids.plan,
      status: 'draft',
      hierarchy_assignment: { status: 'active', monthly_portfolio_item_id: ids.item },
    });
    tx.commercialPlanEventLink.count.mockResolvedValue(1);

    await expect(unlinkParent('tenant-a', ids.user, ids.plan, { reason: 'Replanning' }))
      .rejects.toThrow(/Archive the execution plan/);
    expect(tx.commercialPlanHierarchyAssignment.update).not.toHaveBeenCalled();
  });

  it('blocks parent removal for a live draft even when execution links are empty', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue({
      id: ids.plan,
      status: 'draft',
      hierarchy_assignment: { status: 'active', monthly_portfolio_item_id: ids.item },
    });

    await expect(unlinkParent('tenant-a', ids.user, ids.plan, { reason: 'Replanning' }))
      .rejects.toThrow(/Archive the execution plan/);
    expect(tx.commercialPlanHierarchyAssignment.update).not.toHaveBeenCalled();
  });

  it('rejects learning that is not approved for the parent annual plan', async () => {
    tx.commercialPlan.findFirst.mockResolvedValue(assignedPlan());
    tx.annualCommercialPlanLearningSet.findFirst.mockResolvedValue(null);

    await expect(linkLearning('tenant-a', ids.user, ids.plan, {
      learningSetId: ids.learning,
      findingIds: [ids.finding],
    })).rejects.toThrow(/approved for the parent annual plan/);
    expect(tx.commercialPlanLearningInfluence.upsert).not.toHaveBeenCalled();
  });

  it('does not overwrite historical assignment evidence on a replacement plan', async () => {
    const replacementId = '00000000-0000-0000-0000-000000000011';
    tx.commercialPlan.findFirst
      .mockResolvedValueOnce(assignedPlan())
      .mockResolvedValueOnce({
        id: replacementId,
        tenant_key: 'tenant-a',
        revenue_line_id: '00000000-0000-0000-0000-000000000070',
        status: 'draft',
        superseded_by_plan_id: null,
        hierarchy_assignment: { status: 'archived' },
      });

    await expect(supersedePlan('tenant-a', ids.user, ids.plan, {
      replacementPlanId: replacementId,
      reason: 'Approved replacement',
    })).rejects.toThrow(/historical annual assignment evidence/);
    expect(tx.commercialPlanHierarchyAssignment.upsert).not.toHaveBeenCalled();
  });

  it('returns an annual executive outcome rollup through governed IDs', async () => {
    tx.annualCommercialPlan.findFirst.mockResolvedValue({
      id: ids.annual,
      items: [{ execution_plan_assignments: [{ commercial_plan_id: ids.plan }] }],
    });
    tx.commercialPlan.findFirst.mockResolvedValue({
      ...assignedPlan(),
      revenue_line: { id: 'line', name: 'Live Events', revenue_line_type: 'live_event' },
      owner: null,
      superseded_by: null,
      event_links: [{ id: 'event-link', event_id: ids.event, status: 'active', event: { id: ids.event } }],
      campaign_links: [],
      learning_influences: [],
    });
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([{
      spend: 125,
      leads: 4,
      meetings_booked: 2,
      meetings_attended: 1,
      purchases: 1,
      no_shows: 1,
    }]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([{
      id: 'lead-1',
      lead_status: 'purchased',
      purchase_amount: 900,
    }]);

    const result = await getAnnualHierarchy('tenant-a', ids.annual) as Record<string, unknown>;

    expect(result.outcomes).toMatchObject({
      spend: 125,
      leads: 4,
      meetingsBooked: 2,
      purchases: 1,
      knownRevenue: 900,
    });
  });
});
