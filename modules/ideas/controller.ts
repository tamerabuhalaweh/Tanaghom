import { randomUUID } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import {
  postIdeaSchema,
  resumeIdeaSelectionWorkflow,
  startIdeaSelectionWorkflow,
  type PostIdea,
} from './workflow';

export const ideasRouter = Router();

const generateIdeasSchema = z.object({
  goal: z.string().trim().min(6).max(1000),
  audience: z.string().trim().min(3).max(500),
  platforms: z.array(z.string().trim().min(1)).min(1).max(5),
  count: z.number().int().min(1).max(6).default(3),
});

const ideaResponseSchema = z.object({
  ideas: z.array(postIdeaSchema).min(1),
});

const resumeWorkflowSchema = z.object({
  action: z.enum(['select', 'reject']),
  ideaId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const convertToCampaignSchema = z.object({
  idea: postIdeaSchema,
  platforms: z.array(z.string().trim().min(1)).min(1).max(5).optional(),
  audience: z.string().trim().min(3).max(500),
  goal: z.string().trim().min(6).max(1000),
});

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

ideasRouter.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = generateIdeasSchema.parse(req.body);

    const llm = await resolveUserLLMProvider(payload.sub);
    const providerStatus = llm.getStatus();
    const prompt = buildIdeaPrompt(input);
    const llmResult = await llm.generate(prompt, {
      maxTokens: 1200,
      temperature: 0.6,
      systemPrompt: 'You are a commercial social media strategist. Return only valid JSON.',
    });

    const parsed = parseIdeas(llmResult.text, input);
    const ideas = parsed.ideas.length > 0 ? parsed.ideas : buildFallbackIdeas(input);
    const threadId = `post-idea-${randomUUID()}`;
    const workflow = await startIdeaSelectionWorkflow({
      threadId,
      goal: input.goal,
      audience: input.audience,
      ideas,
    });

    auditLog(
      {
        actor: `user:${payload.sub}`,
        action: 'ideas_generated',
        object_type: 'campaign',
        object_id: undefined,
        result: 'success',
      },
      `Generated ${ideas.length} post ideas through ${providerStatus.name}`,
    );

    res.json({
      workflow,
      ideas,
      provider: providerStatus.name,
      providerType: providerStatus.type,
      model: llmResult.model || providerStatus.model,
      apiKeyStatus: providerStatus.apiKeyStatus,
      generationMode: parsed.fromModel ? 'Live Provider Active' : 'Mock Provider',
      safety: {
        externalExecution: 'Blocked',
        m5: 'Disabled',
        humanApproval: 'Required before campaign conversion',
      },
    });
  } catch (err) {
    next(err);
  }
});

ideasRouter.post('/workflows/:threadId/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const threadId = z.string().min(1).parse(req.params.threadId);
    const input = resumeWorkflowSchema.parse(req.body);
    const result = await resumeIdeaSelectionWorkflow({
      threadId,
      ...input,
    });

    auditLog(
      {
        actor: `user:${payload.sub}`,
        action: 'idea_workflow_human_decision',
        object_type: 'campaign',
        object_id: undefined,
        result: result.status,
      },
      `Human ${result.status === 'selected' ? 'selected' : 'rejected'} post idea workflow ${threadId}`,
    );

    res.json({
      ...result,
      safety: {
        externalExecution: 'Blocked',
        m5: 'Disabled',
      },
    });
  } catch (err) {
    next(err);
  }
});

ideasRouter.post('/convert-to-campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = convertToCampaignSchema.parse(req.body);

    const campaign = await prisma.contentRequest.create({
      data: {
        raw_message: `${input.idea.title}\n\n${input.idea.hook}`,
        objective: input.goal,
        target_platforms: input.platforms || [input.idea.platform],
        audience: input.audience,
        channel: 'social_media',
        content_type: 'campaign',
        risk_category: 'low',
        status: 'idea',
        requester_id: payload.sub,
        cta: 'Generated from AI post idea workflow',
        media_refs: {
          source: 'post_idea_workflow',
          ideaId: input.idea.id,
          format: input.idea.format,
          hashtags: input.idea.hashtags,
          estimatedReach: input.idea.estimatedReach,
          rationale: input.idea.rationale,
        },
      },
    });

    auditLog(
      {
        actor: `user:${payload.sub}`,
        action: 'idea_converted_to_campaign',
        object_type: 'campaign',
        object_id: campaign.id,
        result: 'success',
      },
      `Idea converted to campaign: ${input.idea.title}`,
    );

    res.json({
      campaignId: campaign.id,
      title: input.idea.title,
      status: campaign.status,
      nextStep: 'Open Campaign Workspace to generate platform-specific drafts.',
      safety: {
        externalExecution: 'Blocked',
        m5: 'Disabled',
      },
    });
  } catch (err) {
    next(err);
  }
});

function buildIdeaPrompt(input: z.infer<typeof generateIdeasSchema>): string {
  return `Generate ${input.count} commercial/social media post ideas as JSON.

Return exactly this JSON shape:
{
  "ideas": [
    {
      "id": "short-stable-id",
      "title": "clear business-facing title",
      "hook": "opening line",
      "platform": "one of: ${input.platforms.join(', ')}",
      "format": "text | carousel | short_video | poll | thread",
      "hashtags": ["#tag"],
      "estimatedReach": "low | medium | high",
      "rationale": "why this idea should work for the stated goal"
    }
  ]
}

Campaign goal:
${input.goal}

Target audience:
${input.audience}

Allowed platforms:
${input.platforms.join(', ')}

Rules:
- Use only the allowed platforms.
- Do not invent fake analytics.
- Make ideas specific to the goal and audience.
- Keep each title under 90 characters.`;
}

function parseIdeas(text: string, input: z.infer<typeof generateIdeasSchema>): { ideas: PostIdea[]; fromModel: boolean } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return { ideas: [], fromModel: false };

  try {
    const parsed = ideaResponseSchema.parse(JSON.parse(jsonText));
    return {
      ideas: parsed.ideas.slice(0, input.count).map((idea, index) => ({
        ...idea,
        id: idea.id || `idea-${index + 1}`,
        platform: input.platforms.includes(idea.platform) ? idea.platform : input.platforms[0],
      })),
      fromModel: true,
    };
  } catch {
    return { ideas: [], fromModel: false };
  }
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || null;
}

function buildFallbackIdeas(input: z.infer<typeof generateIdeasSchema>): PostIdea[] {
  const platformFormats: Record<string, string> = {
    linkedin: 'carousel',
    instagram: 'short_video',
    twitter: 'thread',
    x: 'thread',
  };

  return Array.from({ length: input.count }, (_, index) => {
    const platform = input.platforms[index % input.platforms.length];
    const focus = [
      'proof-led customer story',
      'problem/solution breakdown',
      'before-and-after workflow',
      'expert checklist',
      'lead magnet CTA',
      'objection-handling post',
    ][index] || 'commercial social post';

    return {
      id: `idea-${Date.now()}-${index + 1}`,
      title: `${focus.charAt(0).toUpperCase()}${focus.slice(1)} for ${input.goal.slice(0, 54)}`,
      hook: `If ${input.audience} care about this outcome, this is the angle to test first.`,
      platform,
      format: platformFormats[platform] || 'text',
      hashtags: ['#marketing', '#growth', '#socialmedia', '#leadgeneration'],
      estimatedReach: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      rationale: `Generated from the campaign goal and audience. Uses ${platform} format conventions without external execution.`,
    };
  });
}
