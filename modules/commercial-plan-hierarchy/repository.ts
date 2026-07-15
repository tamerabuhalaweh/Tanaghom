import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import type {
  ArchiveExecutionLinkInput,
  ArchiveLearningInput,
  AssignPlanInput,
  LinkCampaignInput,
  LinkEventInput,
  LinkLearningInput,
  SupersedePlanInput,
  UnlinkParentInput,
} from './types';

const planHierarchyInclude = Prisma.validator<Prisma.CommercialPlanInclude>()({
  revenue_line: { select: { id: true, name: true, revenue_line_type: true } },
  owner: { select: { id: true, name: true, role: true } },
  superseded_by: { select: { id: true, title: true, status: true } },
  hierarchy_assignment: {
    include: {
      annual_plan: { select: { id: true, year: true, title: true, status: true, currency: true } },
      monthly_item: {
        select: {
          id: true,
          month: true,
          title: true,
          planned_start_date: true,
          planned_end_date: true,
          budget_allocation: true,
          revenue_target: true,
          currency: true,
          readiness: true,
          archived_at: true,
        },
      },
    },
  },
  event_links: {
    include: {
      event: {
        select: {
          id: true,
          name: true,
          event_date: true,
          status: true,
          event_type: true,
          planned_budget: true,
          revenue_target: true,
        },
      },
    },
    orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
  },
  campaign_links: {
    include: {
      campaign: {
        select: {
          id: true,
          objective: true,
          status: true,
          deadline: true,
          target_platforms: true,
          event_id: true,
          created_at: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  },
  learning_influences: {
    include: {
      learning_set: {
        select: {
          id: true,
          title: true,
          status: true,
          approved_at: true,
          assessment_run: { select: { id: true, title: true, date_from: true, date_to: true } },
        },
      },
      finding: {
        select: {
          id: true,
          finding_type: true,
          title: true,
          summary: true,
          recommendation: true,
          confidence: true,
          decision: true,
          evidence_ids: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  },
});

export async function getPlanHierarchy(tenantKey: string, planId: string) {
  const plan = await prisma.commercialPlan.findFirst({
    where: { id: planId, tenant_key: tenantKey },
    include: planHierarchyInclude,
  });
  if (!plan) throw new NotFoundError('CommercialPlan', planId);

  const activeEvents = plan.event_links.filter((link) => link.status === 'active');
  const activeCampaigns = plan.campaign_links.filter((link) => link.status === 'active');
  const eventIds = activeEvents.map((link) => link.event_id);
  const campaignIds = activeCampaigns.map((link) => link.campaign_id);
  const [kpis, leads, packages, contentItems] = await Promise.all([
    eventIds.length
      ? prisma.eventKpiRecord.findMany({
          where: { tenant_key: tenantKey, event_id: { in: eventIds } },
          select: {
            spend: true,
            leads: true,
            meetings_booked: true,
            meetings_attended: true,
            purchases: true,
            no_shows: true,
          },
        })
      : [],
    eventIds.length || campaignIds.length
      ? prisma.leadCaptureRecord.findMany({
          where: {
            tenant_key: tenantKey,
            OR: [
              ...(eventIds.length ? [{ event_id: { in: eventIds } }] : []),
              ...(campaignIds.length ? [{ campaign_id: { in: campaignIds } }] : []),
            ],
          },
          select: { id: true, lead_status: true, purchase_amount: true },
        })
      : [],
    eventIds.length || campaignIds.length
      ? prisma.publishingPackage.findMany({
          where: {
            tenant_key: tenantKey,
            OR: [
              ...(eventIds.length ? [{ event_id: { in: eventIds } }] : []),
              ...(campaignIds.length ? [{ campaign_id: { in: campaignIds } }] : []),
            ],
          },
          select: { id: true, package_status: true, event_id: true, campaign_id: true },
        })
      : [],
    campaignIds.length
      ? prisma.contentItem.count({ where: { tenant_key: tenantKey, request_id: { in: campaignIds } } })
      : 0,
  ]);

  const kpiLeads = kpis.reduce((sum, row) => sum + row.leads, 0);
  const purchasesFromKpis = kpis.reduce((sum, row) => sum + row.purchases, 0);
  const purchasesFromLeads = leads.filter(
    (lead) => lead.lead_status === 'purchased' || decimal(lead.purchase_amount) > 0,
  ).length;

  return jsonSafe({
    ...plan,
    traceabilityStatus: hierarchyStatus(plan),
    activeEventLinks: activeEvents,
    activeCampaignLinks: activeCampaigns,
    activeLearningInfluences: plan.learning_influences.filter((link) => !link.archived_at),
    outcomes: {
      spend: money(kpis.reduce((sum, row) => sum + decimal(row.spend), 0)),
      leads: Math.max(kpiLeads, leads.length),
      meetingsBooked: kpis.reduce((sum, row) => sum + row.meetings_booked, 0),
      meetingsAttended: kpis.reduce((sum, row) => sum + row.meetings_attended, 0),
      purchases: Math.max(purchasesFromKpis, purchasesFromLeads),
      noShows: kpis.reduce((sum, row) => sum + row.no_shows, 0),
      knownRevenue: money(leads.reduce((sum, row) => sum + decimal(row.purchase_amount), 0)),
      contentItems,
      publishingPackages: packages.length,
      readyPackages: packages.filter((row) => row.package_status === 'ready_for_future_execution').length,
    },
  });
}

export async function getAnnualHierarchy(tenantKey: string, annualPlanId: string) {
  const annualPlan = await prisma.annualCommercialPlan.findFirst({
    where: { id: annualPlanId, tenant_key: tenantKey },
    include: {
      items: {
        include: {
          revenue_line: { select: { id: true, name: true, revenue_line_type: true } },
          execution_plan_assignments: {
            include: {
              commercial_plan: {
                include: {
                  event_links: { where: { status: 'active' }, include: { event: true } },
                  campaign_links: { where: { status: 'active' }, include: { campaign: true } },
                  learning_influences: { where: { archived_at: null }, include: { finding: true } },
                },
              },
            },
          },
        },
        orderBy: [{ month: 'asc' }, { sort_order: 'asc' }],
      },
    },
  });
  if (!annualPlan) throw new NotFoundError('AnnualCommercialPlan', annualPlanId);
  const planIds = annualPlan.items.flatMap((item) =>
    item.execution_plan_assignments.map((assignment) => assignment.commercial_plan_id),
  );
  const executionPlans = await Promise.all(planIds.map((planId) => getPlanHierarchy(tenantKey, planId)));
  return jsonSafe({
    ...annualPlan,
    executionPlans,
    outcomes: aggregateOutcomes(executionPlans),
  });
}

export async function getEventHierarchy(tenantKey: string, eventId: string) {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    include: {
      commercial_plan_links: {
        include: { commercial_plan: { include: planHierarchyInclude } },
        orderBy: { created_at: 'asc' },
      },
    },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  return jsonSafe(event);
}

export async function getCampaignHierarchy(tenantKey: string, campaignId: string) {
  const campaign = await prisma.contentRequest.findFirst({
    where: { id: campaignId, tenant_key: tenantKey },
    include: {
      commercial_plan_links: {
        include: { commercial_plan: { include: planHierarchyInclude } },
        orderBy: { created_at: 'asc' },
      },
    },
  });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  return jsonSafe(campaign);
}

export async function getLearningHierarchy(tenantKey: string, learningSetId: string) {
  const set = await prisma.commercialLearningSet.findFirst({
    where: { id: learningSetId, tenant_key: tenantKey },
    include: {
      assessment_run: { select: { id: true, title: true, date_from: true, date_to: true } },
      commercial_plan_influences: {
        include: { commercial_plan: { include: planHierarchyInclude }, finding: true },
        orderBy: { created_at: 'asc' },
      },
    },
  });
  if (!set) throw new NotFoundError('CommercialLearningSet', learningSetId);
  const planIds = [...new Set(set.commercial_plan_influences.map((link) => link.commercial_plan_id))];
  const influencedPlans = await Promise.all(planIds.map((planId) => getPlanHierarchy(tenantKey, planId)));
  return jsonSafe({
    ...set,
    influencedPlans,
    outcomes: aggregateOutcomes(influencedPlans),
  });
}

export async function listOrphanPlans(tenantKey: string) {
  const plans = await prisma.commercialPlan.findMany({
    where: {
      tenant_key: tenantKey,
      status: { not: 'archived' },
      superseded_by_plan_id: null,
      OR: [{ hierarchy_assignment: null }, { hierarchy_assignment: { status: { not: 'active' } } }],
    },
    include: { revenue_line: { select: { id: true, name: true, revenue_line_type: true } } },
    orderBy: { updated_at: 'desc' },
  });
  return jsonSafe(plans);
}

export async function assignPlan(
  tenantKey: string,
  userId: string,
  planId: string,
  input: AssignPlanInput,
) {
  await prisma.$transaction(async (tx) => {
    const { plan, annualPlan, item } = await hierarchyRecords(tx, tenantKey, planId, input);
    if (plan.status === 'archived' || plan.superseded_by_plan_id) {
      throw new ValidationError('Archived or superseded execution plans cannot be assigned');
    }
    if (annualPlan.status === 'archived') throw new ValidationError('Archived annual plans cannot accept execution work');
    if (item.archived_at) throw new ValidationError('Archived monthly initiatives cannot accept execution work');
    if (item.revenue_line_id !== plan.revenue_line_id) {
      throw new ValidationError('Execution plan revenue line must match its monthly initiative');
    }

    const occupied = await tx.commercialPlanHierarchyAssignment.findFirst({
      where: {
        monthly_portfolio_item_id: item.id,
        status: 'active',
        commercial_plan_id: { not: plan.id },
      },
      select: { commercial_plan_id: true },
    });
    if (occupied) throw new ConflictError('This monthly initiative already has an active execution plan');

    const existing = await tx.commercialPlanHierarchyAssignment.findUnique({
      where: { commercial_plan_id: plan.id },
      select: { annual_plan_id: true, monthly_portfolio_item_id: true },
    });
    if (existing && existing.monthly_portfolio_item_id !== item.id) {
      throw new ConflictError(
        'This execution plan already has a historical annual assignment; create a replacement plan and supersede it instead',
      );
    }
    if (existing && existing.annual_plan_id !== annualPlan.id) {
      throw new ConflictError(
        'This execution plan already belongs to another annual plan; create a replacement plan and supersede it instead',
      );
    }

    await tx.commercialPlanHierarchyAssignment.upsert({
      where: { commercial_plan_id: plan.id },
      create: {
        tenant_key: tenantKey,
        commercial_plan_id: plan.id,
        annual_plan_id: annualPlan.id,
        monthly_portfolio_item_id: item.id,
        linked_by_user_id: userId,
      },
      update: {
        annual_plan_id: annualPlan.id,
        monthly_portfolio_item_id: item.id,
        status: 'active',
        period_exception_reason: null,
        exception_approved_by_user_id: null,
        exception_approved_at: null,
        linked_by_user_id: userId,
        archived_at: null,
      },
    });
    await tx.monthlyPortfolioItem.update({ where: { id: item.id }, data: { commercial_plan_id: plan.id } });
    await audit(tx, userId, 'commercial_plan_parent_assigned', 'commercial_plan', plan.id, input);
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function unlinkParent(
  tenantKey: string,
  userId: string,
  planId: string,
  input: UnlinkParentInput,
) {
  await prisma.$transaction(async (tx) => {
    const plan = await tx.commercialPlan.findFirst({
      where: { id: planId, tenant_key: tenantKey },
      include: { hierarchy_assignment: true },
    });
    if (!plan) throw new NotFoundError('CommercialPlan', planId);
    if (!plan.hierarchy_assignment || plan.hierarchy_assignment.status !== 'active') {
      throw new ValidationError('This execution plan does not have an active annual parent');
    }
    const activeExecution = await tx.commercialPlanEventLink.count({
      where: { commercial_plan_id: planId, status: 'active' },
    }) + await tx.commercialPlanCampaignLink.count({
      where: { commercial_plan_id: planId, status: 'active' },
    });
    if (plan.status !== 'archived' || activeExecution > 0) {
      throw new ValidationError(
        'Archive the execution plan and all active execution links before removing its annual assignment',
      );
    }
    await tx.commercialPlanHierarchyAssignment.update({
      where: { commercial_plan_id: planId },
      data: { status: 'archived', archived_at: new Date() },
    });
    await tx.monthlyPortfolioItem.updateMany({
      where: { id: plan.hierarchy_assignment.monthly_portfolio_item_id, commercial_plan_id: planId },
      data: { commercial_plan_id: null },
    });
    await audit(tx, userId, 'commercial_plan_parent_unlinked', 'commercial_plan', planId, input);
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function linkEvent(
  tenantKey: string,
  userId: string,
  exceptionApproverId: string | null,
  planId: string,
  input: LinkEventInput,
) {
  await prisma.$transaction(async (tx) => {
    const plan = await activeAssignedPlan(tx, tenantKey, planId);
    const event = await tx.commercialEvent.findFirst({
      where: { id: input.eventId, tenant_key: tenantKey },
      select: { id: true, event_date: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
    const occupied = await tx.commercialPlanEventLink.findFirst({
      where: {
        event_id: event.id,
        tenant_key: tenantKey,
        status: 'active',
        commercial_plan_id: { not: planId },
      },
      select: { commercial_plan_id: true },
    });
    if (occupied) {
      throw new ConflictError('This event is already connected to another active commercial plan');
    }
    const exception = periodException(
      plan.hierarchy_assignment.annual_plan.year,
      plan.hierarchy_assignment.monthly_item.month,
      event.event_date,
      input.periodExceptionReason,
      exceptionApproverId,
    );

    const makePrimary = input.primary || (await tx.commercialPlanEventLink.count({
      where: { commercial_plan_id: planId, status: 'active' },
    })) === 0;
    if (makePrimary) {
      await tx.commercialPlanEventLink.updateMany({
        where: { commercial_plan_id: planId, status: 'active' },
        data: { is_primary: false },
      });
    }
    await tx.commercialPlanEventLink.upsert({
      where: { commercial_plan_id_event_id: { commercial_plan_id: planId, event_id: event.id } },
      create: {
        tenant_key: tenantKey,
        commercial_plan_id: planId,
        event_id: event.id,
        is_primary: makePrimary,
        linked_by_user_id: userId,
        ...exception,
      },
      update: {
        status: 'active',
        is_primary: makePrimary,
        linked_by_user_id: userId,
        archived_at: null,
        ...exception,
      },
    });
    if (makePrimary) {
      await tx.commercialPlan.update({ where: { id: planId }, data: { linked_event_id: event.id } });
      await tx.monthlyPortfolioItem.update({
        where: { id: plan.hierarchy_assignment.monthly_item.id },
        data: { event_id: event.id },
      });
    }
    await audit(tx, userId, 'commercial_plan_event_linked', 'commercial_plan', planId, input);
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function archiveEventLink(
  tenantKey: string,
  userId: string,
  planId: string,
  eventId: string,
  input: ArchiveExecutionLinkInput,
) {
  await prisma.$transaction(async (tx) => {
    const plan = await assertPlan(tx, tenantKey, planId);
    const link = await tx.commercialPlanEventLink.findFirst({
      where: { commercial_plan_id: planId, event_id: eventId, tenant_key: tenantKey, status: 'active' },
    });
    if (!link) throw new NotFoundError('CommercialPlanEventLink', eventId);
    await tx.commercialPlanEventLink.update({
      where: { id: link.id },
      data: { status: 'archived', is_primary: false, archived_at: new Date() },
    });
    if (link.is_primary) {
      const replacement = await tx.commercialPlanEventLink.findFirst({
        where: { commercial_plan_id: planId, status: 'active', id: { not: link.id } },
        orderBy: { created_at: 'asc' },
      });
      if (replacement) {
        await tx.commercialPlanEventLink.update({ where: { id: replacement.id }, data: { is_primary: true } });
      }
      await tx.commercialPlan.update({
        where: { id: planId },
        data: { linked_event_id: replacement?.event_id ?? null },
      });
      if (plan.hierarchy_assignment?.monthly_portfolio_item_id) {
        await tx.monthlyPortfolioItem.update({
          where: { id: plan.hierarchy_assignment.monthly_portfolio_item_id },
          data: { event_id: replacement?.event_id ?? null },
        });
      }
    }
    await audit(tx, userId, 'commercial_plan_event_unlinked', 'commercial_plan', planId, { eventId, ...input });
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function linkCampaign(
  tenantKey: string,
  userId: string,
  exceptionApproverId: string | null,
  planId: string,
  input: LinkCampaignInput,
) {
  await prisma.$transaction(async (tx) => {
    const plan = await activeAssignedPlan(tx, tenantKey, planId);
    const campaign = await tx.contentRequest.findFirst({
      where: { id: input.campaignId, tenant_key: tenantKey },
      include: { event: { select: { event_date: true } } },
    });
    if (!campaign) throw new NotFoundError('Campaign', input.campaignId);
    const occupied = await tx.commercialPlanCampaignLink.findFirst({
      where: {
        campaign_id: campaign.id,
        tenant_key: tenantKey,
        status: 'active',
        commercial_plan_id: { not: planId },
      },
      select: { commercial_plan_id: true },
    });
    if (occupied) {
      throw new ConflictError('This campaign is already connected to another active commercial plan');
    }
    const executionDate = campaign.deadline || campaign.event?.event_date || null;
    const exception = executionDate
      ? periodException(
          plan.hierarchy_assignment.annual_plan.year,
          plan.hierarchy_assignment.monthly_item.month,
          executionDate,
          input.periodExceptionReason,
          exceptionApproverId,
        )
      : emptyException();
    await tx.commercialPlanCampaignLink.upsert({
      where: {
        commercial_plan_id_campaign_id: {
          commercial_plan_id: planId,
          campaign_id: campaign.id,
        },
      },
      create: {
        tenant_key: tenantKey,
        commercial_plan_id: planId,
        campaign_id: campaign.id,
        linked_by_user_id: userId,
        ...exception,
      },
      update: {
        status: 'active',
        linked_by_user_id: userId,
        archived_at: null,
        ...exception,
      },
    });
    await audit(tx, userId, 'commercial_plan_campaign_linked', 'commercial_plan', planId, input);
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function archiveCampaignLink(
  tenantKey: string,
  userId: string,
  planId: string,
  campaignId: string,
  input: ArchiveExecutionLinkInput,
) {
  await prisma.$transaction(async (tx) => {
    await assertPlan(tx, tenantKey, planId);
    const result = await tx.commercialPlanCampaignLink.updateMany({
      where: { commercial_plan_id: planId, campaign_id: campaignId, tenant_key: tenantKey, status: 'active' },
      data: { status: 'archived', archived_at: new Date() },
    });
    if (!result.count) throw new NotFoundError('CommercialPlanCampaignLink', campaignId);
    await audit(tx, userId, 'commercial_plan_campaign_unlinked', 'commercial_plan', planId, { campaignId, ...input });
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function linkLearning(
  tenantKey: string,
  userId: string,
  planId: string,
  input: LinkLearningInput,
) {
  await prisma.$transaction(async (tx) => {
    const plan = await activeAssignedPlan(tx, tenantKey, planId);
    const annualLearning = await tx.annualCommercialPlanLearningSet.findFirst({
      where: {
        annual_plan_id: plan.hierarchy_assignment.annual_plan.id,
        learning_set_id: input.learningSetId,
        tenant_key: tenantKey,
      },
      select: { id: true },
    });
    if (!annualLearning) {
      throw new ValidationError('Learning must be approved for the parent annual plan before it can influence execution');
    }
    const findings = await tx.commercialHistoricalAssessmentFinding.findMany({
      where: {
        id: { in: input.findingIds },
        tenant_key: tenantKey,
        learning_set_id: input.learningSetId,
        decision: 'approved',
        learning_set: { status: 'active' },
      },
      select: { id: true },
    });
    if (findings.length !== input.findingIds.length) {
      throw new ValidationError('Every linked finding must be approved, active, and owned by this workspace');
    }
    for (const finding of findings) {
      await tx.commercialPlanLearningInfluence.upsert({
        where: {
          commercial_plan_id_finding_id: { commercial_plan_id: planId, finding_id: finding.id },
        },
        create: {
          tenant_key: tenantKey,
          commercial_plan_id: planId,
          learning_set_id: input.learningSetId,
          finding_id: finding.id,
          rationale: input.rationale ?? null,
          linked_by_user_id: userId,
        },
        update: {
          learning_set_id: input.learningSetId,
          rationale: input.rationale ?? null,
          linked_by_user_id: userId,
          archived_at: null,
        },
      });
    }
    await audit(tx, userId, 'commercial_plan_learning_linked', 'commercial_plan', planId, input);
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function archiveLearning(
  tenantKey: string,
  userId: string,
  planId: string,
  findingId: string,
  input: ArchiveLearningInput,
) {
  await prisma.$transaction(async (tx) => {
    await assertPlan(tx, tenantKey, planId);
    const result = await tx.commercialPlanLearningInfluence.updateMany({
      where: { commercial_plan_id: planId, finding_id: findingId, tenant_key: tenantKey, archived_at: null },
      data: { archived_at: new Date() },
    });
    if (!result.count) throw new NotFoundError('CommercialPlanLearningInfluence', findingId);
    await audit(tx, userId, 'commercial_plan_learning_unlinked', 'commercial_plan', planId, { findingId, ...input });
  });
  return getPlanHierarchy(tenantKey, planId);
}

export async function supersedePlan(
  tenantKey: string,
  userId: string,
  planId: string,
  input: SupersedePlanInput,
) {
  if (planId === input.replacementPlanId) throw new ValidationError('A plan cannot supersede itself');
  await prisma.$transaction(async (tx) => {
    const current = await activeAssignedPlan(tx, tenantKey, planId);
    const replacement = await tx.commercialPlan.findFirst({
      where: { id: input.replacementPlanId, tenant_key: tenantKey },
      include: { hierarchy_assignment: true },
    });
    if (!replacement) throw new NotFoundError('CommercialPlan', input.replacementPlanId);
    if (replacement.revenue_line_id !== current.revenue_line_id) {
      throw new ValidationError('Replacement plan must use the same revenue line');
    }
    if (replacement.status === 'archived' || replacement.superseded_by_plan_id) {
      throw new ValidationError('Replacement plan must be current and not superseded');
    }
    if (replacement.hierarchy_assignment) {
      throw new ConflictError('Replacement plan already has historical annual assignment evidence');
    }

    await tx.commercialPlanHierarchyAssignment.update({
      where: { commercial_plan_id: planId },
      data: { status: 'superseded', archived_at: new Date() },
    });
    await tx.commercialPlanHierarchyAssignment.upsert({
      where: { commercial_plan_id: replacement.id },
      create: {
        tenant_key: tenantKey,
        commercial_plan_id: replacement.id,
        annual_plan_id: current.hierarchy_assignment.annual_plan.id,
        monthly_portfolio_item_id: current.hierarchy_assignment.monthly_item.id,
        linked_by_user_id: userId,
      },
      update: {
        annual_plan_id: current.hierarchy_assignment.annual_plan.id,
        monthly_portfolio_item_id: current.hierarchy_assignment.monthly_item.id,
        status: 'active',
        linked_by_user_id: userId,
        archived_at: null,
      },
    });
    await tx.monthlyPortfolioItem.update({
      where: { id: current.hierarchy_assignment.monthly_item.id },
      data: { commercial_plan_id: replacement.id, event_id: null },
    });
    await tx.commercialPlan.update({
      where: { id: planId },
      data: {
        status: 'archived',
        superseded_by_plan_id: replacement.id,
        superseded_at: new Date(),
        superseded_reason: input.reason,
      },
    });
    await tx.commercialPlan.update({
      where: { id: replacement.id },
      data: { linked_event_id: null },
    });
    await tx.commercialPlanEventLink.updateMany({
      where: { commercial_plan_id: planId, status: 'active' },
      data: { status: 'superseded', is_primary: false, archived_at: new Date() },
    });
    await tx.commercialPlanCampaignLink.updateMany({
      where: { commercial_plan_id: planId, status: 'active' },
      data: { status: 'superseded', archived_at: new Date() },
    });
    await audit(tx, userId, 'commercial_plan_superseded', 'commercial_plan', planId, input);
  });
  return getPlanHierarchy(tenantKey, input.replacementPlanId);
}

async function hierarchyRecords(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  planId: string,
  input: AssignPlanInput,
) {
  const [plan, annualPlan, item] = await Promise.all([
    tx.commercialPlan.findFirst({
      where: { id: planId, tenant_key: tenantKey },
      select: { id: true, status: true, revenue_line_id: true, superseded_by_plan_id: true },
    }),
    tx.annualCommercialPlan.findFirst({
      where: { id: input.annualPlanId, tenant_key: tenantKey },
      select: { id: true, year: true, status: true },
    }),
    tx.monthlyPortfolioItem.findFirst({
      where: { id: input.monthlyPortfolioItemId, tenant_key: tenantKey },
      select: { id: true, annual_plan_id: true, revenue_line_id: true, archived_at: true },
    }),
  ]);
  if (!plan) throw new NotFoundError('CommercialPlan', planId);
  if (!annualPlan) throw new NotFoundError('AnnualCommercialPlan', input.annualPlanId);
  if (!item) throw new NotFoundError('MonthlyPortfolioItem', input.monthlyPortfolioItemId);
  if (item.annual_plan_id !== annualPlan.id) {
    throw new ValidationError('Monthly initiative must belong to the selected annual plan');
  }
  return { plan, annualPlan, item };
}

async function activeAssignedPlan(tx: Prisma.TransactionClient, tenantKey: string, planId: string) {
  const plan = await tx.commercialPlan.findFirst({
    where: { id: planId, tenant_key: tenantKey },
    include: {
      hierarchy_assignment: {
        include: {
          annual_plan: { select: { id: true, year: true, status: true } },
          monthly_item: { select: { id: true, month: true, archived_at: true } },
        },
      },
    },
  });
  if (!plan) throw new NotFoundError('CommercialPlan', planId);
  if (plan.status === 'archived' || plan.superseded_by_plan_id) {
    throw new ValidationError('Archived or superseded plans cannot receive execution links');
  }
  if (!plan.hierarchy_assignment || plan.hierarchy_assignment.status !== 'active') {
    throw new ValidationError('Assign this plan to an annual month before linking execution work');
  }
  if (plan.hierarchy_assignment.monthly_item.archived_at) {
    throw new ValidationError('The parent monthly initiative is archived');
  }
  return plan as typeof plan & {
    hierarchy_assignment: NonNullable<typeof plan.hierarchy_assignment>;
  };
}

async function assertPlan(tx: Prisma.TransactionClient, tenantKey: string, planId: string) {
  const plan = await tx.commercialPlan.findFirst({
    where: { id: planId, tenant_key: tenantKey },
    select: {
      id: true,
      hierarchy_assignment: { select: { monthly_portfolio_item_id: true } },
    },
  });
  if (!plan) throw new NotFoundError('CommercialPlan', planId);
  return plan;
}

function periodException(
  year: number,
  month: number,
  value: Date,
  exceptionReason: string | undefined,
  approverId: string | null,
) {
  if (value.getUTCFullYear() === year && value.getUTCMonth() + 1 === month) return emptyException();
  if (!exceptionReason) {
    throw new ValidationError(
      `Execution date must fall in ${year}-${String(month).padStart(2, '0')} or include an approved exception`,
    );
  }
  if (!approverId) throw new ValidationError('An executive approver is required for a planning-period exception');
  return {
    period_exception_reason: exceptionReason,
    exception_approved_by_user_id: approverId,
    exception_approved_at: new Date(),
  };
}

function emptyException() {
  return {
    period_exception_reason: null,
    exception_approved_by_user_id: null,
    exception_approved_at: null,
  };
}

function hierarchyStatus(plan: {
  status: unknown;
  superseded_by_plan_id: string | null;
  hierarchy_assignment: { status: unknown } | null;
  event_links: Array<{ status: unknown }>;
  campaign_links: Array<{ status: unknown }>;
  learning_influences: Array<{ archived_at: Date | null }>;
}) {
  const assigned = plan.hierarchy_assignment?.status === 'active';
  const executionCount =
    plan.event_links.filter((link) => link.status === 'active').length +
    plan.campaign_links.filter((link) => link.status === 'active').length;
  return {
    assigned,
    orphaned: !assigned && plan.status !== 'archived' && !plan.superseded_by_plan_id,
    executionCount,
    learningCount: plan.learning_influences.filter((link) => !link.archived_at).length,
    complete: assigned && executionCount > 0,
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  afterState: unknown,
) {
  await tx.auditRecord.create({
    data: {
      audit_type: 'commercial_plan_hierarchy',
      action,
      result: 'success',
      human_user_id: userId,
      target_object_type: targetType,
      target_object_id: targetId,
      source_module: 'commercial-plan-hierarchy',
      reason: action.replaceAll('_', ' '),
      after_state: JSON.parse(JSON.stringify(afterState)) as Prisma.InputJsonValue,
    },
  });
}

function decimal(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function aggregateOutcomes(values: unknown[]) {
  const totals = {
    spend: 0,
    leads: 0,
    meetingsBooked: 0,
    meetingsAttended: 0,
    purchases: 0,
    noShows: 0,
    knownRevenue: 0,
    contentItems: 0,
    publishingPackages: 0,
    readyPackages: 0,
  };
  for (const value of values) {
    if (!value || typeof value !== 'object' || !('outcomes' in value)) continue;
    const outcomes = value.outcomes;
    if (!outcomes || typeof outcomes !== 'object') continue;
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += decimal((outcomes as Record<string, unknown>)[key]);
    }
  }
  totals.spend = money(totals.spend);
  totals.knownRevenue = money(totals.knownRevenue);
  return totals;
}

function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}
