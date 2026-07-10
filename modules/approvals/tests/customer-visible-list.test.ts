import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approvalFindMany: vi.fn(),
  getInternalContentTargets: vi.fn(),
}));

vi.mock('@shared/database', () => ({
  prisma: { approval: { findMany: mocks.approvalFindMany } },
}));

vi.mock('@shared/customer-content', () => ({
  getInternalContentTargets: mocks.getInternalContentTargets,
}));

import { listApprovals } from '../repository';

describe('customer-visible approval list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approvalFindMany.mockResolvedValue([]);
    mocks.getInternalContentTargets.mockResolvedValue({
      campaignIds: ['campaign-internal'],
      contentItemIds: ['item-internal'],
      draftVersionIds: ['draft-internal'],
    });
  });

  it('excludes every internal target type before querying approvals', async () => {
    await listApprovals({ tenantKey: 'tenant-a', customerVisibleOnly: true });

    expect(mocks.getInternalContentTargets).toHaveBeenCalledWith('tenant-a');
    expect(mocks.approvalFindMany).toHaveBeenCalledWith({
      where: {
        tenant_key: 'tenant-a',
        NOT: [
          { target_type: 'campaign', target_id: { in: ['campaign-internal'] } },
          { target_type: 'content_item', target_id: { in: ['item-internal'] } },
          { target_type: 'draft_version', target_id: { in: ['draft-internal'] } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });
  });

  it('keeps internal records available when the privileged option is not requested', async () => {
    await listApprovals({ tenantKey: 'tenant-a' });

    expect(mocks.getInternalContentTargets).not.toHaveBeenCalled();
    expect(mocks.approvalFindMany).toHaveBeenCalledWith({
      where: { tenant_key: 'tenant-a' },
      orderBy: { created_at: 'desc' },
    });
  });
});
