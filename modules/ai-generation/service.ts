import { AppError, ForbiddenError, NotFoundError, ExternalServiceError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { prisma } from '@shared/database';
import type { LLMProvider } from '@shared/providers/llm-provider';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import { recordCommercialWorkflowAudit } from '@modules/commercial-workflow/evidence';
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
  SaveEditedDraftInput,
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
// Customer Content Profile
// ============================================================

const COURSE_CREATOR_PROFILE = {
  audienceFallback: 'Course buyers, coaching prospects, founders, and professionals seeking practical personal growth',
  tone: 'Confident, warm, practical, transformation-focused, and culturally aware for GCC/Jordan audiences',
  do: [
    'Open with a concrete pain point, outcome, or personal-brand lesson',
    'Connect the idea to a course, coaching program, live session, lead magnet, or discovery conversation',
    'Give useful advice before asking for action',
    'Use proof-led language without inventing testimonials, numbers, or guarantees',
    'Make the next step obvious: join waitlist, comment keyword, request details, book a call, or register',
    'Match the language of the campaign brief; use Arabic, English, or bilingual phrasing only when the brief suggests it',
    'Adapt format to each platform: LinkedIn authority, Instagram hook and visual idea, X concise conversation',
  ],
  dont: [
    'Promise guaranteed transformation, income, virality, or overnight results',
    'Invent social proof, testimonials, engagement numbers, or customer outcomes',
    'Use manipulative scarcity, fake urgency, scraping, trend manipulation, auto-DMs, or fake engagement',
    'Create medical, financial, legal, or mental-health claims without explicit source material and review',
    'Use generic filler unless it is tied to a specific course outcome',
  ],
  preferredVocabulary: [
    'course',
    'coaching',
    'transformation',
    'practical steps',
    'clarity',
    'confidence',
    'community',
    'waitlist',
    'registration',
    'free session',
    'book a call',
    'comment',
    'learn',
  ],
  avoidVocabulary: ['guaranteed', 'overnight', 'secret hack', 'viral guaranteed', 'miracle', 'get rich', 'fake proof'],
};


// ============================================================
// Draft Generation Service
// ============================================================

export async function generateDrafts(
  requesterRole: string,
  requesterId: string,
  tenantKey: string,
  input: GenerateDraftInput,
): Promise<DraftResult[]> {
  checkPermission(requesterRole, 'drafts:generate');

  const campaign = await prisma.contentRequest.findFirst({
    where: { id: input.campaignRequestId, tenant_key: tenantKey },
  });
  if (!campaign) throw new NotFoundError('Campaign request', input.campaignRequestId);

  const platforms = input.platforms || (campaign.target_platforms as Platform[]);
  const tone = input.tone || 'professional';
  const results: DraftResult[] = [];
  const failures: string[] = [];

  for (const platform of platforms) {
    try {
      const result = await generateSingleDraft(
        tenantKey,
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
      await recordCommercialWorkflowAudit({
        action: 'draft_generated',
        result: 'success',
        humanUserId: requesterId,
        targetObjectType: 'content_item',
        targetObjectId: result.contentItemId,
        sourceModule: 'ai-generation',
        reason: `Generated ${platform} draft through configured provider adapter.`,
        afterState: {
          campaignRequestId: input.campaignRequestId,
          platform,
          versionNo: result.versionNo,
        },
      });

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
      failures.push(`${platform}: ${errorMsg}`);

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
      await recordCommercialWorkflowAudit({
        action: 'draft_generation_failed',
        result: 'failure',
        humanUserId: requesterId,
        targetObjectType: 'content_request',
        targetObjectId: input.campaignRequestId,
        sourceModule: 'ai-generation',
        reason: errorMsg,
        afterState: { platform },
      });

      const event: DraftGenerationFailedEvent = {
        campaignRequestId: input.campaignRequestId,
        platform,
        error: errorMsg,
        timestamp: new Date(),
      };
      await eventBus.emit(DRAFT_EVENTS.DRAFT_GENERATION_FAILED, event);
    }
  }

  if (results.length === 0 && failures.length > 0) {
    const providerRequired = failures.find(message => message.includes('LLM_PROVIDER_REQUIRED') || message.includes('No production LLM provider') || message.includes('missing credentials for this user'));
    if (providerRequired) {
      throw new AppError(
        'No production LLM provider is configured for this user. Configure Gemma, DeepSeek, OpenAI, or Claude in AI Provider settings.',
        424,
        'LLM_PROVIDER_REQUIRED',
      );
    }
    throw new ExternalServiceError('LLM', `All requested platform drafts failed: ${failures.join('; ')}`);
  }

  return results;
}

export async function reviseDraft(
  requesterRole: string,
  requesterId: string,
  tenantKey: string,
  input: ReviseDraftInput,
): Promise<DraftResult> {
  checkPermission(requesterRole, 'drafts:revise');

  const item = await repo.getContentItem(input.contentItemId, tenantKey);
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
  let modelUsed = 'provider-adapter';
  try {
    const generation = await llm.generate(prompt);
    revisedText = generation.text;
    modelUsed = `${generation.provider}:${generation.model}`;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new ExternalServiceError('LLM', err instanceof Error ? err.message : 'Generation failed');
  }

  await repo.createDraftVersion(
    input.contentItemId,
    newVersionNo,
    revisedText,
    modelUsed,
  );

  await repo.updateContentItemDraft(input.contentItemId, tenantKey, revisedText);

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
  await recordCommercialWorkflowAudit({
    action: 'draft_revised',
    result: 'success',
    humanUserId: requesterId,
    targetObjectType: 'content_item',
    targetObjectId: input.contentItemId,
    sourceModule: 'ai-generation',
    reason: input.feedback,
    afterState: { versionNo: newVersionNo },
  });

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

export async function saveEditedDraft(
  requesterRole: string,
  requesterId: string,
  tenantKey: string,
  input: SaveEditedDraftInput,
): Promise<DraftResult> {
  checkPermission(requesterRole, 'drafts:revise');

  const item = await repo.getContentItem(input.contentItemId, tenantKey);
  if (!item.request) throw new NotFoundError('Campaign request for content item');

  const latestVersion = await repo.getLatestVersion(input.contentItemId);
  const newVersionNo = (latestVersion?.version_no || 0) + 1;

  await repo.createDraftVersion(
    input.contentItemId,
    newVersionNo,
    input.draftText,
    'human-edit',
  );
  await repo.updateContentItemDraft(input.contentItemId, tenantKey, input.draftText);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'draft_human_edit_saved',
      object_type: 'content_item',
      object_id: input.contentItemId,
      result: 'success',
    },
    `Human edited draft saved to version ${newVersionNo}`,
  );
  await recordCommercialWorkflowAudit({
    action: 'draft_human_edit_saved',
    result: 'success',
    humanUserId: requesterId,
    targetObjectType: 'content_item',
    targetObjectId: input.contentItemId,
    sourceModule: 'ai-generation',
    reason: input.editNote || 'Human edit saved',
    afterState: { versionNo: newVersionNo },
  });

  return {
    contentItemId: input.contentItemId,
    platform: item.platform as Platform,
    contentType: item.content_type as DraftContentType,
    draftText: input.draftText,
    versionNo: newVersionNo,
    metadata: {
      objective: item.request.objective,
      audience: item.request.audience || '',
      cta: item.request.cta,
      hashtags: [],
      rationale: input.editNote || 'Saved human edit',
      tone: 'professional',
      hookType: 'human_edit',
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
  tenantKey: string,
  requesterId: string,
  campaign: CampaignData,
  platform: Platform,
  tone: Tone,
): Promise<DraftResult> {
  const constraints = PLATFORM_CONSTRAINTS[platform] || PLATFORM_CONSTRAINTS.linkedin;
  const prompt = buildGenerationPrompt(campaign, platform, constraints.maxTextLength, tone);

  const llm = await getLLMProvider(requesterId);
  let draftText: string;
  let modelUsed = 'provider-adapter';
  try {
    const generation = await llm.generate(prompt);
    draftText = generation.text;
    modelUsed = `${generation.provider}:${generation.model}`;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new ExternalServiceError('LLM', err instanceof Error ? err.message : 'Generation failed');
  }

  const metadata = buildMetadata(campaign, platform, tone);
  const riskNotes = assessRisk(campaign);

  const result = await repo.createContentItem(
    tenantKey,
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
    modelUsed,
  );

  return result;
}

function buildGenerationPrompt(campaign: CampaignData, platform: Platform, maxLength: number, tone: Tone): string {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  return `You are a senior social media strategist and copywriter for a high-trust course and life-coaching creator brand.

CUSTOMER CONTEXT:
- The business sells courses, live coaching, and personal development programs through social media.
- The creator is a public personal brand. Trust, clarity, and credibility matter more than hype.
- The content should help the marketing team turn followers into qualified course leads.

BRAND VOICE: ${COURSE_CREATOR_PROFILE.tone}
DO: ${COURSE_CREATOR_PROFILE.do.join(', ')}
DON'T: ${COURSE_CREATOR_PROFILE.dont.join(', ')}
PREFERRED WORDS: ${COURSE_CREATOR_PROFILE.preferredVocabulary.join(', ')}
AVOID WORDS: ${COURSE_CREATOR_PROFILE.avoidVocabulary.join(', ')}

PLATFORM: ${platform}
MAX LENGTH: ${maxLength} characters
FORMAT: ${constraints.recommendedFormat}
HOOK REQUIRED: ${constraints.hookRequired}
PLATFORM NOTES: ${constraints.notes}
PLATFORM ADAPTATION:
- LinkedIn: authority insight, practical lesson, professional CTA.
- Instagram: strong first line, visual/Reels/carousel idea, comment or DM-style CTA without triggering auto-DMs.
- X: concise opinion, lesson, or short thread starter that invites conversation.

CAMPAIGN:
- Topic: ${campaign.raw_message}
- Objective: ${campaign.objective}
- Audience: ${campaign.audience || COURSE_CREATOR_PROFILE.audienceFallback}
- CTA: ${campaign.cta || 'No specific CTA'}
- Content Type: ${campaign.content_type}
- Risk Category: ${campaign.risk_category}

TONE: ${tone}

Generate a platform-native draft that:
1. Follows brand voice
2. Respects platform rules and character limits
3. Includes a clear hook, body, and CTA
4. Improves reach readiness through clarity, native format, strong first line, useful value, and clean CTA
5. Avoids restricted claims, fake proof, fake engagement, scraping, trend manipulation, and manipulative promises

Output only the final social post copy. Do not include explanations, headings, labels, markdown separators, or notes.`;
}

function buildRevisionPrompt(
  originalDraft: string,
  feedback: string,
  objective: string,
  maxLength: number,
  tone: Tone,
): string {
  return `You are revising a social media draft for a course and life-coaching creator brand.

ORIGINAL DRAFT:
${originalDraft}

FEEDBACK: ${feedback}
OBJECTIVE: ${objective}
MAX LENGTH: ${maxLength} characters
TONE: ${tone}
BRAND VOICE: ${COURSE_CREATOR_PROFILE.tone}

Revise the draft based on the feedback while maintaining brand voice and platform rules.
Keep useful value, a clear next step, and no invented proof or guarantees.
Output the revised draft text only.`;
}

function buildMetadata(campaign: CampaignData, platform: Platform, tone: Tone): DraftMetadata {
  return {
    objective: campaign.objective,
    audience: campaign.audience || COURSE_CREATOR_PROFILE.audienceFallback,
    cta: campaign.cta || null,
    hashtags: generateHashtags(platform, campaign.content_type),
    rationale: `Platform-native ${PLATFORM_CONSTRAINTS[platform].recommendedFormat} for ${platform}, targeting ${campaign.audience || COURSE_CREATOR_PROFILE.audienceFallback} with ${tone} tone and course-sales conversion intent.`,
    tone,
    hookType: PLATFORM_CONSTRAINTS[platform].hookRequired ? 'question' : 'statement',
    mediaSuggestions: generateMediaSuggestions(platform, PLATFORM_CONSTRAINTS[platform].recommendedFormat),
  };
}

function generateHashtags(platform: Platform, _contentType: string): string[] {
  const base = ['#CourseCreation', '#Coaching', '#PersonalGrowth'];
  const platformSpecific: Record<Platform, string[]> = {
    linkedin: ['#Leadership', '#Marketing', '#Learning'],
    instagram: ['#Mindset', '#SelfDevelopment', '#OnlineCourses'],
    x: ['#Learning', '#Creators'],
    facebook: ['#Community', '#Courses'],
    tiktok: ['#LearnOnTikTok', '#CoachingTips'],
    youtube: ['#CourseLaunch', '#CoachingBusiness'],
    reddit: [],
  };
  const max = PLATFORM_CONSTRAINTS[platform].maxHashtags;
  return [...base, ...(platformSpecific[platform] || [])].slice(0, max);
}

function generateMediaSuggestions(platform: Platform, format: string): string[] {
  if (format === 'reel' || format === 'video') return ['Short video: pain point, lesson, next step', 'First 3 seconds: bold course outcome or common mistake'];
  if (format === 'carousel') return ['5-slide carousel: problem to lesson to action', 'First slide: specific question, myth, or transformation promise without guarantees'];
  if (platform === 'instagram') return ['Creator photo or course visual with clean text overlay', 'Story frame with question sticker or registration reminder'];
  return ['Native image with personal-brand style', 'Text overlay with course lesson or clear CTA'];
}

function assessRisk(campaign: CampaignData): string {
  const risks: string[] = [];
  if (campaign.risk_category === 'high') risks.push('High-risk content - requires claim and compliance review');
  if (campaign.content_type === 'announcement') risks.push('Announcement - verify course claims, dates, pricing, and availability before publishing');
  if (!campaign.cta) risks.push('No CTA defined - may reduce lead capture and course conversion');
  return risks.length > 0 ? risks.join('; ') : 'Low risk - standard course-sales content';
}
