import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  DISCIPLINE_CATALOG,
  type CommercialDisciplineId,
  type CreateDisciplineRecordInput,
  type DisciplineRecordSummary,
  type DisciplineWorkspaceSummary,
  type ListDisciplineRecordsQueryInput,
  type UpdateDisciplineRecordInput,
} from './types';

const recordInclude = {
  revenue_line: { select: { id: true, revenue_line_type: true, name: true } },
  commercial_plan: { select: { id: true, title: true } },
  event: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} as const;

export async function listWorkspaces(tenantKey: string): Promise<DisciplineWorkspaceSummary[]> {
  const records = await listRecords(tenantKey, {});
  return DISCIPLINE_CATALOG.map(item => {
    const workspaceRecords = records.filter(record => record.discipline === item.id);
    return {
      ...item,
      recordCount: workspaceRecords.length,
      activeCount: workspaceRecords.filter(record => record.status === 'active').length,
      blockedCount: workspaceRecords.filter(record => record.status === 'blocked').length,
      completedCount: workspaceRecords.filter(record => record.status === 'completed').length,
      highPriorityCount: workspaceRecords.filter(record => ['high', 'critical'].includes(record.priority)).length,
      records: workspaceRecords.slice(0, 12),
    };
  });
}

export async function listRecords(
  tenantKey: string,
  filters: ListDisciplineRecordsQueryInput,
): Promise<DisciplineRecordSummary[]> {
  const where: Prisma.CommercialDisciplineRecordWhereInput = { tenant_key: tenantKey };
  if (filters.discipline) where.discipline = filters.discipline;
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.revenueLineId) where.revenue_line_id = filters.revenueLineId;
  if (filters.commercialPlanId) where.commercial_plan_id = filters.commercialPlanId;
  if (filters.eventId) where.event_id = filters.eventId;

  const records = await prisma.commercialDisciplineRecord.findMany({
    where,
    include: recordInclude,
    orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
    take: 250,
  });

  return records.map(mapRecord);
}

export async function createRecord(
  tenantKey: string,
  userId: string,
  input: CreateDisciplineRecordInput,
): Promise<DisciplineRecordSummary> {
  await assertLinkedObjects(tenantKey, input);

  const record = await prisma.commercialDisciplineRecord.create({
    data: {
      tenant_key: tenantKey,
      discipline: input.discipline,
      category: input.category,
      title: input.title,
      summary: input.summary ?? null,
      details: input.details ?? null,
      status: input.status || 'active',
      priority: input.priority || 'medium',
      source_type: input.sourceType || 'manual',
      revenue_line_id: input.revenueLineId ?? null,
      commercial_plan_id: input.commercialPlanId ?? null,
      event_id: input.eventId ?? null,
      owner_user_id: input.ownerUserId ?? null,
      created_by_user_id: userId,
    },
    include: recordInclude,
  });

  return mapRecord(record);
}

export async function updateRecord(
  tenantKey: string,
  id: string,
  input: UpdateDisciplineRecordInput,
): Promise<DisciplineRecordSummary> {
  const existing = await prisma.commercialDisciplineRecord.findFirst({
    where: { id, tenant_key: tenantKey },
    select: { id: true, discipline: true, category: true },
  });
  if (!existing) throw new NotFoundError('CommercialDisciplineRecord', id);

  const effective = {
    discipline: input.discipline || existing.discipline,
    category: input.category || existing.category,
  };
  const catalog = DISCIPLINE_CATALOG.find(item => item.id === effective.discipline);
  if (!catalog?.categories.includes(effective.category)) {
    throw new ValidationError(`${effective.category} is not valid for ${catalog?.label || effective.discipline}`);
  }

  await assertLinkedObjects(tenantKey, input);

  const record = await prisma.commercialDisciplineRecord.update({
    where: { id },
    data: {
      ...(input.discipline !== undefined ? { discipline: input.discipline } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.sourceType !== undefined ? { source_type: input.sourceType } : {}),
      ...(input.revenueLineId !== undefined ? { revenue_line_id: input.revenueLineId } : {}),
      ...(input.commercialPlanId !== undefined ? { commercial_plan_id: input.commercialPlanId } : {}),
      ...(input.eventId !== undefined ? { event_id: input.eventId } : {}),
      ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
    },
    include: recordInclude,
  });

  return mapRecord(record);
}

async function assertLinkedObjects(
  tenantKey: string,
  input: {
    revenueLineId?: string | null;
    commercialPlanId?: string | null;
    eventId?: string | null;
    ownerUserId?: string | null;
  },
): Promise<void> {
  if (input.revenueLineId) {
    const line = await prisma.commercialRevenueLine.findFirst({ where: { id: input.revenueLineId, tenant_key: tenantKey }, select: { id: true } });
    if (!line) throw new NotFoundError('CommercialRevenueLine', input.revenueLineId);
  }
  if (input.commercialPlanId) {
    const plan = await prisma.commercialPlan.findFirst({ where: { id: input.commercialPlanId, tenant_key: tenantKey }, select: { id: true, revenue_line_id: true } });
    if (!plan) throw new NotFoundError('CommercialPlan', input.commercialPlanId);
    if (input.revenueLineId && input.revenueLineId !== plan.revenue_line_id) {
      throw new ValidationError('Discipline record revenue line must match the selected commercial plan');
    }
  }
  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({ where: { id: input.eventId, tenant_key: tenantKey }, select: { id: true } });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
  }
  if (input.ownerUserId) {
    const user = await prisma.user.findFirst({ where: { id: input.ownerUserId, tenant_key: tenantKey }, select: { id: true } });
    if (!user) throw new NotFoundError('User', input.ownerUserId);
  }
}

export async function getWorkspaceContext(tenantKey: string, discipline?: CommercialDisciplineId) {
  const records = await listRecords(tenantKey, {
    discipline,
    status: undefined,
    category: undefined,
    priority: undefined,
    revenueLineId: undefined,
    commercialPlanId: undefined,
    eventId: undefined,
  });
  return {
    workspaces: discipline ? DISCIPLINE_CATALOG.filter(item => item.id === discipline) : DISCIPLINE_CATALOG,
    records: records.slice(0, 50),
    openRecords: records.filter(record => ['active', 'blocked'].includes(record.status)).slice(0, 20),
    blockedRecords: records.filter(record => record.status === 'blocked').slice(0, 10),
  };
}

function mapRecord(record: Prisma.CommercialDisciplineRecordGetPayload<{ include: typeof recordInclude }>): DisciplineRecordSummary {
  return {
    id: record.id,
    tenantKey: record.tenant_key,
    discipline: record.discipline,
    category: record.category,
    title: record.title,
    summary: record.summary,
    details: record.details,
    status: record.status,
    priority: record.priority,
    sourceType: record.source_type,
    revenueLineId: record.revenue_line_id,
    revenueLineType: record.revenue_line?.revenue_line_type || null,
    revenueLineName: record.revenue_line?.name || null,
    commercialPlanId: record.commercial_plan_id,
    commercialPlanTitle: record.commercial_plan?.title || null,
    eventId: record.event_id,
    eventName: record.event?.name || null,
    ownerUserId: record.owner_user_id,
    ownerName: record.owner?.name || null,
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
