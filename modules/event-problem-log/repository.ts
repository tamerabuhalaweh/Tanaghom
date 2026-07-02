import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateProblemInput, UpdateProblemInput, ProblemSummary,
  ProblemStatus, ProblemSeverity, ProblemCategory,
  ProblemDashboardSummary,
} from './types';

export async function listProblems(
  tenantKey: string,
  eventId?: string,
  status?: ProblemStatus,
  severity?: ProblemSeverity,
  category?: ProblemCategory,
): Promise<ProblemSummary[]> {
  const where: Prisma.EventProblemWhereInput = { tenant_key: tenantKey };
  if (eventId) where.event_id = eventId;
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (category) where.category = category;

  const problems = await prisma.eventProblem.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
  });
  return problems.map(mapProblem);
}

export async function getProblemById(tenantKey: string, id: string): Promise<ProblemSummary> {
  const problem = await prisma.eventProblem.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!problem) throw new NotFoundError('EventProblem', id);
  return mapProblem(problem);
}

export async function createProblem(
  tenantKey: string, userId: string, input: CreateProblemInput,
): Promise<ProblemSummary> {
  const event = await prisma.commercialEvent.findFirst({ where: { id: input.eventId, tenant_key: tenantKey } });
  if (!event) throw new NotFoundError('CommercialEvent', input.eventId);

  if (input.relatedLeadId) {
    const lead = await prisma.leadCaptureRecord.findFirst({ where: { id: input.relatedLeadId, tenant_key: tenantKey } });
    if (!lead) throw new NotFoundError('Lead', input.relatedLeadId);
  }

  if (input.relatedCampaignId) {
    const campaign = await prisma.contentRequest.findFirst({ where: { id: input.relatedCampaignId, tenant_key: tenantKey } });
    if (!campaign) throw new NotFoundError('Campaign', input.relatedCampaignId);
  }

  const problem = await prisma.eventProblem.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity ?? 'medium',
      source: input.source ?? 'manual',
      impact_summary: input.impactSummary,
      recommended_action: input.recommendedAction,
      owner_role: input.ownerRole,
      related_lead_id: input.relatedLeadId,
      related_campaign_id: input.relatedCampaignId,
      due_date: input.dueDate ? new Date(input.dueDate) : null,
      created_by_user_id: userId,
    },
  });
  return mapProblem(problem);
}

export async function updateProblem(
  tenantKey: string, id: string, input: UpdateProblemInput,
): Promise<ProblemSummary> {
  const existing = await prisma.eventProblem.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventProblem', id);

  if (input.relatedLeadId !== undefined && input.relatedLeadId !== null) {
    const lead = await prisma.leadCaptureRecord.findFirst({ where: { id: input.relatedLeadId, tenant_key: tenantKey } });
    if (!lead) throw new NotFoundError('Lead', input.relatedLeadId);
  }

  if (input.relatedCampaignId !== undefined && input.relatedCampaignId !== null) {
    const campaign = await prisma.contentRequest.findFirst({ where: { id: input.relatedCampaignId, tenant_key: tenantKey } });
    if (!campaign) throw new NotFoundError('Campaign', input.relatedCampaignId);
  }

  const data: Prisma.EventProblemUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.source !== undefined) data.source = input.source;
  if (input.impactSummary !== undefined) data.impact_summary = input.impactSummary;
  if (input.recommendedAction !== undefined) data.recommended_action = input.recommendedAction;
  if (input.ownerRole !== undefined) data.owner_role = input.ownerRole;
  if (input.relatedLeadId !== undefined) data.related_lead_id = input.relatedLeadId;
  if (input.relatedCampaignId !== undefined) data.related_campaign_id = input.relatedCampaignId;
  if (input.dueDate !== undefined) data.due_date = input.dueDate ? new Date(input.dueDate) : null;

  const problem = await prisma.eventProblem.update({ where: { id }, data });
  return mapProblem(problem);
}

export async function transitionProblem(
  tenantKey: string, id: string, toStatus: ProblemStatus,
  userId: string, resolutionNotes?: string,
): Promise<ProblemSummary> {
  const existing = await prisma.eventProblem.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('EventProblem', id);

  if ((toStatus === 'resolved' || toStatus === 'dismissed') && !resolutionNotes) {
    throw new ValidationError('Resolution notes required for resolved/dismissed status');
  }

  const data: Prisma.EventProblemUpdateInput = { status: toStatus };
  if (resolutionNotes) data.resolution_notes = resolutionNotes;
  if (toStatus === 'resolved' || toStatus === 'dismissed') {
    data.resolved_by = { connect: { id: userId } };
    data.resolved_at = new Date();
  }

  const problem = await prisma.eventProblem.update({ where: { id }, data });
  return mapProblem(problem);
}

export async function getProblemDashboard(tenantKey: string, eventId: string): Promise<ProblemDashboardSummary> {
  const problems = await prisma.eventProblem.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
  });

  const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const byStatus: Record<string, number> = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
  const byCategory: Record<string, number> = {};
  const openProblems: Array<{ id: string; title: string; severity: ProblemSeverity; category: ProblemCategory; ownerRole: string | null }> = [];

  for (const p of problems) {
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;

    if (p.status === 'open' || p.status === 'investigating') {
      openProblems.push({
        id: p.id,
        title: p.title,
        severity: p.severity as ProblemSeverity,
        category: p.category as ProblemCategory,
        ownerRole: p.owner_role,
      });
    }
  }

  const criticalOpen = problems.filter(p => p.severity === 'critical' && (p.status === 'open' || p.status === 'investigating')).length;

  openProblems.sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
  });

  return {
    eventId,
    totalProblems: problems.length,
    openProblems: openProblems.length,
    criticalOpen,
    bySeverity: bySeverity as Record<ProblemSeverity, number>,
    byStatus: byStatus as Record<ProblemStatus, number>,
    byCategory: byCategory as Record<ProblemCategory, number>,
    topBlockers: openProblems.slice(0, 5),
  };
}

function mapProblem(p: Record<string, unknown>): ProblemSummary {
  return {
    id: p.id as string,
    tenantKey: p.tenant_key as string,
    eventId: p.event_id as string,
    title: p.title as string,
    description: p.description as string | null,
    category: p.category as ProblemSummary['category'],
    severity: p.severity as ProblemSummary['severity'],
    status: p.status as ProblemSummary['status'],
    source: p.source as ProblemSummary['source'],
    impactSummary: p.impact_summary as string | null,
    recommendedAction: p.recommended_action as string | null,
    ownerRole: p.owner_role as string | null,
    relatedLeadId: p.related_lead_id as string | null,
    relatedCampaignId: p.related_campaign_id as string | null,
    dueDate: p.due_date as Date | null,
    resolutionNotes: p.resolution_notes as string | null,
    createdByUserId: p.created_by_user_id as string,
    resolvedByUserId: p.resolved_by_user_id as string | null,
    resolvedAt: p.resolved_at as Date | null,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}
