import { prisma } from '@shared/database';
import { getInternalContentTargets } from '@shared/customer-content';

export async function listPublishingPackages(tenantKey: string, includeInternal: boolean): Promise<Record<string, unknown>[]> {
  const internal = includeInternal
    ? { campaignIds: [], contentItemIds: [], draftVersionIds: [] }
    : await getInternalContentTargets(tenantKey);
  const exclusions: Record<string, unknown>[] = [];
  if (internal.campaignIds.length) exclusions.push({ campaign_id: { in: internal.campaignIds } });
  if (internal.contentItemIds.length) exclusions.push({ content_item_id: { in: internal.contentItemIds } });
  if (internal.draftVersionIds.length) exclusions.push({ draft_version_id: { in: internal.draftVersionIds } });

  const packages = await prisma.publishingPackage.findMany({
    where: { tenant_key: tenantKey, ...(exclusions.length ? { NOT: exclusions } : {}) },
    orderBy: { created_at: 'desc' },
    take: 10,
  });

  return packages.map((pkg: Record<string, unknown>) => ({
    id: pkg.id,
    campaignId: pkg.campaign_id,
    status: pkg.package_status,
    createdAt: pkg.created_at,
  }));
}
