import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';

export const learningRecommendationsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

learningRecommendationsRouter.get('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const recommendations = await service.getLearningRecommendations(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(recommendations);
  } catch (err) { next(err); }
});
