import { describe, expect, it } from 'vitest';
import { buildPostizChannelGuidance, buildPostizDiagnostics, toSafePostizChannel } from '../channel-contract';

describe('Postiz channel contract', () => {
  it('returns credential guidance before channel listing can run', () => {
    const guidance = buildPostizChannelGuidance({
      hasBaseUrl: false,
      hasApiKey: false,
      channelCount: 0,
    });

    expect(guidance.status).toBe('requires_credentials');
    expect(guidance.nextActions).toContain('Open Credentials and configure Postiz Sandbox API Key.');
  });

  it('returns explicit zero-channel guidance when Postiz has no visible integrations', () => {
    const guidance = buildPostizChannelGuidance({
      hasBaseUrl: true,
      hasApiKey: true,
      channelCount: 0,
    });

    expect(guidance.status).toBe('requires_channel');
    expect(guidance.message).toContain('no connected social channel');
    expect(guidance.nextActions).toContain('Return to Tanaghum and click Refresh Channels.');
  });

  it('requires selecting a channel after Postiz returns channels', () => {
    const guidance = buildPostizChannelGuidance({
      hasBaseUrl: true,
      hasApiKey: true,
      channelCount: 1,
    });

    expect(guidance.status).toBe('ready');
    expect(guidance.title).toBe('Postiz channels available');
    expect(guidance.nextActions[0]).toContain('Use for Scheduling');
  });

  it('maps Postiz channels without exposing tokens or raw secrets', () => {
    const channel = toSafePostizChannel({
      id: 'postiz-channel-1',
      name: 'Instagram Sandbox',
      providerIdentifier: 'instagram',
      type: 'instagram',
      profile: '@sandbox',
      accessToken: 'should-not-leak',
      customer: { id: 'customer-1', name: 'Demo Org' },
    });

    expect(channel).toMatchObject({
      id: 'postiz-channel-1',
      name: 'Instagram Sandbox',
      providerIdentifier: 'instagram',
      rawTokensReturned: false,
    });
    expect(JSON.stringify(channel)).not.toContain('should-not-leak');
  });

  it('reports OAuth-ready when Postiz validates the key but returns zero channels', () => {
    const diagnostics = buildPostizDiagnostics({
      hasBaseUrl: true,
      hasApiKey: true,
      apiConnected: true,
      channelCount: 0,
      selectedIntegrationId: null,
      oauthChecked: true,
      oauthUrlReady: true,
      platform: 'instagram',
      sandboxSchedulingAllowed: false,
    });

    expect(diagnostics.status).toBe('oauth_ready');
    expect(diagnostics.summary).toContain('no connected channel is visible');
    expect(diagnostics.nextActions).toContain('Complete the provider login and permission approval inside Postiz.');
    expect(diagnostics.checks.find(check => check.id === 'postiz_oauth_url')).toMatchObject({
      status: 'passed',
    });
    expect(diagnostics.checks.find(check => check.id === 'postiz_channel_count')).toMatchObject({
      status: 'blocked',
    });
  });

  it('reports provider setup when Postiz cannot create an OAuth URL', () => {
    const diagnostics = buildPostizDiagnostics({
      hasBaseUrl: true,
      hasApiKey: true,
      apiConnected: true,
      channelCount: 0,
      selectedIntegrationId: null,
      oauthChecked: true,
      oauthUrlReady: false,
      oauthFailureReason: 'Provider app credentials are not configured.',
      platform: 'instagram',
      sandboxSchedulingAllowed: false,
    });

    expect(diagnostics.status).toBe('requires_provider_setup');
    expect(diagnostics.summary).toContain('could not provide an OAuth URL');
    expect(diagnostics.checks.find(check => check.id === 'postiz_oauth_url')).toMatchObject({
      status: 'blocked',
      action: 'Verify provider app credentials in the Postiz deployment.',
    });
  });

  it('reports ready only when a connected channel is selected', () => {
    const diagnostics = buildPostizDiagnostics({
      hasBaseUrl: true,
      hasApiKey: true,
      apiConnected: true,
      channelCount: 1,
      selectedIntegrationId: 'postiz-channel-1',
      oauthChecked: true,
      oauthUrlReady: true,
      sandboxSchedulingAllowed: false,
    });

    expect(diagnostics.status).toBe('ready');
    expect(diagnostics.checks.find(check => check.id === 'postiz_selected_channel')).toMatchObject({
      status: 'passed',
    });
    expect(diagnostics.checks.find(check => check.id === 'postiz_sandbox_execution')).toMatchObject({
      status: 'blocked',
    });
  });
});
