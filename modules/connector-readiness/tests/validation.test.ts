import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  auditRecord: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  integrationCredential: { update: vi.fn().mockResolvedValue({ id: 'cred-1' }) },
}));

const credentialMocks = vi.hoisted(() => ({
  getActiveIntegrationCredential: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('../../integration-credentials/service', () => credentialMocks);

import * as repo from '../repository';

const baseCredential = {
  id: 'cred-1',
  tenantKey: 'tenant-a',
  provider: 'meta_analytics',
  credentialType: 'api_key',
  connectionKey: 'default',
  displayName: 'Meta read access',
  metadata: {},
};

describe('provider read-access validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KAJABI_READ_SYNC_ENABLED;
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue(null);
  });

  it('returns requires_credentials when no tenant credential exists', async () => {
    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'meta_analytics');

    expect(result.status).toBe('requires_credentials');
    expect(result.rawSecretsReturned).toBe(false);
    expect(result.externalWritesAllowed).toBe(false);
    expect(prismaMocks.auditRecord.create).not.toHaveBeenCalled();
  });

  it('validates Meta read access without exposing secrets or raw payload', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      ...baseCredential,
      secrets: { accessToken: 'meta-secret-token', adAccountId: '12345' },
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ impressions: '100', reach: '80', clicks: '7', spend: '12.50' }] }),
      text: async () => '',
    });

    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'meta_analytics', fetcher);

    expect(result.status).toBe('validated');
    expect(result.evidence.rowsFound).toBe(1);
    expect(result.rawSecretsReturned).toBe(false);
    expect(result.rawPayloadReturned).toBe(false);
    expect(JSON.stringify(result)).not.toContain('meta-secret-token');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer meta-secret-token');
    expect(prismaMocks.integrationCredential.update).toHaveBeenCalledWith({
      where: { id: 'cred-1' },
      data: { last_validated_at: result.checkedAt },
    });
  });

  it('reports YouTube provider HTTP failures as failed validation', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      ...baseCredential,
      provider: 'youtube_analytics',
      credentialType: 'oauth_token',
      displayName: 'YouTube read access',
      secrets: { accessToken: 'youtube-secret-token', channelId: 'channel-1' },
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => 'forbidden',
    });

    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'youtube_analytics', fetcher);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('HTTP 403');
    expect(prismaMocks.integrationCredential.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('youtube-secret-token');
  });

  it('keeps Formaloo honest until the customer read contract is confirmed', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      ...baseCredential,
      provider: 'formaloo',
      displayName: 'Formaloo read access',
      secrets: { clientKey: 'formaloo-client', clientSecret: 'formaloo-secret', formId: 'form-1' },
    });

    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'formaloo');

    expect(result.status).toBe('requires_provider_contract');
    expect(result.requiredActions.join(' ')).toContain('Formaloo');
    expect(result.externalWritesAllowed).toBe(false);
    expect(prismaMocks.integrationCredential.update).not.toHaveBeenCalled();
  });

  it('keeps Kajabi validation blocked until the environment read-sync gate is enabled', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      ...baseCredential,
      provider: 'kajabi',
      credentialType: 'oauth_client',
      displayName: 'Kajabi read access',
      secrets: { clientId: 'kajabi-client', clientSecret: 'kajabi-secret' },
    });
    const fetcher = vi.fn();

    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'kajabi', fetcher);

    expect(result.status).toBe('requires_provider_contract');
    expect(result.message).toContain('KAJABI_READ_SYNC_ENABLED');
    expect(result.externalWritesAllowed).toBe(false);
    expect(result.rawPayloadReturned).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('kajabi-secret');
  });

  it('validates Kajabi read access when customer credentials and environment gate are ready', async () => {
    process.env.KAJABI_READ_SYNC_ENABLED = 'true';
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      ...baseCredential,
      provider: 'kajabi',
      credentialType: 'oauth_client',
      displayName: 'Kajabi read access',
      secrets: { clientId: 'kajabi-client', clientSecret: 'kajabi-secret', baseUrl: 'https://api.kajabi.com' },
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'kajabi-access-token' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'purchase-1' }] }),
        text: async () => '',
      });

    const result = await repo.validateProviderReadAccess('tenant-a', 'user-1', 'kajabi', fetcher);

    expect(result.status).toBe('validated');
    expect(result.evidence.rowsFound).toBe(1);
    expect(result.rawSecretsReturned).toBe(false);
    expect(result.rawPayloadReturned).toBe(false);
    expect(JSON.stringify(result)).not.toContain('kajabi-secret');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
