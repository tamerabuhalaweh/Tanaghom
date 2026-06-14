import { z } from 'zod';

// ============================================================
// Draft Generation Types
// ============================================================

export const PLATFORMS = ['linkedin', 'instagram', 'x', 'facebook', 'tiktok', 'youtube', 'reddit'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DRAFT_CONTENT_TYPES = ['post', 'carousel', 'reel', 'story', 'thread', 'video'] as const;
export type DraftContentType = (typeof DRAFT_CONTENT_TYPES)[number];

export const TONE_OPTIONS = ['professional', 'casual', 'educational', 'inspirational', 'urgent', 'conversational'] as const;
export type Tone = (typeof TONE_OPTIONS)[number];

// ============================================================
// Schemas
// ============================================================

export const generateDraftSchema = z.object({
  campaignRequestId: z.string().uuid('Invalid campaign request ID'),
  platforms: z.array(z.enum(PLATFORMS)).min(1, 'At least one platform required').optional(),
  tone: z.enum(TONE_OPTIONS).optional(),
});

export const reviseDraftSchema = z.object({
  contentItemId: z.string().uuid('Invalid content item ID'),
  feedback: z.string().min(1, 'Feedback is required').max(2000),
  tone: z.enum(TONE_OPTIONS).optional(),
});

export type GenerateDraftInput = z.infer<typeof generateDraftSchema>;
export type ReviseDraftInput = z.infer<typeof reviseDraftSchema>;

// ============================================================
// Response Types
// ============================================================

export interface DraftResult {
  contentItemId: string;
  platform: Platform;
  contentType: DraftContentType;
  draftText: string;
  versionNo: number;
  metadata: DraftMetadata;
  riskNotes: string;
  createdAt: Date;
}

export interface DraftMetadata {
  objective: string;
  audience: string;
  cta: string | null;
  hashtags: string[];
  rationale: string;
  tone: Tone;
  hookType: string;
  mediaSuggestions: string[];
}

export interface DraftVersionResult {
  id: string;
  contentItemId: string;
  versionNo: string;
  text: string;
  modelUsed: string | null;
  createdAt: Date;
}

// ============================================================
// Platform Rules (from PLATFORM_RULES.md)
// ============================================================

export interface PlatformConstraints {
  platform: Platform;
  maxTextLength: number;
  maxHashtags: number;
  recommendedFormat: DraftContentType;
  hookRequired: boolean;
  notes: string;
}

export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraints> = {
  linkedin: {
    platform: 'linkedin',
    maxTextLength: 1300,
    maxHashtags: 5,
    recommendedFormat: 'post',
    hookRequired: true,
    notes: 'Professional tone, document/carousel handling, B2B CTA style',
  },
  instagram: {
    platform: 'instagram',
    maxTextLength: 2200,
    maxHashtags: 5,
    recommendedFormat: 'reel',
    hookRequired: true,
    notes: 'Visual-first, Reels prioritized, clear first-3-second hook',
  },
  x: {
    platform: 'x',
    maxTextLength: 280,
    maxHashtags: 2,
    recommendedFormat: 'post',
    hookRequired: true,
    notes: 'Short-form hook, thread option, link in reply preferred',
  },
  facebook: {
    platform: 'facebook',
    maxTextLength: 5000,
    maxHashtags: 3,
    recommendedFormat: 'post',
    hookRequired: false,
    notes: 'Community-focused, local relevance, accessible language',
  },
  tiktok: {
    platform: 'tiktok',
    maxTextLength: 300,
    maxHashtags: 5,
    recommendedFormat: 'reel',
    hookRequired: true,
    notes: 'Video-first, trending sounds, authentic content',
  },
  youtube: {
    platform: 'youtube',
    maxTextLength: 5000,
    maxHashtags: 15,
    recommendedFormat: 'video',
    hookRequired: true,
    notes: 'Title optimization, description depth, thumbnail importance',
  },
  reddit: {
    platform: 'reddit',
    maxTextLength: 10000,
    maxHashtags: 0,
    recommendedFormat: 'post',
    hookRequired: false,
    notes: 'Subreddit-specific rules, community tone, no self-promotion spam',
  },
};
