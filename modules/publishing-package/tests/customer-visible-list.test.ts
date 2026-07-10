import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  packageFindMany: vi.fn(),
  getInternalContentTargets: vi.fn(),
}));

vi.mock('@shared/database', () => ({
  prisma: { publishingPackage: { findMany: mocks.packageFindMany } },
}));

vi.mock('@shared/customer-content', () => ({
  getInternalContentTargets: mocks.getInternalContentTargets,
}));

import { listPublishingPackages } from '../list';

describe('customer-visible publishing package list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.packageFindMany.mockResolvedValue([]);
    mocks.getInternalContentTargets.mockResolvedValue({
      campaignIds: ['campaign-internal'],
      contentItemIds: ['item-internal'],
      draftVersionIds: ['draft-internal'],
    });
  });

  it('applies internal exclusions in the database query before the result limit', async () => {
    await listPublishingPackages('tenant-a', false);

    expect(mocks.getInternalContentTargets).toHaveBeenCalledWith('tenant-a');
    expect(mocks.packageFindMany).toHaveBeenCalledWith({
      where: {
        tenant_key: 'tenant-a',
        NOT: [
          { campaign_id: { in: ['campaign-internal'] } },
          { content_item_id: { in: ['item-internal'] } },
          { draft_version_id: { in: ['draft-internal'] } },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
  });

  it('allows privileged audit retrieval without customer visibility filtering', async () => {
    await listPublishingPackages('tenant-a', true);

    expect(mocks.getInternalContentTargets).not.toHaveBeenCalled();
    expect(mocks.packageFindMany).toHaveBeenCalledWith({
      where: { tenant_key: 'tenant-a' },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
  });
});
