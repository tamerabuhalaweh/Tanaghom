import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateEmailPlanInput, UpdateEmailPlanInput, EmailPlanSummary,
  CreateWhatsappPlanInput, UpdateWhatsappPlanInput, WhatsappPlanSummary,
  CreateUpsellPlanInput, UpdateUpsellPlanInput, UpsellPlanSummary,
  CreateContentRequirementInput, UpdateContentRequirementInput, ContentRequirementSummary,
  CreateSalesTaskInput, UpdateSalesTaskInput, SalesTaskSummary,
} from './types';

async function verifyEventOwnership(tenantKey: string, eventId: string): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
}

// Email Plans
export async function listEmailPlans(tenantKey: string, eventId: string): Promise<EmailPlanSummary[]> {
  const plans = await prisma.eventEmailPlan.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    orderBy: { created_at: 'desc' },
  });
  return plans.map(mapEmailPlan);
}

export async function getEmailPlanById(tenantKey: string, id: string): Promise<EmailPlanSummary> {
  const plan = await prisma.eventEmailPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!plan) throw new NotFoundError('EventEmailPlan', id);
  return mapEmailPlan(plan);
}

export async function createEmailPlan(tenantKey: string, userId: string, input: CreateEmailPlanInput): Promise<EmailPlanSummary> {
  await verifyEventOwnership(tenantKey, input.eventId);
  const plan = await prisma.eventEmailPlan.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      sequence_name: input.sequenceName,
      audience_segment: input.audienceSegment,
      email_count: input.emailCount,
      planned_send_dates: input.plannedSendDates ?? Prisma.JsonNull,
      subject_draft: input.subjectDraft,
      content_draft: input.contentDraft,
      content_type: input.contentType,
      created_by_user_id: userId,
    },
  });
  return mapEmailPlan(plan);
}

export async function updateEmailPlan(tenantKey: string, id: string, input: UpdateEmailPlanInput): Promise<EmailPlanSummary> {
  const existing = await prisma.eventEmailPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventEmailPlan', id);
  const data: Prisma.EventEmailPlanUpdateInput = {};
  if (input.sequenceName !== undefined) data.sequence_name = input.sequenceName;
  if (input.audienceSegment !== undefined) data.audience_segment = input.audienceSegment;
  if (input.emailCount !== undefined) data.email_count = input.emailCount;
  if (input.plannedSendDates !== undefined) data.planned_send_dates = input.plannedSendDates ?? Prisma.JsonNull;
  if (input.subjectDraft !== undefined) data.subject_draft = input.subjectDraft;
  if (input.contentDraft !== undefined) data.content_draft = input.contentDraft;
  if (input.contentType !== undefined) data.content_type = input.contentType;
  if (input.approvalStatus !== undefined) data.approval_status = input.approvalStatus;
  const plan = await prisma.eventEmailPlan.update({ where: { id }, data });
  return mapEmailPlan(plan);
}

// WhatsApp Plans
export async function listWhatsappPlans(tenantKey: string, eventId: string): Promise<WhatsappPlanSummary[]> {
  const plans = await prisma.eventWhatsappPlan.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    orderBy: { created_at: 'desc' },
  });
  return plans.map(mapWhatsappPlan);
}

export async function getWhatsappPlanById(tenantKey: string, id: string): Promise<WhatsappPlanSummary> {
  const plan = await prisma.eventWhatsappPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!plan) throw new NotFoundError('EventWhatsappPlan', id);
  return mapWhatsappPlan(plan);
}

export async function createWhatsappPlan(tenantKey: string, userId: string, input: CreateWhatsappPlanInput): Promise<WhatsappPlanSummary> {
  await verifyEventOwnership(tenantKey, input.eventId);
  const plan = await prisma.eventWhatsappPlan.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      audience_segment: input.audienceSegment,
      frequency: input.frequency,
      content_type: input.contentType,
      message_draft: input.messageDraft,
      created_by_user_id: userId,
    },
  });
  return mapWhatsappPlan(plan);
}

