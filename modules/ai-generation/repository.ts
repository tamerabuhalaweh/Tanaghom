import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { DraftResult, DraftMetadata, DraftVersionResult, Platform, DraftContentType } from './types';

export async function createContentItem(
  campaignRequestId: string,
  platform: Platform,
  contentType: DraftContentType,
  draftText: string,
  metadata: DraftMetadata,
  riskNotes: string,
): Promise<DraftResult> {
  const item = await prisma.contentItem.create({
    data: {
      request_id: campaignRequestId,
      platform,
      content_type: contentType,
      draft_text: draftText,
      risk_score: 0,
      risk_reason: riskNotes,
      status: 'drafting',
    },
  });

  return {
    contentItemId: item.id,
    platform: platform,
    contentType: contentType,
    draftText: draftText,
    versionNo: 1,
    metadata,
    riskNotes,
    createdAt: item.created_at,
  };
}

export async function createDraftVersion(
  contentItemId: string,
  versionNo: number,
  text: string,
  modelUsed: string,
): Promise<DraftVersionResult> {
  const version = await prisma.draftVersion.create({
    data: {
      content_item_id: contentItemId,
      version_no: versionNo,
      text,
      model_used: modelUsed,
    },
  });

  return {
    id: version.id,
    contentItemId: version.content_item_id,
    versionNo: String(version.version_no),
    text: version.text,
    modelUsed: version.model_used,
    createdAt: version.created_at,
  };
}

export async function getContentItem(id: string) {
  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      draft_versions: { orderBy: { version_no: 'desc' } },
      request: true,
    },
  });
  if (!item) throw new NotFoundError('Content item', id);
  return item;
}

export async function getContentItemsByCampaign(campaignRequestId: string) {
  return prisma.contentItem.findMany({
    where: { request_id: campaignRequestId },
    include: {
      draft_versions: { orderBy: { version_no: 'desc' } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getLatestVersion(contentItemId: string) {
  const version = await prisma.draftVersion.findFirst({
    where: { content_item_id: contentItemId },
    orderBy: { version_no: 'desc' },
  });
  return version;
}

export async function updateContentItemDraft(id: string, draftText: string) {
  return prisma.contentItem.update({
    where: { id },
    data: { draft_text: draftText },
  });
}
