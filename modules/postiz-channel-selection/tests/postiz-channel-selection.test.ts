import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import {
  checkChannelSelectionPermission,
  evaluateChannelReadiness,
  assertReadyForScheduling,
} from '../policy';
import { buildChannelTag, parseChannelTag } from '../repository';
import type { ChannelReadiness } from '../types';

describe('Postiz Channel Selection Permissions', () => {
  describe('admin', () => {
    it('can read', () => expect(() => checkChannelSelectionPermission('admin', 'channel_selection:read')).not.toThrow());
    it('can select', () => expect(() => checkChannelSelectionPermission('admin', 'channel_selection:select')).not.toThrow());
    it('can deselect', () => expect(() => checkChannelSelectionPermission('admin', 'channel_selection:deselect')).not.toThrow());
  });

  describe('department_head', () => {
    it('can read', () => expect(() => checkChannelSelectionPermission('department_head', 'channel_selection:read')).not.toThrow());
    it('can select', () => expect(() => checkChannelSelectionPermission('department_head', 'channel_selection:select')).not.toThrow());
    it('can deselect', () => expect(() => checkChannelSelectionPermission('department_head', 'channel_selection:deselect')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkChannelSelectionPermission('specialist', 'channel_selection:read')).not.toThrow());
    it('cannot select', () => expect(() => checkChannelSelectionPermission('specialist', 'channel_selection:select')).toThrow(ForbiddenError));
    it('cannot deselect', () => expect(() => checkChannelSelectionPermission('specialist', 'channel_selection:deselect')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkChannelSelectionPermission('viewer', 'channel_selection:read')).not.toThrow());
    it('cannot select', () => expect(() => checkChannelSelectionPermission('viewer', 'channel_selection:select')).toThrow(ForbiddenError));
  });

  describe('unknown role', () => {
    it('throws ForbiddenError', () => expect(() => checkChannelSelectionPermission('unknown', 'channel_selection:read')).toThrow(ForbiddenError));
  });
});

describe('Channel Readiness Evaluation', () => {
  it('returns ready when all checks pass', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'instagram',
      channelDisplayName: 'Test IG',
      integrationChannelId: 'ig-123',
    });
    expect(readiness.state).toBe('ready');
    expect(readiness.checks.every(c => c.status === 'passed')).toBe(true);
  });

  it('returns no_connector_binding when connector missing', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: false,
      connectorStatus: null,
      channelExists: false,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: null,
      channelDisplayName: null,
      integrationChannelId: null,
    });
    expect(readiness.state).toBe('no_connector_binding');
    expect(readiness.checks.find(c => c.id === 'connector_binding')?.status).toBe('blocked');
  });

  it('returns connector_inactive when connector not active', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'suspended',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'linkedin',
      channelDisplayName: null,
      integrationChannelId: 'li-456',
    });
    expect(readiness.state).toBe('connector_inactive');
    expect(readiness.checks.find(c => c.id === 'connector_status')?.status).toBe('blocked');
  });

  it('returns channel_not_found when channel missing', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: false,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: null,
      channelDisplayName: null,
      integrationChannelId: null,
    });
    expect(readiness.state).toBe('channel_not_found');
    expect(readiness.checks.find(c => c.id === 'channel_exists')?.status).toBe('blocked');
  });

  it('returns channel_disabled when channel is disabled', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: true,
      channelRefreshNeeded: false,
      platform: 'x',
      channelDisplayName: null,
      integrationChannelId: 'x-789',
    });
    expect(readiness.state).toBe('channel_disabled');
    expect(readiness.checks.find(c => c.id === 'channel_disabled')?.status).toBe('blocked');
  });

  it('returns channel_refresh_needed when token stale', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: true,
      platform: 'facebook',
      channelDisplayName: null,
      integrationChannelId: 'fb-101',
    });
    expect(readiness.state).toBe('channel_refresh_needed');
    expect(readiness.checks.find(c => c.id === 'channel_refresh')?.status).toBe('warning');
  });
});

