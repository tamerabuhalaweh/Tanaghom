import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateEventInput,
  UpdateEventInput,
  UpdateStrategyInput,
  CommercialEventSummary,
  CommercialEventStatus,
} from './types';

export async function listEvents(
  tenantKey: string,
  status?: CommercialEventStatus,
  eventType?: string,
): Promise<CommercialEventSummary[]> {
  const where: Prisma.CommercialEventWhereInput = { tenant_key: tenantKey };
  if (status) where.status = status;
  if (eventType) where.event_type = eventType as Prisma.EnumCommercialEventTypeFilter;

  const events = await prisma.commercialEvent.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
    orderBy: { event_date: 'asc' },
  });

  return events.map(mapEvent);
}

export async function getEventById(tenantKey: string, id: string): Promise<CommercialEventSummary> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id, tenant_key: tenantKey },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });
  if (!event) throw new NotFoundError('CommercialEvent', id);
  return mapEvent(event);
}

export async function createEvent(
  tenantKey: string,
  ownerUserId: string,
  input: CreateEventInput,
): Promise<CommercialEventSummary> {
  const eventDate = new Date(input.eventDate);

  // Auto-derive campaignStartDate if not provided: 30 days before event
  let campaignStartDate: Date | null = null;
  if (input.campaignStartDate) {
    campaignStartDate = new Date(input.campaignStartDate);
  } else {
    campaignStartDate = new Date(eventDate);
    campaignStartDate.setDate(campaignStartDate.getDate() - 30);
  }

  // Validate campaign dates
  if (campaignStartDate >= eventDate) {
    campaignStartDate = new Date(eventDate);
    campaignStartDate.setDate(campaignStartDate.getDate() - 30);
  }

  let campaignEndDate: Date | null = null;
  if (input.campaignEndDate) {
    campaignEndDate = new Date(input.campaignEndDate);
    if (campaignEndDate < campaignStartDate) {
      campaignEndDate = eventDate;
    }
  }

  const event = await prisma.commercialEvent.create({
    data: {
      tenant_key: tenantKey,
      name: input.name,
      event_type: input.eventType,
      event_date: eventDate,
      location: input.location,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      expected_attendance: input.expectedAttendance,
      revenue_target: input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null,
      planned_budget: input.plannedBudget != null ? new Prisma.Decimal(input.plannedBudget) : null,
      owner_user_id: ownerUserId,
      status: 'draft',
      offer: input.offer,
      audience: input.audience,
      geography: input.geography,
      fomo_angle: input.fomoAngle,
      upsell_plan: input.upsellPlan,
      selected_channels: input.selectedChannels ?? [],
      content_department_requirements: input.contentDepartmentRequirements,
      sales_team_requirements: input.salesTeamRequirements,
    },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEvent(
  tenantKey: string,
  id: string,
  input: UpdateEventInput,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const data: Prisma.CommercialEventUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.eventType !== undefined) data.event_type = input.eventType;
  if (input.eventDate !== undefined) data.event_date = new Date(input.eventDate);
  if (input.location !== undefined) data.location = input.location;
  if (input.campaignStartDate !== undefined) data.campaign_start_date = input.campaignStartDate ? new Date(input.campaignStartDate) : null;
  if (input.campaignEndDate !== undefined) data.campaign_end_date = input.campaignEndDate ? new Date(input.campaignEndDate) : null;
  if (input.expectedAttendance !== undefined) data.expected_attendance = input.expectedAttendance;
  if (input.revenueTarget !== undefined) data.revenue_target = input.revenueTarget != null ? new Prisma.Decimal(input.revenueTarget) : null;
  if (input.plannedBudget !== undefined) data.planned_budget = input.plannedBudget != null ? new Prisma.Decimal(input.plannedBudget) : null;
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.geography !== undefined) data.geography = input.geography;
  if (input.fomoAngle !== undefined) data.fomo_angle = input.fomoAngle;
  if (input.upsellPlan !== undefined) data.upsell_plan = input.upsellPlan;
  if (input.selectedChannels !== undefined) data.selected_channels = input.selectedChannels;
  if (input.contentDepartmentRequirements !== undefined) data.content_department_requirements = input.contentDepartmentRequirements;
  if (input.salesTeamRequirements !== undefined) data.sales_team_requirements = input.salesTeamRequirements;

  const event = await prisma.commercialEvent.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEventStrategy(
  tenantKey: string,
  id: string,
  input: UpdateStrategyInput,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const data: Prisma.CommercialEventUpdateInput = {};
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.geography !== undefined) data.geography = input.geography;
  if (input.fomoAngle !== undefined) data.fomo_angle = input.fomoAngle;
  if (input.upsellPlan !== undefined) data.upsell_plan = input.upsellPlan;
  if (input.selectedChannels !== undefined) data.selected_channels = input.selectedChannels;
  if (input.contentDepartmentRequirements !== undefined) data.content_department_requirements = input.contentDepartmentRequirements;
  if (input.salesTeamRequirements !== undefined) data.sales_team_requirements = input.salesTeamRequirements;

  const event = await prisma.commercialEvent.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function updateEventStatus(
  tenantKey: string,
  id: string,
  toStatus: CommercialEventStatus,
): Promise<CommercialEventSummary> {
  const existing = await prisma.commercialEvent.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('CommercialEvent', id);

  const event = await prisma.commercialEvent.update({
    where: { id },
    data: { status: toStatus },
    include: {
      owner: { select: { id: true, name: true } },
      campaigns: { select: { id: true } },
      leads: { select: { id: true } },
    },
  });

  return mapEvent(event);
}

export async function linkCampaign(
  tenantKey: string,
  eventId: string,
  campaignId: string,
): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const campaign = await prisma.contentRequest.findFirst({ where: { id: campaignId, tenant_key: tenantKey } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  await prisma.contentRequest.update({
    where: { id: campaignId },
    data: { event_id: eventId },
  });
}

export async function linkLead(
  tenantKey: string,
  eventId: string,
  leadId: string,
): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const lead = await prisma.leadCaptureRecord.findFirst({ where: { id: leadId, tenant_key: tenantKey } });
  if (!lead) throw new NotFoundError('Lead', leadId);

  await prisma.leadCaptureRecord.update({
    where: { id: leadId },
    data: { event_id: eventId },
  });
}

function mapEvent(e: Record<string, unknown>): CommercialEventSummary {
  const owner = e.owner as { name: string } | null;
  const campaigns = e.campaigns as { id: string }[] | undefined;
  const leads = e.leads as { id: string }[] | undefined;
  return {
    id: e.id as string,
    tenantKey: e.tenant_key as string,
    name: e.name as string,
    eventType: e.event_type as CommercialEventSummary['eventType'],
    eventDate: e.event_date as Date,
    location: e.location as string | null,
    campaignStartDate: e.campaign_start_date as Date | null,
    campaignEndDate: e.campaign_end_date as Date | null,
    expectedAttendance: e.expected_attendance as number | null,
    revenueTarget: e.revenue_target != null ? Number(e.revenue_target) : null,
    plannedBudget: e.planned_budget != null ? Number(e.planned_budget) : null,
    ownerUserId: e.owner_user_id as string,
    ownerUserName: owner?.name || null,
    status: e.status as CommercialEventSummary['status'],
    offer: e.offer as string | null,
    audience: e.audience as string | null,
    geography: e.geography as string | null,
    fomoAngle: e.fomo_angle as string | null,
    upsellPlan: e.upsell_plan as string | null,
    selectedChannels: (e.selected_channels as string[]) ?? [],
    contentDepartmentRequirements: e.content_department_requirements as string | null,
    salesTeamRequirements: e.sales_team_requirements as string | null,
    campaignCount: campaigns?.length ?? 0,
    leadCount: leads?.length ?? 0,
    createdAt: e.created_at as Date,
    updatedAt: e.updated_at as Date,
  };
}
