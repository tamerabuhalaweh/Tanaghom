import { describe, expect, it } from 'vitest';
import { buildPostizCreatePostPayload, normalizePostizPlatform, summarizePostizPayload } from '../payload';

describe('Postiz payload builder', () => {
  it('normalizes common platform aliases to Postiz provider types', () => {
    expect(normalizePostizPlatform('twitter')).toBe('x');
    expect(normalizePostizPlatform('X/Twitter')).toBe('x');
    expect(normalizePostizPlatform('Instagram Standalone')).toBe('instagram-standalone');
    expect(normalizePostizPlatform('LinkedIn Page')).toBe('linkedin-page');
  });

  it('builds the public API create-post payload without secrets', () => {
    const payload = buildPostizCreatePostPayload({
      platform: 'linkedin',
      content: 'Approved launch copy',
      scheduledAt: '2026-06-28T10:00:00.000Z',
      integrationId: 'postiz-channel-1',
      tags: ['launch'],
    });

    expect(payload).toMatchObject({
      type: 'schedule',
      date: '2026-06-28T10:00:00.000Z',
      shortLink: false,
      tags: [{ value: 'launch' }],
      posts: [
        {
          integration: { id: 'postiz-channel-1' },
          value: [{ content: 'Approved launch copy', image: [] }],
          settings: { __type: 'linkedin' },
        },
      ],
    });
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('token');
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('secret');
  });

  it('uses a safe placeholder when no channel is selected', () => {
    const payload = buildPostizCreatePostPayload({
      platform: 'instagram',
      content: 'Approved Instagram copy',
      scheduledAt: '2026-06-28T10:00:00.000Z',
    });

    expect(payload.posts[0].integration.id).toBe('<select postiz channel>');
  });

  it('summarizes payload readiness without returning content', () => {
    const summary = summarizePostizPayload({
      platform: 'instagram',
      content: 'A'.repeat(42),
      scheduledAt: '2026-06-28T10:00:00.000Z',
      integrationId: 'postiz-channel-1',
      tags: ['launch', 'social'],
    });

    expect(summary).toEqual({
      platform: 'instagram',
      postType: 'schedule',
      scheduledAt: '2026-06-28T10:00:00.000Z',
      hasIntegrationId: true,
      contentCharacters: 42,
      tagCount: 2,
    });
  });
});