describe('Assert Ready for Scheduling', () => {
  it('does not throw when ready', () => {
    const readiness: ChannelReadiness = {
      state: 'ready',
      connectorId: 'c1',
      connectorStatus: 'active',
      integrationChannelId: 'ch1',
      platform: 'instagram',
      channelDisplayName: 'IG',
      channelDisabled: false,
      channelRefreshNeeded: false,
      checks: [],
    };
    expect(() => assertReadyForScheduling(readiness)).not.toThrow();
  });

  it('throws ForbiddenError when not ready', () => {
    const readiness: ChannelReadiness = {
      state: 'channel_not_found',
      connectorId: null,
      connectorStatus: null,
      integrationChannelId: null,
      platform: null,
      channelDisplayName: null,
      channelDisabled: false,
      channelRefreshNeeded: false,
      checks: [],
    };
    expect(() => assertReadyForScheduling(readiness)).toThrow(ForbiddenError);
  });

  it('throws for each blocked state', () => {
    const blockedStates = [
      'missing_credentials',
      'no_channels_available',
      'channel_not_found',
      'channel_disabled',
      'connector_inactive',
      'no_connector_binding',
    ] as const;
    for (const state of blockedStates) {
      const readiness: ChannelReadiness = {
        state,
        connectorId: null,
        connectorStatus: null,
        integrationChannelId: null,
        platform: null,
        channelDisplayName: null,
        channelDisabled: false,
        channelRefreshNeeded: false,
        checks: [],
      };
      expect(() => assertReadyForScheduling(readiness)).toThrow(ForbiddenError);
    }
  });
});

describe('Channel Tag Build/Parse', () => {
  it('builds a channel tag from platform and id', () => {
    expect(buildChannelTag('instagram', 'ig-123')).toBe('postiz:instagram:ig-123');
  });

  it('encodes separators in channel ids so tags remain parseable', () => {
    const tag = buildChannelTag('instagram', 'ig:business:123');
    expect(tag).toBe('postiz:instagram:ig%3Abusiness%3A123');
    expect(parseChannelTag(tag)).toEqual({ platform: 'instagram', integrationChannelId: 'ig:business:123' });
  });

  it('parses a valid channel tag', () => {
    const result = parseChannelTag('postiz:linkedin:li-456');
    expect(result).toEqual({ platform: 'linkedin', integrationChannelId: 'li-456' });
  });

  it('returns null for invalid tag format', () => {
    expect(parseChannelTag('invalid')).toBeNull();
    expect(parseChannelTag('not:postiz:tag')).toBeNull();
    expect(parseChannelTag('postiz:only-two')).toBeNull();
  });

  it('roundtrips build → parse', () => {
    const tag = buildChannelTag('x', 'x-channel-99');
    const parsed = parseChannelTag(tag);
    expect(parsed).toEqual({ platform: 'x', integrationChannelId: 'x-channel-99' });
  });
});

describe('No Raw Secrets in Channel Selection', () => {
  it('channel tag contains no secrets', () => {
    const tag = buildChannelTag('instagram', 'ig-123');
    expect(tag).not.toContain('token');
    expect(tag).not.toContain('secret');
    expect(tag).not.toContain('api_key');
    expect(tag).not.toContain('password');
  });

  it('readiness output contains no secrets', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'instagram',
      channelDisplayName: 'Test IG',
      integrationChannelId: 'ig-123',
    });
    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toMatch(/secret[:=]/i);
    expect(serialized).not.toMatch(/credential[:=]/i);
    expect(readiness.checks.every(c => !c.detail.includes('sk-') && !c.detail.includes('Bearer'))).toBe(true);
  });
});

describe('Tenant/Event Scoping', () => {
  it('evaluateChannelReadiness produces tenant-neutral output', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'linkedin',
      channelDisplayName: 'LI Page',
      integrationChannelId: 'li-789',
    });
    expect(readiness.state).toBe('ready');
    expect(readiness.checks.length).toBeGreaterThan(0);
  });

  it('readiness checks are deterministic', () => {
    const input = {
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'x',
      channelDisplayName: null,
      integrationChannelId: 'x-1',
    };
    const r1 = evaluateChannelReadiness(input);
    const r2 = evaluateChannelReadiness(input);
    expect(r1.state).toBe(r2.state);
    expect(r1.checks).toEqual(r2.checks);
  });
});

describe('Missing Channel State', () => {
  it('returns channel_not_found when no channel selected', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: false,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: null,
      channelDisplayName: null,
      integrationChannelId: null,
    });
    expect(readiness.state).toBe('channel_not_found');
    expect(readiness.checks.find(c => c.id === 'channel_exists')?.detail).toContain('not found');
  });
});

describe('Selected Channel State', () => {
  it('returns ready with correct channel metadata', () => {
    const readiness = evaluateChannelReadiness({
      connectorExists: true,
      connectorStatus: 'active',
      channelExists: true,
      channelDisabled: false,
      channelRefreshNeeded: false,
      platform: 'instagram',
      channelDisplayName: 'My Business IG',
      integrationChannelId: 'ig-business-001',
    });
    expect(readiness.state).toBe('ready');
    expect(readiness.platform).toBe('instagram');
    expect(readiness.channelDisplayName).toBe('My Business IG');
    expect(readiness.integrationChannelId).toBe('ig-business-001');
    expect(readiness.channelDisabled).toBe(false);
    expect(readiness.channelRefreshNeeded).toBe(false);
  });
});
