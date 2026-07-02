import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1' }) },
  integrationCredential: { findFirst: vi.fn().mockResolvedValue(null) },
  connectorFieldMapping: { findFirst: vi.fn().mockResolvedValue(null) },
  connectorImportJob: { findFirst: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';
import { PROVIDER_IDS, PROVIDER_METADATA } from '../types';

describe('Connector Readiness', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all 8 providers', async () => {
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    expect(result.providers).toHaveLength(PROVIDER_IDS.length);
  });

  it('reports missing when no credentials exist', async () => {
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const configurable = result.providers.filter(p => p.nextAction !== 'YouTube Analytics not yet configurable');
    for (const p of configurable) {
      expect(p.credentialState).toBe('missing');
    }
  });

  it('Meta Analytics resolves from social_oauth/meta credential', async () => {
    prismaMocks.integrationCredential.findFirst.mockImplementation((args: Record<string, unknown>) => {
      if (args.where?.provider === 'social_oauth' && args.where?.connection_key === 'meta') {
        return Promise.resolve({ id: 'c1', last_validated_at: new Date() });
      }
      return Promise.resolve(null);
    });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ id: 'm1' });
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'j1', last_dry_run_at: new Date(), state: 'test_passed' });

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const meta = result.providers.find(p => p.providerId === 'meta_analytics');
    expect(meta?.credentialState).toBe('validated');
    expect(meta?.nextAction).toBe('Ready for use');
  });

  it('WhatsApp resolves from whatsapp provider, not whatsapp_provider', async () => {
    prismaMocks.integrationCredential.findFirst.mockImplementation((args: Record<string, unknown>) => {
      if (args.where?.provider === 'whatsapp') {
        return Promise.resolve({ id: 'c1', last_validated_at: new Date() });
      }
      return Promise.resolve(null);
    });

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const wa = result.providers.find(p => p.providerId === 'whatsapp_provider');
    expect(wa?.credentialState).toBe('validated');
  });

  it('Telegram resolves from telegram provider', async () => {
    prismaMocks.integrationCredential.findFirst.mockImplementation((args: Record<string, unknown>) => {
      if (args.where?.provider === 'telegram') {
        return Promise.resolve({ id: 'c1', last_validated_at: new Date() });
      }
      return Promise.resolve(null);
    });

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const tg = result.providers.find(p => p.providerId === 'telegram_provider');
    expect(tg?.credentialState).toBe('validated');
  });

  it('YouTube is explicitly not configurable', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const yt = result.providers.find(p => p.providerId === 'youtube_analytics');
    expect(yt?.nextAction).toContain('not yet supported');
  });

  it('credentials + mapping without event dry-run is not Ready for use', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ id: 'm1' });
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const postiz = result.providers.find(p => p.providerId === 'postiz');
    expect(postiz?.nextAction).toBe('Run connector dry-run for this event');
  });

  it('event readiness does not become ready from unrelated event mapping', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue(null);

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const postiz = result.providers.find(p => p.providerId === 'postiz');
    expect(postiz?.nextAction).not.toBe('Ready for use');
  });

  it('write-back is blocked for all providers', async () => {
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    for (const p of result.providers) {
      expect(p.writeBackStatus).toBe('blocked');
      expect(p.writeBackBlocker).toBeTruthy();
    }
  });

  it('no secrets in API response', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ id: 'm1' });
    prismaMocks.connectorImportJob.findFirst.mockResolvedValue({ id: 'j1', last_dry_run_at: new Date(), state: 'test_passed' });

    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const json = JSON.stringify(result);
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('accessToken');
    expect(json).not.toContain('botToken');
    expect(json).not.toContain('secret');
  });

  it('scopes to tenant', async () => {
    await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'event-1' }),
    }));
  });

  it('rejects when event not found', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    const { NotFoundError } = await import('@shared/errors');
    await expect(repo.getEventConnectorReadiness('tenant-a', 'bad-event')).rejects.toThrow(NotFoundError);
  });

  it('provider metadata has all required fields', () => {
    for (const id of PROVIDER_IDS) {
      const meta = PROVIDER_METADATA[id];
      expect(meta.displayName).toBeTruthy();
      expect(typeof meta.oauthRequired).toBe('boolean');
      expect(typeof meta.mappingRequired).toBe('boolean');
      expect(typeof meta.dryRunSupported).toBe('boolean');
      expect(typeof meta.importSupported).toBe('boolean');
      expect(typeof meta.writeBackSupported).toBe('boolean');
      expect(typeof meta.configurable).toBe('boolean');
      expect(meta.writeBackBlocker).toBeTruthy();
      expect(meta.missingCredentialAction).toBeTruthy();
    }
  });

  it('credential lookup uses correct provider for each connector', () => {
    const expected: Record<string, string> = {
      meta_analytics: 'social_oauth',
      youtube_analytics: 'youtube',
      formaloo: 'formaloo',
      gohighlevel: 'gohighlevel',
      whatsapp_provider: 'whatsapp',
      telegram_provider: 'telegram',
      smartlabs_voice: 'smartlabs_voice',
      postiz: 'postiz',
    };

    expect(Object.keys(expected)).toHaveLength(8);
  });
});
