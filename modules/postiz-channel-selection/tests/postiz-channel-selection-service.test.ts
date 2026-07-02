import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { selectChannelForEvent } from '../service';
import * as repo from '../repository';

vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

vi.mock('../repository', () => ({
  getEventById: vi.fn(),
  getConnectorById: vi.fn(),
  getTenantSelectedPostizChannel: vi.fn(),
  buildChannelTag: vi.fn((platform: string, integrationChannelId: string) => `postiz:${platform}:${integrationChannelId}`),
  updateEventSelectedChannels: vi.fn(),
}));

const eventId = '11111111-1111-4111-8111-111111111111';
const connectorId = '22222222-2222-4222-8222-222222222222';

describe('Postiz channel selection service', () => {
  beforeEach(() => {
    vi.mocked(repo.getEventById).mockResolvedValue({
      id: eventId,
      tenantKey: 'tenant-a',
      name: 'Course Launch',
      selectedChannels: [],
      status: 'planning',
    });
    vi.mocked(repo.getConnectorById).mockResolvedValue({
      id: connectorId,
      connectorName: 'Postiz Sandbox',
      connectorStatus: 'active',
      supportsSchedule: true,
      m5Allowed: false,
    });
    vi.mocked(repo.getTenantSelectedPostizChannel).mockResolvedValue({
      integrationChannelId: 'postiz-channel-1',
      platform: 'instagram',
      channelDisplayName: 'Course IG',
      disabled: false,
      refreshNeeded: false,
    });
    vi.mocked(repo.updateEventSelectedChannels).mockResolvedValue();
  });

  it('rejects event selection before a tenant Postiz channel is validated', async () => {
    vi.mocked(repo.getTenantSelectedPostizChannel).mockResolvedValue(null);

    await expect(selectChannelForEvent('marketing_manager', 'tenant-a', 'user-1', {
      eventId,
      postizConnectorId: connectorId,
      postizIntegrationChannelId: 'postiz-channel-1',
      platform: 'instagram',
    })).rejects.toThrow(ForbiddenError);
  });

  it('rejects channel ids that were not returned by the tenant Postiz account', async () => {
    await expect(selectChannelForEvent('marketing_manager', 'tenant-a', 'user-1', {
      eventId,
      postizConnectorId: connectorId,
      postizIntegrationChannelId: 'invented-channel',
      platform: 'instagram',
    })).rejects.toThrow(ForbiddenError);
  });

  it('writes only the tenant-validated channel tag to the event', async () => {
    const result = await selectChannelForEvent('marketing_manager', 'tenant-a', 'user-1', {
      eventId,
      postizConnectorId: connectorId,
      postizIntegrationChannelId: 'postiz-channel-1',
      platform: 'x',
      channelDisplayName: 'Wrong label',
    });

    expect(repo.updateEventSelectedChannels).toHaveBeenCalledWith(
      'tenant-a',
      eventId,
      'postiz:instagram:postiz-channel-1',
      'add',
    );
    expect(result.selection.platform).toBe('instagram');
    expect(result.selection.channelDisplayName).toBe('Course IG');
    expect(result.readiness.state).toBe('ready');
  });

  it('rejects connectors that cannot schedule', async () => {
    vi.mocked(repo.getConnectorById).mockResolvedValue({
      id: connectorId,
      connectorName: 'Postiz Draft Only',
      connectorStatus: 'active',
      supportsSchedule: false,
      m5Allowed: false,
    });

    await expect(selectChannelForEvent('marketing_manager', 'tenant-a', 'user-1', {
      eventId,
      postizConnectorId: connectorId,
      postizIntegrationChannelId: 'postiz-channel-1',
      platform: 'instagram',
    })).rejects.toThrow(ForbiddenError);
  });
});
