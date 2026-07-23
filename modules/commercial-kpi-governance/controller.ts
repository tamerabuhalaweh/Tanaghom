import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateAmendKpiTarget,
  validateCreateKpiTarget,
  validateEventCapacity,
  validateListKpiTargets,
  validateTransitionKpiTarget,
  validateUpdateKpiTarget,
} from './validators';

export const commercialKpiGovernanceRouter = Router();

function context(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(authHeader.substring(7));
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

commercialKpiGovernanceRouter.get('/', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.listTargets(auth.role, auth.tenantKey, validateListKpiTargets(req.query)));
}));

commercialKpiGovernanceRouter.get('/events/:eventId/effective', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.listEffectiveEventTargets(
      auth.role,
      auth.tenantKey,
      String(req.params.eventId),
    ),
  );
}));

commercialKpiGovernanceRouter.post('/', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(
    await service.createTarget(
      auth.role,
      auth.tenantKey,
      auth.userId,
      validateCreateKpiTarget(req.body),
    ),
  );
}));

commercialKpiGovernanceRouter.put('/:id', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.updateTarget(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.id),
      validateUpdateKpiTarget(req.body),
    ),
  );
}));

commercialKpiGovernanceRouter.post('/:id/transition', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.transitionTarget(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.id),
      validateTransitionKpiTarget(req.body),
    ),
  );
}));

commercialKpiGovernanceRouter.post('/:id/amend', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(
    await service.amendTarget(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.id),
      validateAmendKpiTarget(req.body),
    ),
  );
}));

commercialKpiGovernanceRouter.get('/events/:eventId/capacity', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.getEventCapacity(auth.role, auth.tenantKey, String(req.params.eventId)),
  );
}));

commercialKpiGovernanceRouter.put('/events/:eventId/capacity', route(async (req, res) => {
  const auth = context(req);
  res.json(
    await service.setEventCapacity(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.eventId),
      validateEventCapacity(req.body),
    ),
  );
}));

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