export async function updateWhatsappPlan(tenantKey: string, id: string, input: UpdateWhatsappPlanInput): Promise<WhatsappPlanSummary> {
  const existing = await prisma.eventWhatsappPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventWhatsappPlan', id);
  const data: Prisma.EventWhatsappPlanUpdateInput = {};
  if (input.audienceSegment !== undefined) data.audience_segment = input.audienceSegment;
  if (input.frequency !== undefined) data.frequency = input.frequency;
  if (input.contentType !== undefined) data.content_type = input.contentType;
  if (input.messageDraft !== undefined) data.message_draft = input.messageDraft;
  if (input.approvalStatus !== undefined) data.approval_status = input.approvalStatus;
  const plan = await prisma.eventWhatsappPlan.update({ where: { id }, data });
  return mapWhatsappPlan(plan);
}

// Upsell Plans
export async function listUpsellPlans(tenantKey: string, eventId: string): Promise<UpsellPlanSummary[]> {
  const plans = await prisma.eventUpsellPlan.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    orderBy: { created_at: 'desc' },
  });
  return plans.map(mapUpsellPlan);
}

export async function getUpsellPlanById(tenantKey: string, id: string): Promise<UpsellPlanSummary> {
  const plan = await prisma.eventUpsellPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!plan) throw new NotFoundError('EventUpsellPlan', id);
  return mapUpsellPlan(plan);
}

export async function createUpsellPlan(tenantKey: string, userId: string, input: CreateUpsellPlanInput): Promise<UpsellPlanSummary> {
  await verifyEventOwnership(tenantKey, input.eventId);
  const plan = await prisma.eventUpsellPlan.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      target_segment: input.targetSegment,
      offer: input.offer,
      fomo_angle: input.fomoAngle,
      planned_channel: input.plannedChannel,
      created_by_user_id: userId,
    },
  });
  return mapUpsellPlan(plan);
}

export async function updateUpsellPlan(tenantKey: string, id: string, input: UpdateUpsellPlanInput): Promise<UpsellPlanSummary> {
  const existing = await prisma.eventUpsellPlan.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventUpsellPlan', id);
  const data: Prisma.EventUpsellPlanUpdateInput = {};
  if (input.targetSegment !== undefined) data.target_segment = input.targetSegment;
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.fomoAngle !== undefined) data.fomo_angle = input.fomoAngle;
  if (input.plannedChannel !== undefined) data.planned_channel = input.plannedChannel;
  if (input.approvalStatus !== undefined) data.approval_status = input.approvalStatus;
  const plan = await prisma.eventUpsellPlan.update({ where: { id }, data });
  return mapUpsellPlan(plan);
}

// Content Requirements
export async function listContentRequirements(tenantKey: string, eventId: string): Promise<ContentRequirementSummary[]> {
  const reqs = await prisma.eventContentRequirement.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    orderBy: { created_at: 'desc' },
  });
  return reqs.map(mapContentRequirement);
}

export async function getContentRequirementById(tenantKey: string, id: string): Promise<ContentRequirementSummary> {
  const req = await prisma.eventContentRequirement.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!req) throw new NotFoundError('EventContentRequirement', id);
  return mapContentRequirement(req);
}

export async function createContentRequirement(tenantKey: string, userId: string, input: CreateContentRequirementInput): Promise<ContentRequirementSummary> {
  await verifyEventOwnership(tenantKey, input.eventId);
  const req = await prisma.eventContentRequirement.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      asset_type: input.assetType,
      description: input.description,
      platform: input.platform,
      due_date: input.dueDate ? new Date(input.dueDate) : null,
      created_by_user_id: userId,
    },
  });
  return mapContentRequirement(req);
}

export async function updateContentRequirement(tenantKey: string, id: string, input: UpdateContentRequirementInput): Promise<ContentRequirementSummary> {
  const existing = await prisma.eventContentRequirement.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventContentRequirement', id);
  const data: Prisma.EventContentRequirementUpdateInput = {};
  if (input.assetType !== undefined) data.asset_type = input.assetType;
  if (input.description !== undefined) data.description = input.description;
  if (input.platform !== undefined) data.platform = input.platform;
  if (input.dueDate !== undefined) data.due_date = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status !== undefined) data.status = input.status;
  const req = await prisma.eventContentRequirement.update({ where: { id }, data });
  return mapContentRequirement(req);
}

// Sales Tasks
export async function listSalesTasks(tenantKey: string, eventId: string): Promise<SalesTaskSummary[]> {
  const tasks = await prisma.eventSalesTask.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
    orderBy: { created_at: 'desc' },
  });
  return tasks.map(mapSalesTask);
}

