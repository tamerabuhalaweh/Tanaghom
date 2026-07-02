import { describe, expect, it } from 'vitest';
import { assessCredentialReadiness, deriveValidationSummary } from '../policy';

describe('SmartLabs voice validation', () => {
  it('reports not_ready when credentials are missing', () => {
    const credential = assessCredentialReadiness({
      configured: false,
      source: 'missing',
      apiKey: '',
      baseUrl: '',
      agentId: '',
      voiceId: '',
      ttsBackend: '',
    });

    expect(credential.state).toBe('not_ready');
    expect(credential.configured).toBe(false);
    expect(credential.source).toBe('missing');
    expect(credential.fields.apiKey).toBe('not_ready');
    expect(credential.fields.agentId).toBe('not_ready');
  });

  it('reports ready when credentials are fully configured', () => {
    const credential = assessCredentialReadiness({
      configured: true,
      source: 'tenant_vault',
      apiKey: 'tenant-owned-api-key-placeholder',
      baseUrl: 'https://api.thesmartlabs.net',
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    expect(credential.state).toBe('ready');
    expect(credential.configured).toBe(true);
    expect(credential.source).toBe('tenant_vault');
    expect(credential.fields.apiKey).toBe('ready');
    expect(credential.fields.agentId).toBe('ready');
    expect(credential.fields.voiceId).toBe('ready');
  });

  it('reports degraded for fields with defaults but no explicit value', () => {
    const credential = assessCredentialReadiness({
      configured: true,
      source: 'tenant_vault',
      apiKey: 'tenant-owned-api-key-placeholder',
      baseUrl: '',
      agentId: 'agent-123',
      voiceId: '',
      ttsBackend: '',
    });

    expect(credential.state).toBe('ready');
    expect(credential.fields.baseUrl).toBe('degraded');
    expect(credential.fields.voiceId).toBe('degraded');
    expect(credential.fields.ttsBackend).toBe('degraded');
  });

  it('derives correct validation summary with blockers', () => {
    const credential = assessCredentialReadiness({
      configured: false,
      source: 'missing',
      apiKey: '',
      baseUrl: '',
      agentId: '',
      voiceId: '',
      ttsBackend: '',
    });

    const summary = deriveValidationSummary({
      tenantKey: 'customer-a',
      credential,
      agentId: '',
      voiceId: '',
      ttsBackend: '',
    });

    expect(summary.tenantKey).toBe('customer-a');
    expect(summary.apiReady).toBe('not_ready');
    expect(summary.agentIdReady).toBe('not_ready');
    expect(summary.voiceReady).toBe('not_ready');
    expect(summary.ttsReady).toBe('not_ready');
    expect(summary.blockers.length).toBeGreaterThan(0);
    expect(summary.blockers).toContain('SmartLabs tenant credentials are not configured');
    expect(summary.blockers).toContain('SmartLabs API key is missing');
    expect(summary.blockers).toContain('SmartLabs agentId is missing');
  });

  it('derives ready summary when all credentials are configured', () => {
    const credential = assessCredentialReadiness({
      configured: true,
      source: 'tenant_vault',
      apiKey: 'tenant-owned-api-key-placeholder',
      baseUrl: 'https://api.thesmartlabs.net',
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    const summary = deriveValidationSummary({
      tenantKey: 'customer-b',
      credential,
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    expect(summary.apiReady).toBe('ready');
    expect(summary.agentIdReady).toBe('ready');
    expect(summary.voiceReady).toBe('ready');
    expect(summary.ttsReady).toBe('ready');
    expect(summary.blockers).toHaveLength(0);
  });

  it('never exposes raw secrets in the summary', () => {
    const credential = assessCredentialReadiness({
      configured: true,
      source: 'tenant_vault',
      apiKey: 'tenant-secret-placeholder',
      baseUrl: 'https://api.thesmartlabs.net',
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    const summary = deriveValidationSummary({
      tenantKey: 'customer-c',
      credential,
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('tenant-secret-placeholder');
    expect(summary.safety.rawSecretsReturned).toBe(false);
  });

  it('marks safety fields correctly', () => {
    const credential = assessCredentialReadiness({
      configured: true,
      source: 'tenant_vault',
      apiKey: 'tenant-owned-api-key-placeholder',
      baseUrl: 'https://api.thesmartlabs.net',
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    const summary = deriveValidationSummary({
      tenantKey: 'customer-d',
      credential,
      agentId: 'agent-123',
      voiceId: 'smarttts2-xms-default',
      ttsBackend: 'omnivoice',
    });

    expect(summary.safety.rawSecretsReturned).toBe(false);
    expect(summary.safety.executionPolicyGated).toBe(true);
    expect(summary.safety.customerOwnedCredentialRequired).toBe(true);
  });
});
