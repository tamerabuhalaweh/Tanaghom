import { prisma } from '@shared/database';

export interface InternalContentTargets {
  campaignIds: string[];
  contentItemIds: string[];
  draftVersionIds: string[];
}
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export async function getInternalContentTargets(tenantKey: string): Promise<InternalContentTargets> {
  const [setupCampaigns, mockItems, mockVersions] = await Promise.all([
    prisma.contentRequest.findMany({
      where: {
        tenant_key: tenantKey,
        OR: [
          { raw_message: { contains: 'Proof-led customer story', mode: 'insensitive' } },
          { raw_message: { contains: 'Premium social intelligence launch', mode: 'insensitive' } },
          { raw_message: { startsWith: 'Sprint ', contains: 'Acceptance', mode: 'insensitive' } },
          {
            AND: [
              { raw_message: { equals: 'Product Feature Announcement', mode: 'insensitive' } },
              { objective: { equals: 'Announce new product features to existing customers', mode: 'insensitive' } },
            ],
          },
          {
            AND: [
              { raw_message: { equals: 'Summer Wellness Launch', mode: 'insensitive' } },
              { objective: { contains: 'wellness course', mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        content_items: {
          select: {
            id: true,
            draft_versions: { select: { id: true } },
          },
        },
      },
    }),
    prisma.contentItem.findMany({
      where: {
        tenant_key: tenantKey,
        draft_text: { contains: '[Mock LLM]', mode: 'insensitive' },
      },
      select: {
        id: true,
        request_id: true,
        draft_versions: { select: { id: true } },
      },
    }),
    prisma.draftVersion.findMany({
      where: {
        text: { contains: '[Mock LLM]', mode: 'insensitive' },
        content_item: { tenant_key: tenantKey },
      },
      select: {
        id: true,
        content_item: { select: { id: true, request_id: true } },
      },
    }),
  ]);

  const campaignIds = setupCampaigns.map(campaign => campaign.id);
  const contentItemIds = setupCampaigns.flatMap(campaign => campaign.content_items.map(item => item.id));
  const draftVersionIds = setupCampaigns.flatMap(campaign => campaign.content_items.flatMap(item => item.draft_versions.map(version => version.id)));

  for (const item of mockItems) {
    campaignIds.push(item.request_id);
    contentItemIds.push(item.id);
    draftVersionIds.push(...item.draft_versions.map(version => version.id));
  }

  for (const version of mockVersions) {
    campaignIds.push(version.content_item.request_id);
    contentItemIds.push(version.content_item.id);
    draftVersionIds.push(version.id);
  }

  return {
    campaignIds: unique(campaignIds),
    contentItemIds: unique(contentItemIds),
    draftVersionIds: unique(draftVersionIds),
  };
}
