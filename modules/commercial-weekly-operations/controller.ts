import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateCreateWeeklyWorkItem,
  validateTransitionWeeklyWorkItem,
  validateUpdateWeeklyWorkItem,
  validateWeeklyWorkspaceQuery,
} from './validators';

export const commercialWeeklyOperationsRouter = Router();

function session(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(authHeader.substring(7));
  return {
    role: payload.role,
    tenantKey: payload.tenantKey || 'default',
    userId: payload.sub,
  };
}

commercialWeeklyOperationsRouter.get(
  '/:commercialPlanId/weeks',
  route(async (req, res) => {
    const auth = session(req);
    res.json(await service.getWeeklyWorkspace(
      auth.role,
      auth.tenantKey,
      String(req.params.commercialPlanId),
      validateWeeklyWorkspaceQuery(req.query),
    ));
  }),
);

commercialWeeklyOperationsRouter.post(
  '/:commercialPlanId/weeks/items',
  route(async (req, res) => {
    const auth = session(req);
    res.status(201).json(await service.createWeeklyWorkItem(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.commercialPlanId),
      validateCreateWeeklyWorkItem(req.body),
    ));
  }),
);

commercialWeeklyOperationsRouter.put(
  '/:commercialPlanId/weeks/items/:itemId',
  route(async (req, res) => {
    const auth = session(req);
    res.json(await service.updateWeeklyWorkItem(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.commercialPlanId),
      String(req.params.itemId),
      validateUpdateWeeklyWorkItem(req.body),
    ));
  }),
);

commercialWeeklyOperationsRouter.post(
  '/:commercialPlanId/weeks/items/:itemId/transition',
  route(async (req, res) => {
    const auth = session(req);
    res.json(await service.transitionWeeklyWorkItem(
      auth.role,
      auth.tenantKey,
      auth.userId,
      String(req.params.commercialPlanId),
      String(req.params.itemId),
      validateTransitionWeeklyWorkItem(req.body),
    ));
  }),
);

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}
