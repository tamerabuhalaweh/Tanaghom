import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import type { CreateCampaignInput, UpdateCampaignInput, CampaignSummary, ContentState } from './types';

export async function listCampaigns(
  requesterId?: string,
  status?: ContentState,
  platform?: string,
): Promise<CampaignSummary[]> {
  const where: Record<string, unknown> = {};
  if (requesterId) where.requester_id = requesterId;
  if (status) where.status = status;
  if (platform) where.target_platforms = { has: platform };

  const campaigns = await prisma.contentRequest.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return campaigns.map((c) => mapCampaign(c));
}

export async function getCampaignById(id: string): Promise<CampaignSummary> {
  const campaign = await prisma.contentRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true } },
    },
  });
  if (!campaign) throw new NotFoundError('Campaign', id);
  return mapCampaign(campaign);
}

export async function createCampaign(
  requesterId: string,
  channel: string,
  input: CreateCampaignInput,
): Promise<CampaignSummary> {
  const dept = await prisma.department.findUnique({ where: { id: input.ownerDepartmentId } });
  if (!dept) throw new ValidationError('Department not found', { ownerDepartmentId: `Department ${input.ownerDepartmentId} does not exist` });

  const campaign = await prisma.contentRequest.create({
    data: {
      requester_id: requesterId,
      channel,
      raw_message: input.topic,
      objective: input.objective,
      audience: input.audience,
      content_type: input.contentType,
      risk_category: input.riskCategory,
      target_platforms: input.targetPlatforms,
      deadline: input.deadline ? new Date(input.deadline) : null,
      cta: input.cta,
      media_refs: input.mediaRequirements ? { requirements: input.mediaRequirements } : undefined,
      status: 'idea',
      owner_department_id: input.ownerDepartmentId,
    },
    include: {
      requester: { select: { id: true, name: true } },
    },
  });

  return mapCampaign(campaign);
}

export async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<CampaignSummary> {
  const existing = await prisma.contentRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Campaign', id);

  if (input.ownerDepartmentId !== undefined) {
    const dept = await prisma.department.findUnique({ where: { id: input.ownerDepartmentId } });
    if (!dept) throw new ValidationError('Department not found', { ownerDepartmentId: `Department ${input.ownerDepartmentId} does not exist` });
  }

  const data: Record<string, unknown> = {};
  if (input.topic !== undefined) data.raw_message = input.topic;
  if (input.objective !== undefined) data.objective = input.objective;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.targetPlatforms !== undefined) data.target_platforms = input.targetPlatforms;
  if (input.deadline !== undefined) data.deadline = input.deadline ? new Date(input.deadline) : null;
  if (input.cta !== undefined) data.cta = input.cta;
  if (input.mediaRequirements !== undefined) data.media_refs = input.mediaRequirements ? { requirements: input.mediaRequirements } : null;
  if (input.ownerDepartmentId !== undefined) data.owner_department_id = input.ownerDepartmentId;
  if (input.contentType !== undefined) data.content_type = input.contentType;
  if (input.riskCategory !== undefined) data.risk_category = input.riskCategory;

  const campaign = await prisma.contentRequest.update({
    where: { id },
    data,
    include: {
      requester: { select: { id: true, name: true } },
    },
  });

  return mapCampaign(campaign);
}

export async function updateCampaignStatus(id: string, toState: ContentState): Promise<CampaignSummary> {
  const campaign = await prisma.contentRequest.update({
    where: { id },
    data: { status: toState },
    include: {
      requester: { select: { id: true, name: true } },
    },
  });
  return mapCampaign(campaign);
}

function mapCampaign(c: Record<string, unknown>): CampaignSummary {
  const requester = c.requester as { name: string } | null;
  const mediaRefs = c.media_refs as { requirements?: string } | null;
  return {
    id: c.id as string,
    requesterId: c.requester_id as string,
    requesterName: requester?.name || null,
    channel: c.channel as string,
    topic: c.raw_message as string,
    objective: c.objective as string,
    audience: (c.audience as string) || '',
    targetPlatforms: c.target_platforms as string[],
    deadline: c.deadline as Date | null,
    cta: c.cta as string | null,
    mediaRequirements: mediaRefs?.requirements || null,
    ownerDepartmentId: (c.owner_department_id as string) || '',
    ownerDepartmentName: null,
    contentType: c.content_type as CampaignSummary['contentType'],
    riskCategory: c.risk_category as CampaignSummary['riskCategory'],
    status: c.status as CampaignSummary['status'],
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}