export async function getSalesTaskById(tenantKey: string, id: string): Promise<SalesTaskSummary> {
  const task = await prisma.eventSalesTask.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!task) throw new NotFoundError('EventSalesTask', id);
  return mapSalesTask(task);
}

export async function createSalesTask(tenantKey: string, userId: string, input: CreateSalesTaskInput): Promise<SalesTaskSummary> {
  await verifyEventOwnership(tenantKey, input.eventId);
  const task = await prisma.eventSalesTask.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      task_type: input.taskType,
      owner_role: input.ownerRole,
      description: input.description,
      due_date: input.dueDate ? new Date(input.dueDate) : null,
      created_by_user_id: userId,
    },
  });
  return mapSalesTask(task);
}

export async function updateSalesTask(tenantKey: string, id: string, input: UpdateSalesTaskInput): Promise<SalesTaskSummary> {
  const existing = await prisma.eventSalesTask.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventSalesTask', id);
  const data: Prisma.EventSalesTaskUpdateInput = {};
  if (input.taskType !== undefined) data.task_type = input.taskType;
  if (input.ownerRole !== undefined) data.owner_role = input.ownerRole;
  if (input.description !== undefined) data.description = input.description;
  if (input.dueDate !== undefined) data.due_date = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status !== undefined) data.status = input.status;
  const task = await prisma.eventSalesTask.update({ where: { id }, data });
  return mapSalesTask(task);
}

// Mappers
function mapEmailPlan(p: Record<string, unknown>): EmailPlanSummary {
  return {
    id: p.id as string,
    tenantKey: p.tenant_key as string,
    eventId: p.event_id as string,
    sequenceName: p.sequence_name as string,
    audienceSegment: p.audience_segment as string | null,
    emailCount: p.email_count as number,
    plannedSendDates: p.planned_send_dates as string[] | null,
    subjectDraft: p.subject_draft as string | null,
    contentDraft: p.content_draft as string | null,
    contentType: p.content_type as EmailPlanSummary['contentType'],
    approvalStatus: p.approval_status as EmailPlanSummary['approvalStatus'],
    createdByUserId: p.created_by_user_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapWhatsappPlan(p: Record<string, unknown>): WhatsappPlanSummary {
  return {
    id: p.id as string,
    tenantKey: p.tenant_key as string,
    eventId: p.event_id as string,
    audienceSegment: p.audience_segment as string | null,
    frequency: p.frequency as string | null,
    contentType: p.content_type as WhatsappPlanSummary['contentType'],
    messageDraft: p.message_draft as string | null,
    approvalStatus: p.approval_status as WhatsappPlanSummary['approvalStatus'],
    createdByUserId: p.created_by_user_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapUpsellPlan(p: Record<string, unknown>): UpsellPlanSummary {
  return {
    id: p.id as string,
    tenantKey: p.tenant_key as string,
    eventId: p.event_id as string,
    targetSegment: p.target_segment as string | null,
    offer: p.offer as string | null,
    fomoAngle: p.fomo_angle as string | null,
    plannedChannel: p.planned_channel as string | null,
    approvalStatus: p.approval_status as UpsellPlanSummary['approvalStatus'],
    createdByUserId: p.created_by_user_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapContentRequirement(r: Record<string, unknown>): ContentRequirementSummary {
  return {
    id: r.id as string,
    tenantKey: r.tenant_key as string,
    eventId: r.event_id as string,
    assetType: r.asset_type as ContentRequirementSummary['assetType'],
    description: r.description as string | null,
    platform: r.platform as string | null,
    dueDate: r.due_date as Date | null,
    status: r.status as ContentRequirementSummary['status'],
    createdByUserId: r.created_by_user_id as string,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapSalesTask(t: Record<string, unknown>): SalesTaskSummary {
  return {
    id: t.id as string,
    tenantKey: t.tenant_key as string,
    eventId: t.event_id as string,
    taskType: t.task_type as SalesTaskSummary['taskType'],
    ownerRole: t.owner_role as string | null,
    description: t.description as string | null,
    dueDate: t.due_date as Date | null,
    status: t.status as SalesTaskSummary['status'],
    createdByUserId: t.created_by_user_id as string,
    createdAt: t.created_at as Date,
    updatedAt: t.updated_at as Date,
  };
}
