import { describe, expect, it } from 'vitest';
import { buildPostizChannelGuidance, toSafePostizChannel } from '../channel-contract';

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
});
