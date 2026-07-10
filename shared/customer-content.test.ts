import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  contentRequest: { findMany: vi.fn() },
  contentItem: { findMany: vi.fn() },
  draftVersion: { findMany: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: database }));

import { getInternalContentTargets } from './customer-content';

describe('customer content visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.contentRequest.findMany.mockResolvedValue([]);
    database.contentItem.findMany.mockResolvedValue([]);
    database.draftVersion.findMany.mockResolvedValue([]);
  });

  it('collects campaign, content item, and draft targets without duplicates', async () => {
    database.contentRequest.findMany.mockResolvedValue([{
      id: 'campaign-setup',
      content_items: [{ id: 'item-setup', draft_versions: [{ id: 'draft-setup' }] }],
    }]);
    database.contentItem.findMany.mockResolvedValue([{
      id: 'item-mock',
      request_id: 'campaign-mock',
      draft_versions: [{ id: 'draft-mock' }],
    }]);
    database.draftVersion.findMany.mockResolvedValue([{
      id: 'draft-mock',
      content_item: { id: 'item-mock', request_id: 'campaign-mock' },
    }]);

    await expect(getInternalContentTargets('tenant-a')).resolves.toEqual({
      campaignIds: ['campaign-setup', 'campaign-mock'],
      contentItemIds: ['item-setup', 'item-mock'],
      draftVersionIds: ['draft-setup', 'draft-mock'],
    });
  });

  it('scopes every classifier query to the active tenant', async () => {
    await getInternalContentTargets('tenant-b');

    expect(database.contentRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-b' }),
    }));
    expect(database.contentItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-b' }),
    }));
    expect(database.draftVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ content_item: { tenant_key: 'tenant-b' } }),
    }));
  });
});
