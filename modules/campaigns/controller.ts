import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  transitionCampaign,
} from '../service';
import { validateCreateCampaign, validateUpdateCampaign, validateTransition } from '../validators';

export const campaignsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

campaignsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const campaigns = await listCampaigns(
      payload.role,
      req.query.requesterId as string,
      req.query.status as any,
      req.query.platform as string,
    );
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const campaign = await getCampaign(payload.role, req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateCampaign(req.body);
    const campaign = await createCampaign(payload.role, payload.sub, 'api', input);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateCampaign(req.body);
    const campaign = await updateCampaign(payload.role, payload.sub, req.params.id, input);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateTransition(req.body);
    const campaign = await transitionCampaign(
      payload.role,
      payload.sub,
      req.params.id,
      input.toState,
      input.reason,
    );
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});
