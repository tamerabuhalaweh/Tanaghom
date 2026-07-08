import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const credentialMocks = vi.hoisted(() => ({
  getActiveIntegrationCredential: vi.fn(),
}));

vi.mock('../../integration-credentials/service', () => credentialMocks);

import { AppError, ForbiddenError } from '@shared/errors';
import { mediateConnectorDryRunPolicy } from '../agentgateway';

const input = {
  tenantKey: 'tenant-a',
  userId: 'user-1',
  role: 'marketing_manager',
  connectorId: 'meta_analytics',
  eventId: 'event-1',
};

describe('agentgateway connector dry-run policy mediation', () => {
  const originalFlag = process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED = '';
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED;
    else process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED = originalFlag;
    global.fetch = originalFetch;
  });

  it('returns explicit not_enabled evidence when the pilot flag is disabled', async () => {
    const result = await mediateConnectorDryRunPolicy(input);

    expect(result).toMatchObject({
      provider: 'agentgateway',
      operation: 'connector_import.dry_run',
      enabled: false,
      mediated: false,
      decision: 'not_enabled',
      dryRunOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
    });
    expect(credentialMocks.getActiveIntegrationCredential).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires an agentgateway runtime endpoint credential when the pilot flag is enabled', async () => {
    process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED = 'true';
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue(null);

    await expect(mediateConnectorDryRunPolicy(input)).rejects.toThrow(AppError);
  });

  it('calls the policy endpoint with dry-run-only authority and returns allowed mediation evidence', async () => {
    process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED = 'true';
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      secrets: {
        baseUrl: 'https://gateway.example',
        apiKey: 'secret-key',
        connectorDryRunPolicyPath: '/policies/dry-run',
      },
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ decision: 'allow', reason: 'Policy allowed dry-run preview.' }),
    } as Response);

    const result = await mediateConnectorDryRunPolicy(input);

    expect(global.fetch).toHaveBeenCalledWith(new URL('https://gateway.example/policies/dry-run'), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer secret-key',
        'Content-Type': 'application/json',
      }),
    }));
    const body = JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      operation: 'connector_import.dry_run',
      connectorId: 'meta_analytics',
      eventId: 'event-1',
      authority: {
        sourceOfTruth: 'STITCH',
        tenantKey: 'tenant-a',
        humanUserId: 'user-1',
        role: 'marketing_manager',
      },
      safety: {
        dryRunOnly: true,
        externalWritesAllowed: false,
        importWritesAllowed: false,
      },
    });
    expect(result).toMatchObject({
      enabled: true,
      mediated: true,
      decision: 'allowed',
      reason: 'Policy allowed dry-run preview.',
      statusCode: 200,
    });
  });

  it('blocks the dry-run when agentgateway denies the policy check', async () => {
    process.env.AGENTGATEWAY_DRY_RUN_POLICY_ENABLED = 'true';
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      secrets: { baseUrl: 'https://gateway.example' },
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ decision: 'deny', reason: 'Connector not approved for this tenant.' }),
    } as Response);

    await expect(mediateConnectorDryRunPolicy(input)).rejects.toThrow(ForbiddenError);
  });
});
