import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  buildSocialGrowthSummary,
  createCampaignFromTemplate,
  getAlgorithmKnowledgePack,
  listCourseCampaignTemplates,
} from './service';

export const socialGrowthRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

const createFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  ownerDepartmentId: z.string().uuid().optional(),
  overrides: z.object({
    topic: z.string().trim().min(1).max(500).optional(),
    objective: z.string().trim().min(1).max(2000).optional(),
    audience: z.string().trim().min(1).max(1000).optional(),
    cta: z.string().trim().min(1).max(500).optional(),
    targetPlatforms: z.array(z.string().trim().min(1)).min(1).optional(),
    riskCategory: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
});

socialGrowthRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    res.json(await buildSocialGrowthSummary({
      tenantKey: session.tenantKey,
      humanUserId: session.humanUserId,
      role: session.role,
    }));
  } catch (err) {
    next(err);
  }
});

socialGrowthRouter.get('/templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(listCourseCampaignTemplates());
  } catch (err) {
    next(err);
  }
});

socialGrowthRouter.post('/templates/:templateId/campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const input = createFromTemplateSchema.parse({
      ...req.body,
      templateId: req.params.templateId,
    });
    const campaign = await createCampaignFromTemplate(
      {
        tenantKey: session.tenantKey,
        humanUserId: session.humanUserId,
        role: session.role,
      },
      input,
    );
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

socialGrowthRouter.get('/algorithm-pack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    res.json(await getAlgorithmKnowledgePack(session.tenantKey));
  } catch (err) {
    next(err);
  }
});
