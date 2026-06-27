import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  integrationCredential: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import {
  getActiveIntegrationCredential,
  listIntegrationCredentials,
  upsertIntegrationCredential,
} from '../service';

const previousSecretKey = process.env.SECRET_VAULT_ENCRYPTION_KEY;

describe('integration credential vault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'test-secret-vault-key-with-at-least-32-characters';
  });

  afterEach(() => {
    process.env.SECRET_VAULT_ENCRYPTION_KEY = previousSecretKey;
  });

  it('encrypts secrets and returns only safe credential metadata', async () => {
    prismaMocks.integrationCredential.upsert.mockImplementation(async ({ create }) => ({
      id: 'cred-1',
      tenant_key: create.tenant_key,
      provider: create.provider,
      credential_type: create.credential_type,
      connection_key: create.connection_key,
      display_name: create.display_name,
      encrypted_payload: create.encrypted_payload,
      secret_fingerprints: create.secret_fingerprints,
      metadata: create.metadata,
      created_by_user_id: create.created_by_user_id,
      is_active: true,
      created_at: new Date('2026-06-25T00:00:00Z'),
      updated_at: new Date('2026-06-25T00:00:00Z'),
      last_validated_at: null,
    }));

    const result = await upsertIntegrationCredential('admin', 'user-1', {
      tenantKey: 'default',
      provider: 'postiz',
      credentialType: 'api_key',
      connectionKey: 'sandbox',
      displayName: 'Postiz Sandbox',
      secrets: { apiKey: 'postiz-secret-value', baseUrl: 'https://postiz.example.test' },
      metadata: { sandboxOnly: true },
    });

    const saved = prismaMocks.integrationCredential.upsert.mock.calls[0][0].create;
    expect(JSON.stringify(saved.encrypted_payload)).not.toContain('postiz-secret-value');
    expect(result.rawSecretsReturned).toBe(false);
    expect(result.connectionKey).toBe('sandbox');
    expect(result.secretFields).toEqual(['apiKey', 'baseUrl']);
    expect(result.secretFingerprints.apiKey).toHaveLength(12);
    expect(prismaMocks.integrationCredential.upsert.mock.calls[0][0].where).toEqual({
      tenant_key_provider_credential_type_connection_key: {
        tenant_key: 'default',
        provider: 'postiz',
        credential_type: 'api_key',
        connection_key: 'sandbox',
      },
    });
  });

  it('decrypts credentials only through server-side resolver', async () => {
    await upsertIntegrationCredential('admin', 'user-1', {
      tenantKey: 'default',
      provider: 'gohighlevel',
      credentialType: 'api_key',
      displayName: 'GHL Sandbox',
      secrets: { apiKey: 'ghl-secret', locationId: 'location-1' },
      metadata: { sandboxOnly: true },
    });
    const saved = prismaMocks.integrationCredential.upsert.mock.calls[0][0].create;
    prismaMocks.integrationCredential.findUnique.mockResolvedValue({
      id: 'cred-2',
      tenant_key: 'default',
      provider: 'gohighlevel',
      credential_type: 'api_key',
      connection_key: 'default',
      display_name: 'GHL Sandbox',
      encrypted_payload: saved.encrypted_payload,
      secret_fingerprints: saved.secret_fingerprints,
      metadata: saved.metadata,
      created_by_user_id: 'user-1',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_validated_at: null,
    });

    const credential = await getActiveIntegrationCredential('gohighlevel', 'api_key');

    expect(credential?.secrets.apiKey).toBe('ghl-secret');
    expect(credential?.secrets.locationId).toBe('location-1');
    expect(prismaMocks.integrationCredential.findUnique).toHaveBeenCalledWith({
      where: {
        tenant_key_provider_credential_type_connection_key: {
          tenant_key: 'default',
          provider: 'gohighlevel',
          credential_type: 'api_key',
          connection_key: 'default',
        },
      },
    });
  });

  it('stores a selected Postiz channel ID encrypted and returns safe metadata only', async () => {
    prismaMocks.integrationCredential.upsert.mockImplementation(async ({ create }) => ({
      id: 'cred-postiz-selected-channel',
      tenant_key: create.tenant_key,
      provider: create.provider,
      credential_type: create.credential_type,
      connection_key: create.connection_key,
      display_name: create.display_name,
      encrypted_payload: create.encrypted_payload,
      secret_fingerprints: create.secret_fingerprints,
      metadata: create.metadata,
      created_by_user_id: create.created_by_user_id,
      is_active: true,
      created_at: new Date('2026-06-25T00:00:00Z'),
      updated_at: new Date('2026-06-25T00:00:00Z'),
      last_validated_at: null,
    }));

    const result = await upsertIntegrationCredential('admin', 'user-1', {
      tenantKey: 'default',
      provider: 'postiz',
      credentialType: 'api_key',
      connectionKey: 'default',
      displayName: 'Postiz Sandbox',
      secrets: {
        apiKey: 'postiz-secret-value',
        baseUrl: 'https://postiz.example.test',
        integrationId: 'postiz-channel-123',
      },
      metadata: { source: 'postiz_channel_picker' },
    });

    const saved = prismaMocks.integrationCredential.upsert.mock.calls[0][0].create;
    expect(JSON.stringify(saved.encrypted_payload)).not.toContain('postiz-channel-123');
    expect(result.secretFields).toEqual(['apiKey', 'baseUrl', 'integrationId']);
    expect(result.rawSecretsReturned).toBe(false);
  });

  it('requires admin or CCO access', async () => {
    await expect(listIntegrationCredentials('specialist')).rejects.toThrow(/Admin or CCO/);
  });
});
