import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateApproveAttributionMapping,
  validateCreateAttributionMapping,
  validateListAttributionMappings,
  validatePreviewAttributionMatch,
  validateUpdateAttributionMapping,
} from './validators';

export const ghlPlanAttributionRouter = Router();

function context(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(authHeader.substring(7));
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

ghlPlanAttributionRouter.get('/', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.listMappings(
      auth.role,
      auth.tenantKey,
      validateListAttributionMappings(req.query),
    ),
  );
}));

ghlPlanAttributionRouter.post('/', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(
    await service.createMapping(
      auth.role,
      auth.tenantKey,
      auth.userId,
      validateCreateAttributionMapping(req.body),
    ),
  );
}));

ghlPlanAttributionRouter.put('/:id', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.updateMapping(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.id),
      validateUpdateAttributionMapping(req.body),
    ),
  );
}));

ghlPlanAttributionRouter.post('/:id/approve', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.approveMapping(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.id),
      validateApproveAttributionMapping(req.body),
    ),
  );
}));

ghlPlanAttributionRouter.post('/:id/preview-match', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.previewMatch(
      auth.role,
      auth.tenantKey,
      String(req.params.id),
      validatePreviewAttributionMatch(req.body),
    ),
  );
}));

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}

