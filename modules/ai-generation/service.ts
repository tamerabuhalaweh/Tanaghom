import { ForbiddenError, NotFoundError, ExternalServiceError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { prisma } from '@shared/database';
import type { LLMProvider } from '@shared/providers/llm-provider';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import {
  DRAFT_EVENTS,
  type DraftGeneratedEvent,
  type DraftRevisedEvent,
  type DraftGenerationFailedEvent,
} from './events';
import * as repo from './repository';
import type {
  GenerateDraftInput,
  ReviseDraftInput,
  DraftResult,
  DraftMetadata,
  Platform,
  Tone,
  DraftContentType,
} from './types';
import { PLATFORM_CONSTRAINTS } from './types';

// ============================================================
// Permission Map
// ============================================================

const PERMISSIONS: Record<string, string[]> = {
  admin: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  cco: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  department_head: ['drafts:generate', 'drafts:revise', 'drafts:read'],
  specialist: ['drafts:generate', 'drafts:read'],
  reviewer: ['drafts:read'],
  viewer: ['drafts:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

// ============================================================
// LLM Provider (uses provider adapter, mock by default)
// ============================================================

async function getLLMProvider(userId: string): Promise<LLMProvider> {
  return resolveUserLLMProvider(userId);
}

// ============================================================
// Brand Voice (from SOUL.md)
// ============================================================

const BRAND_VOICE = {
  tone: 'Professional but approachable — not clinical or cold',
  do: [
    'Use clear, simple language to explain health concepts',
    'Highlight convenience, accuracy, and speed of results',
    'Share educational content about preventive health',
    'Include clear calls-to-action',
    'Adapt tone to platform',
  ],
  dont: [
    'Make medical claims without evidence or disclaimers',
    'Use fear-based health messaging',
    'Use excessive emojis or informal slang on professional platforms',
    'Make competitor comparisons without verified data',
    'Promise specific health outcomes',
  ],
  preferredVocabulary: ['wellness', 'diagnostics', 'proactive health', 'insights', 'accuracy', 'convenience', 'results', 'prevention', 'screening', 'innovation'],
  avoidVocabulary: ['cure', 'treatment', 'diagnosis', 'guaranteed', 'miracle', 'secret', 'hack'],
};

// ============================================================
// Draft Generation Service
// ============================================================

export async function generateDrafts(
  requesterRole: string,
  requesterId: string,
  input: GenerateDraftInput,
): Promise<DraftResult[]> {
  checkPermission(requesterRole, 'drafts:generate');

  const campaign = await prisma.contentRequest.findUnique({
    where: { id: input.campaignRequestId },
  });
  if (!campaign) throw new NotFoundError('Campaign request', input.campaignRequestId);

  const platforms = input.platforms || (campaign.target_platforms as Platform[]);
  const tone = input.tone || 'professional';
  const results: DraftResult[] = [];

  for (const platform of platforms) {
    try {
      const result = await generateSingleDraft(
        requesterId,
        campaign,
        platform,
        tone,
      );
      results.push(result);

      auditLog(
        {
          actor: `user:${requesterId}`,
          action: 'draft_generated',
          object_type: 'content_item',
          object_id: result.contentItemId,
          result: 'success',
        },
        `Draft generated for ${platform}`,
      );

      const event: DraftGeneratedEvent = {
        contentItemId: result.contentItemId,
        campaignRequestId: input.campaignRequestId,
        platform,
        versionNo: result.versionNo,
        timestamp: new Date(),
      };
      await eventBus.emit(DRAFT_EVENTS.DRAFT_GENERATED, event);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      auditLog(
        {
          actor: `user:${requesterId}`,
          action: 'draft_generation_failed',
          object_type: 'content_request',
          object_id: input.campaignRequestId,
          result: 'failure',
        },
        `Draft generation failed for ${platform}: ${errorMsg}`,
      );

      const event: DraftGenerationFailedEvent = {
        campaignRequestId: input.campaignRequestId,
        platform,
        error: errorMsg,
        timestamp: new Date(),
      };
      await eventBus.emit(DRAFT_EVENTS.DRAFT_GENERATION_FAILED, event);
    }
  }

  return results;
}

export async function reviseDraft(
  requesterRole: string,
  requesterId: string,
  input: ReviseDraftInput,
): Promise<DraftResult> {
  checkPermission(requesterRole, 'drafts:revise');

  const item = await repo.getContentItem(input.contentItemId);
  if (!item.request) throw new NotFoundError('Campaign request for content item');

  const latestVersion = await repo.getLatestVersion(input.contentItemId);
  const newVersionNo = (latestVersion?.version_no || 0) + 1;
  const tone = input.tone || 'professional';

  const constraints = PLATFORM_CONSTRAINTS[item.platform as Platform] || PLATFORM_CONSTRAINTS.linkedin;
  const prompt = buildRevisionPrompt(
    item.draft_text,
    input.feedback,
    item.request.objective,
    constraints.maxTextLength,
    tone,
  );

  const llm = await getLLMProvider(requesterId);
  let revisedText: string;
  try {
    revisedText = (await llm.generate(prompt)).text;
  } catch (err) {
    throw new ExternalServiceError('LLM', err instanceof Error ? err.message : 'Generation failed');
  }

  await repo.createDraftVersion(
    input.contentItemId,
    newVersionNo,
    revisedText,
    'mock-llm',
  );

  await repo.updateContentItemDraft(input.contentItemId, revisedText);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'draft_revised',
      object_type: 'content_item',
      object_id: input.contentItemId,
      result: 'success',
    },
    `Draft revised to version ${newVersionNo}`,
  );

  const event: DraftRevisedEvent = {
    contentItemId: input.contentItemId,
    versionNo: newVersionNo,
    feedback: input.feedback,
    timestamp: new Date(),
  };
  await eventBus.emit(DRAFT_EVENTS.DRAFT_REVISED, event);

  return {
    contentItemId: input.contentItemId,
    platform: item.platform as Platform,
    contentType: item.content_type as DraftContentType,
    draftText: revisedText,
    versionNo: newVersionNo,
    metadata: {
      objective: item.request.objective,
      audience: item.request.audience || '',
      cta: item.request.cta,
      hashtags: [],
      rationale: `Revised based on feedback: ${input.feedback.substring(0, 100)}`,
      tone,
      hookType: 'revision',
      mediaSuggestions: [],
    },
    riskNotes: item.risk_reason || '',
    createdAt: new Date(),
  };
}

// ============================================================
// Internal Helpers
// ============================================================

interface CampaignData {
  id: string;
  raw_message: string;
  objective: string;
  audience: string | null;
  cta: string | null;
  content_type: string;
  risk_category: string;
  target_platforms: string[];
}

async function generateSingleDraft(
  requesterId: string,
  campaign: CampaignData,
  platform: Platform,
  tone: Tone,
): Promise<DraftResult> {
  const constraints = PLATFORM_CONSTRAINTS[platform] || PLATFORM_CONSTRAINTS.linkedin;
  const prompt = buildGenerationPrompt(campaign, platform, constraints.maxTextLength, tone);

  const llm = await getLLMProvider(requesterId);
  let draftText: string;
  try {
    draftText = (await llm.generate(prompt)).text;
  } catch (err) {
    throw new ExternalServiceError('LLM', err instanceof Error ? err.message : 'Generation failed');
  }

  const metadata = buildMetadata(campaign, platform, tone);
  const riskNotes = assessRisk(campaign);

  const result = await repo.createContentItem(
    campaign.id,
    platform,
    constraints.recommendedFormat,
    draftText,
    metadata,
    riskNotes,
  );

  await repo.createDraftVersion(
    result.contentItemId,
    1,
    draftText,
    'mock-llm',
  );

  return result;
}

function buildGenerationPrompt(campaign: CampaignData, platform: Platform, maxLength: number, tone: Tone): string {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  return `You are a social media content writer for SmartLabs, a health-tech company.

BRAND VOICE: ${BRAND_VOICE.tone}
DO: ${BRAND_VOICE.do.join(', ')}
DON'T: ${BRAND_VOICE.dont.join(', ')}

PLATFORM: ${platform}
MAX LENGTH: ${maxLength} characters
FORMAT: ${constraints.recommendedFormat}
HOOK REQUIRED: ${constraints.hookRequired}
PLATFORM NOTES: ${constraints.notes}

CAMPAIGN:
- Topic: ${campaign.raw_message}
- Objective: ${campaign.objective}
- Audience: ${campaign.audience || 'General health-conscious audience'}
- CTA: ${campaign.cta || 'No specific CTA'}
- Content Type: ${campaign.content_type}
- Risk Category: ${campaign.risk_category}

TONE: ${tone}

Generate a platform-native draft that:
1. Follows brand voice
2. Respects platform rules and character limits
3. Includes a clear hook, body, and CTA
4. Is optimized for the platform's algorithm
5. Avoids restricted claims and sensitive topics

Output the draft text only.`;
}

function buildRevisionPrompt(
  originalDraft: string,
  feedback: string,
  objective: string,
  maxLength: number,
  tone: Tone,
): string {
  return `You are revising a social media draft for SmartLabs.

ORIGINAL DRAFT:
${originalDraft}

FEEDBACK: ${feedback}
OBJECTIVE: ${objective}
MAX LENGTH: ${maxLength} characters
TONE: ${tone}
BRAND VOICE: ${BRAND_VOICE.tone}

Revise the draft based on the feedback while maintaining brand voice and platform rules.
Output the revised draft text only.`;
}

function buildMetadata(campaign: CampaignData, platform: Platform, tone: Tone): DraftMetadata {
  return {
    objective: campaign.objective,
    audience: campaign.audience || 'General health-conscious audience',
    cta: campaign.cta || null,
    hashtags: generateHashtags(platform, campaign.content_type),
    rationale: `Platform-native ${PLATFORM_CONSTRAINTS[platform].recommendedFormat} for ${platform}, targeting ${campaign.audience || 'general audience'} with ${tone} tone.`,
    tone,
    hookType: PLATFORM_CONSTRAINTS[platform].hookRequired ? 'question' : 'statement',
    mediaSuggestions: generateMediaSuggestions(platform, PLATFORM_CONSTRAINTS[platform].recommendedFormat),
  };
}

function generateHashtags(platform: Platform, _contentType: string): string[] {
  const base = ['#SmartLabs', '#HealthTech', '#Wellness'];
  const platformSpecific: Record<Platform, string[]> = {
    linkedin: ['#Healthcare', '#Diagnostics', '#B2B'],
    instagram: ['#HealthTips', '#Prevention', '#Screening'],
    x: ['#Health'],
    facebook: ['#Community', '#LocalHealth'],
    tiktok: ['#HealthTok', '#WellnessCheck'],
    youtube: ['#HealthEducation', '#MedicalScience'],
    reddit: [],
  };
  const max = PLATFORM_CONSTRAINTS[platform].maxHashtags;
  return [...base, ...(platformSpecific[platform] || [])].slice(0, max);
}

function generateMediaSuggestions(platform: Platform, format: string): string[] {
  if (format === 'reel' || format === 'video') return ['Short-form video with text overlay', 'First 3 seconds: bold hook statement'];
  if (format === 'carousel') return ['5-slide carousel with problem → solution structure', 'First slide: bold question or stat'];
  return ['Native image with brand colors', 'Text overlay with key stat or CTA'];
}

function assessRisk(campaign: CampaignData): string {
  const risks: string[] = [];
  if (campaign.risk_category === 'high') risks.push('High-risk content — requires compliance review');
  if (campaign.content_type === 'announcement') risks.push('Announcement — verify claims before publishing');
  if (!campaign.cta) risks.push('No CTA defined — may reduce engagement');
  return risks.length > 0 ? risks.join('; ') : 'Low risk — standard content';
}
