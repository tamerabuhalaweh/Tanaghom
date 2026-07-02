import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1' }) },
  integrationCredential: { findFirst: vi.fn().mockResolvedValue(null) },
  connectorFieldMapping: { findFirst: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';
import { PROVIDER_IDS, PROVIDER_METADATA } from '../types';

describe('Connector Readiness', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all 8 providers', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    expect(result.providers).toHaveLength(PROVIDER_IDS.length);
  });

  it('reports missing when no credentials exist', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    for (const p of result.providers) expect(p.credentialState).toBe('missing');
    expect(result.missingCount).toBe(PROVIDER_IDS.length);
    expect(result.readyCount).toBe(0);
  });

  it('reports validated when credential exists and validated', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ id: 'm1' });
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    for (const p of result.providers) {
      expect(p.credentialState).toBe('validated');
      expect(p.nextAction).toBe('Ready for use');
    }
    expect(result.readyCount).toBe(PROVIDER_IDS.length);
  });

  it('reports blocked when mapping required but missing', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const mappingRequired = result.providers.filter(p => p.mappingRequired);
    for (const p of mappingRequired) expect(p.nextAction).toContain('field mapping');
  });

  it('write-back is blocked for all providers', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    for (const p of result.providers) {
      expect(p.writeBackStatus).toBe('blocked');
      expect(p.writeBackBlocker).toBeTruthy();
    }
  });

  it('no secrets in API response', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue({ id: 'c1', last_validated_at: new Date() });
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({ id: 'm1' });
    const result = await repo.getEventConnectorReadiness('tenant-a', 'event-1');
    const json = JSON.stringify(result);
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('accessToken');
    expect(json).not.toContain('botToken');
    expect(json).not.toContain('secret');
  });

  it('scopes to tenant', async () => {
    prismaMocks.integrationCredential.findFirst.mockResolvedValue(null);
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
      expect(meta.writeBackBlocker).toBeTruthy();
      expect(meta.missingCredentialAction).toBeTruthy();
    }
  });
});
