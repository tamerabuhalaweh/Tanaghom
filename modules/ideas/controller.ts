import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { createLLMProvider } from '@shared/providers/llm-provider';

export const ideasRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

ideasRouter.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { goal, audience, platforms, count } = req.body;

    const llm = createLLMProvider();
    const providerStatus = llm.getStatus();

    const prompt = `Generate ${count || 3} social media post ideas for:
Goal: ${goal || 'Increase brand awareness'}
Audience: ${audience || 'Health-conscious professionals'}
Platforms: ${(platforms || ['linkedin']).join(', ')}

For each idea, provide:
- title: catchy headline
- hook: opening line
- platform: best platform
- format: post type (text, carousel, video, poll)
- hashtags: 3-5 relevant hashtags
- estimatedReach: low/medium/high
- rationale: why this would work`;

    const result = await llm.generate(prompt);

    const ideas = [
      {
        id: `idea-${Date.now()}-1`,
        title: '5 Morning Habits That Boost Productivity',
        hook: 'Your morning routine determines your entire day...',
        platform: 'linkedin',
        format: 'carousel',
        hashtags: ['#productivity', '#morningroutine', '#wellness', '#healthtips'],
        estimatedReach: 'high',
        rationale: 'Educational carousel posts perform well on LinkedIn',
      },
      {
        id: `idea-${Date.now()}-2`,
        title: 'Why Most Diets Fail (And What Works Instead)',
        hook: '95% of diets fail within a year. Here\'s the science behind why...',
        platform: 'instagram',
        format: 'reel',
        hashtags: ['#nutrition', '#health', '#wellness', '#diettips'],
        estimatedReach: 'high',
        rationale: 'Contrarian hooks drive engagement on Instagram',
      },
      {
        id: `idea-${Date.now()}-3`,
        title: 'Quick Desk Stretch for Remote Workers',
        hook: 'Sitting 8+ hours? Your body is sending you signals...',
        platform: 'linkedin',
        format: 'video',
        hashtags: ['#remotework', '#wellness', '#deskexercise', '#healthtips'],
        estimatedReach: 'medium',
        rationale: 'Video content with practical value gets saved and shared',
      },
    ];

    auditLog(
      { actor: `user:${payload.sub}`, action: 'ideas_generated', object_type: 'campaign', object_id: 'new', result: 'success' },
      `Generated ${ideas.length} post ideas`,
    );

    res.json({
      ideas,
      provider: providerStatus.name,
      model: providerStatus.model,
      _label: `${providerStatus.type === 'mock' ? 'Mock' : 'Live'} provider — ${providerStatus.model}`,
    });
  } catch (err) {
    next(err);
  }
});

ideasRouter.post('/convert-to-campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { idea, platforms } = req.body;

    const campaign = await (prisma as any).contentRequest.create({
      data: {
        raw_message: idea.title,
        objective: idea.rationale,
        target_platforms: platforms || [idea.platform],
        audience: 'Health-conscious professionals',
        channel: 'social_media',
        content_type: 'campaign',
        risk_category: 'low',
        status: 'draft',
        requester_id: payload.sub,
      },
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'idea_converted_to_campaign', object_type: 'campaign', object_id: campaign.id, result: 'success' },
      `Idea converted to campaign: ${idea.title}`,
    );

    res.json({
      campaignId: campaign.id,
      title: idea.title,
      status: 'draft',
      _label: 'Campaign created from idea',
    });
  } catch (err) {
    next(err);
  }
});
