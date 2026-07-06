import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@shared/errors';
import type { DecryptedIntegrationCredential } from '../../integration-credentials/service';
import { runPostizReadOnlyDryRun } from '../adapters/postiz';

function credential(overrides: Partial<DecryptedIntegrationCredential> = {}): DecryptedIntegrationCredential {
  return {
    id: 'cred-1',
    tenantKey: 'tenant-a',
    provider: 'postiz',
    credentialType: 'api_key',
    connectionKey: 'default',
    displayName: 'Postiz',
    secrets: {
      apiKey: 'postiz-api-key',
      baseUrl: 'https://postiz.example.test',
      integrationId: 'integration-1',
    },
    metadata: {},
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(value),
  };
}

describe('Postiz read-only dry-run adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists channels and returns an honest empty state when no Postiz channels exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runPostizReadOnlyDryRun({
      credential: credential({ secrets: { apiKey: 'postiz-api-key', baseUrl: 'https://postiz.example.test' } }),
      eventId: 'event-1',
    });

    expect(result.kpiRows).toEqual([]);
    expect(result.providerStatus?.provider).toBe('postiz');
    expect(result.providerStatus?.channelsFound).toBe(0);
    expect(result.providerStatus?.analyticsFetched).toBe(false);
    expect(result.providerStatus?.rawSecretsReturned).toBe(false);
    expect(result.warnings[0]).toContain('zero connected channels');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe('https://postiz.example.test/api/public/v1/integrations');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('postiz-api-key');
  });

  it('fetches selected channel analytics and maps recognized metrics into KPI preview rows', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 'integration-1',
          name: 'Instagram Business',
          identifier: 'instagram',
          profile: '@example',
          disabled: false,
          refreshNeeded: false,
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          label: 'Reach',
          data: [{ date: '2026-07-01', total: 1200 }],
        },
        {
          label: 'Impressions',
          data: [{ date: '2026-07-01', total: '2500' }],
        },
        {
          label: 'Clicks',
          data: [{ date: '2026-07-01', total: 85 }],
        },
        {
          label: 'Likes',
          data: [{ date: '2026-07-01', total: 44 }],
        },
        {
          label: 'Followers',
          data: [{ date: '2026-07-01', total: 999 }],
        },
      ]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runPostizReadOnlyDryRun({ credential: credential(), eventId: 'event-1' });

    expect(result.providerStatus?.channelsFound).toBe(1);
    expect(result.providerStatus?.analyticsFetched).toBe(true);
    expect(result.providerStatus?.selectedIntegrationId).toBe('integration-1');
    expect(result.providerStatus?.selectedChannel).toEqual(expect.objectContaining({
      id: 'integration-1',
      identifier: 'instagram',
      profile: '@example',
    }));
    expect(result.kpiRows).toHaveLength(1);
    expect(result.kpiRows[0]).toEqual(expect.objectContaining({
      channel: 'instagram',
      reach: 1200,
      impressions: 2500,
      clicks: 85,
      interactions: 44,
      leads: 0,
      spend: 0,
    }));
    expect(result.warnings[0]).toContain('Followers');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].toString()).toBe('https://postiz.example.test/api/public/v1/analytics/integration-1?date=30');
  });

  it('does not fetch analytics until the tenant selects a Postiz integrationId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      { id: 'integration-1', name: 'Instagram Business', identifier: 'instagram' },
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runPostizReadOnlyDryRun({
      credential: credential({ secrets: { apiKey: 'postiz-api-key', baseUrl: 'https://postiz.example.test' } }),
      eventId: 'event-1',
    });

    expect(result.kpiRows).toEqual([]);
    expect(result.providerStatus?.channelsFound).toBe(1);
    expect(result.providerStatus?.selectedIntegrationId).toBeNull();
    expect(result.providerStatus?.analyticsFetched).toBe(false);
    expect(result.warnings[0]).toContain('no integrationId is selected');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tests analytics with a manually pasted integrationId even when it is not listed by Postiz', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: 'other-integration', name: 'Other Channel', providerIdentifier: 'instagram' },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          label: 'Impressions',
          data: [{ date: '2026-07-01', total: 840 }],
        },
      ]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runPostizReadOnlyDryRun({
      credential: credential({
        secrets: {
          apiKey: 'postiz-api-key',
          baseUrl: 'https://postiz.example.test',
          integrationId: 'manual-integration-1',
        },
      }),
      eventId: 'event-1',
    });

    expect(result.providerStatus?.channelsFound).toBe(1);
    expect(result.providerStatus?.selectedIntegrationId).toBe('manual-integration-1');
    expect(result.providerStatus?.selectedChannel).toEqual(expect.objectContaining({
      id: 'manual-integration-1',
      providerIdentifier: 'postiz',
    }));
    expect(result.providerStatus?.analyticsFetched).toBe(true);
    expect(result.kpiRows).toEqual([
      expect.objectContaining({
        impressions: 840,
        channel: 'postiz',
      }),
    ]);
    expect(result.warnings[0]).toContain('not returned by the Postiz channel list');
    expect(fetchMock.mock.calls[1][0].toString()).toBe('https://postiz.example.test/api/public/v1/analytics/manual-integration-1?date=30');
  });

  it('fails safely when Postiz rejects the read-only API credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runPostizReadOnlyDryRun({ credential: credential(), eventId: 'event-1' }))
      .rejects.toThrow(ValidationError);
  });
});
