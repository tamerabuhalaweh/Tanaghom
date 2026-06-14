import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import type { CreateCampaignInput, UpdateCampaignInput, CampaignSummary, ContentState } from './types';

export async function listCampaigns(
  requesterId?: string,
  status?: ContentState,
  platform?: string,
): Promise<CampaignSummary[]> {
  const where: any = {};
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

  return campaigns.map(mapCampaign);
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
  // Validate department exists
  const dept = await prisma.department.findUnique({ where: { id: input.ownerDepartmentId } });
  if (!dept) throw new ValidationError('Department not found', { ownerDepartmentId: `Department ${input.ownerDepartmentId} does not exist` });

  const campaign = await prisma.contentRequest.create({
    data: {
      requester_id: requesterId,
      channel,
      raw_message: input.topic,
      objective: input.objective,
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

  // Validate department exists if being changed
  if (input.ownerDepartmentId !== undefined) {
    const dept = await prisma.department.findUnique({ where: { id: input.ownerDepartmentId } });
    if (!dept) throw new ValidationError('Department not found', { ownerDepartmentId: `Department ${input.ownerDepartmentId} does not exist` });
  }

  const data: any = {};
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

// ============================================================
// Mapper
// ============================================================

function mapCampaign(c: any): CampaignSummary {
  return {
    id: c.id,
    requesterId: c.requester_id,
    requesterName: c.requester?.name || null,
    channel: c.channel,
    topic: c.raw_message,
    objective: c.objective,
    audience: c.audience || '',
    targetPlatforms: c.target_platforms,
    deadline: c.deadline,
    cta: c.cta,
    mediaRequirements: c.media_refs?.requirements || null,
    ownerDepartmentId: c.owner_department_id || '',
    ownerDepartmentName: null,
    contentType: c.content_type,
    riskCategory: c.risk_category,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}
