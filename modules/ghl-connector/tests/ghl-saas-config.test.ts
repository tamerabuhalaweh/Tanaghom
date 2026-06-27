import { beforeEach, describe, expect, it, vi } from 'vitest';

const credentialMocks = vi.hoisted(() => ({
  getActiveIntegrationCredential: vi.fn(),
}));

vi.mock('../../integration-credentials/service', () => credentialMocks);
vi.mock('@shared/database', () => ({ prisma: {} }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import { buildGhlContactPayload, ghlSandboxWriteGate, resolveGhlRuntimeConfig } from '../controller';

describe('GoHighLevel SaaS credential configuration', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv, NODE_ENV: 'test' };
    delete process.env.ALLOW_GLOBAL_GHL_CREDENTIALS;
    delete process.env.GHL_API_KEY;
    delete process.env.GOHIGHLEVEL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
  });

  afterEach(() => {
    process.env = previousEnv;
  });

  it('does not use shared environment GHL credentials unless explicitly allowed', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue(null);
    process.env.GHL_API_KEY = 'server-global-key';
    process.env.GHL_LOCATION_ID = 'server-location';

    const config = await resolveGhlRuntimeConfig('customer-a');

    expect(config.source).toBe('missing');
    expect(config.apiKey).toBe('');
    expect(config.locationId).toBe('');
    expect(config.globalFallbackAllowed).toBe(false);
  });

  it('uses tenant vault credentials for customer-owned GHL setup', async () => {
    credentialMocks.getActiveIntegrationCredential.mockResolvedValue({
      secrets: {
        apiKey: 'tenant-ghl-key',
        locationId: 'tenant-location',
      },
    });

    const config = await resolveGhlRuntimeConfig('customer-a');
    const gate = await ghlSandboxWriteGate(config);

    expect(config.source).toBe('tenant_vault');
    expect(config.apiKey).toBe('tenant-ghl-key');
    expect(config.locationId).toBe('tenant-location');
    expect(gate.reasons).not.toContain('GoHighLevel credentials must be configured in the customer tenant vault');
  });

  it('builds contact payloads without falling back to server-wide location ids', () => {
    process.env.GHL_LOCATION_ID = 'server-location';

    const payload = buildGhlContactPayload({
      lead_name_placeholder: 'Jordan Client',
      lead_email_placeholder: 'jordan@example.com',
      consent_status: 'granted',
      campaign_id: 'campaign-1',
    });

    expect(payload.locationId).toBe('<tenant configured location id>');
    expect(payload.tags).toContain('controlled-production');
  });
});
