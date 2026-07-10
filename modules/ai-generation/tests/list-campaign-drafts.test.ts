import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  contentRequestFindFirst: vi.fn(),
  getContentItemsByCampaign: vi.fn(),
}));

vi.mock('@shared/database', () => ({
  prisma: { contentRequest: { findFirst: mocks.contentRequestFindFirst } },
}));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn(), logger: { warn: vi.fn() } }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));
vi.mock('@modules/ai-provider/controller', () => ({ resolveUserLLMProvider: vi.fn() }));
vi.mock('../repository', () => ({
  getContentItemsByCampaign: mocks.getContentItemsByCampaign,
}));

import { listCampaignDrafts } from '../service';

describe('listCampaignDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contentRequestFindFirst.mockResolvedValue({ id: 'campaign-1' });
    mocks.getContentItemsByCampaign.mockResolvedValue([{
      id: 'draft-1',
      request_id: 'campaign-1',
      platform: 'instagram',
      content_type: 'reel',
      draft_text: 'Stored draft',
      status: 'drafting',
      risk_score: 0,
      risk_reason: '',
      reach_score: 82,
      created_at: new Date('2026-07-10T10:00:00.000Z'),
      updated_at: new Date('2026-07-10T10:30:00.000Z'),
      draft_versions: [{ version_no: 2, text: 'Latest human edit' }],
    }]);
  });

  it.each(['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'specialist', 'reviewer', 'viewer'])(
    'allows %s to read tenant-owned saved drafts',
    async role => {
      const result = await listCampaignDrafts(role, 'tenant-a', 'campaign-1');
      expect(mocks.contentRequestFindFirst).toHaveBeenCalledWith({
        where: { id: 'campaign-1', tenant_key: 'tenant-a' },
        select: { id: true },
      });
      expect(mocks.getContentItemsByCampaign).toHaveBeenCalledWith('campaign-1', 'tenant-a');
      expect(result[0]).toMatchObject({
        contentItemId: 'draft-1',
        draftText: 'Latest human edit',
        versionNo: 2,
        platform: 'instagram',
      });
    },
  );

  it('rejects unknown roles', async () => {
    await expect(listCampaignDrafts('unknown', 'tenant-a', 'campaign-1')).rejects.toThrow("does not have permission 'drafts:read'");
    expect(mocks.contentRequestFindFirst).not.toHaveBeenCalled();
  });

  it('does not read drafts when the campaign is outside the tenant', async () => {
    mocks.contentRequestFindFirst.mockResolvedValue(null);
    await expect(listCampaignDrafts('marketing_manager', 'tenant-b', 'campaign-1')).rejects.toThrow('Campaign request');
    expect(mocks.getContentItemsByCampaign).not.toHaveBeenCalled();
  });
});
