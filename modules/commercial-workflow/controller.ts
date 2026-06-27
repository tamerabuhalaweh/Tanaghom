import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { getCommercialWorkflowState } from './service';

export const commercialWorkflowRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

commercialWorkflowRouter.get('/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const campaignId = z.string().uuid().optional().parse(req.query.campaignId);
    const state = await getCommercialWorkflowState(session, campaignId);
    res.json({
      ...state,
      _label: 'Commercial/Social workflow state derived from STITCH backend records',
    });
  } catch (err) {
    next(err);
  }
});
