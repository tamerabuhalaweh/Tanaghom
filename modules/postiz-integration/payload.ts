export type PostizPostType = 'draft' | 'schedule';

export interface BuildPostizPayloadInput {
  platform: string;
  content: string;
  scheduledAt: string;
  integrationId?: string;
  tags?: string[];
  type?: PostizPostType;
}

const PLATFORM_ALIASES: Record<string, string> = {
  twitter: 'x',
  'x/twitter': 'x',
  instagram_fb: 'instagram',
  instagram_standalone: 'instagram-standalone',
  linkedin_page: 'linkedin-page',
};

export function normalizePostizPlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase().replace(/\s+/g, '-');
  return PLATFORM_ALIASES[normalized] || normalized;
}

export function buildPostizCreatePostPayload(input: BuildPostizPayloadInput) {
  const platform = normalizePostizPlatform(input.platform);
  return {
    type: input.type || 'schedule',
    date: input.scheduledAt,
    shortLink: false,
    tags: (input.tags || []).map((tag) => ({ value: tag })),
    posts: [
      {
        integration: {
          id: input.integrationId || '<select postiz channel>',
        },
        value: [
          {
            content: input.content,
            image: [],
          },
        ],
        settings: {
          __type: platform,
        },
      },
    ],
  };
}

export function summarizePostizPayload(input: BuildPostizPayloadInput) {
  const platform = normalizePostizPlatform(input.platform);
  return {
    platform,
    postType: input.type || 'schedule',
    scheduledAt: input.scheduledAt,
    hasIntegrationId: Boolean(input.integrationId),
    contentCharacters: input.content.length,
    tagCount: input.tags?.length || 0,
  };
}
