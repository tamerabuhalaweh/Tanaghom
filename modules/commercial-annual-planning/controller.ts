import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateAnnualPlanTransition,
  validateArchivePortfolioItem,
  validateCreateAnnualPlan,
  validateCreatePortfolioItem,
  validateLinkLearningSets,
  validateListAnnualPlans,
  validateRejectAnnualPlan,
  validateUpdateAnnualPlan,
  validateUpdatePortfolioItem,
} from './validators';

export const commercialAnnualPlanningRouter = Router();

function context(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(authHeader.substring(7));
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

commercialAnnualPlanningRouter.get(
  '/',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.listAnnualPlans(auth.role, auth.tenantKey, validateListAnnualPlans(req.query)),
    );
  }),
);

commercialAnnualPlanningRouter.post(
  '/',
  route(async (req, res) => {
    const auth = context(req);
    res
      .status(201)
      .json(
        await service.createAnnualPlan(
          auth.role,
          auth.tenantKey,
          auth.userId,
          validateCreateAnnualPlan(req.body),
        ),
      );
  }),
);

commercialAnnualPlanningRouter.get(
  '/:id',
  route(async (req, res) => {
    const auth = context(req);
    res.json(await service.getAnnualPlan(auth.role, auth.tenantKey, String(req.params.id)));
  }),
);

commercialAnnualPlanningRouter.put(
  '/:id',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.updateAnnualPlan(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.id),
        validateUpdateAnnualPlan(req.body),
      ),
    );
  }),
);

commercialAnnualPlanningRouter.post(
  '/:id/submit',
  transition('pending_approval', validateAnnualPlanTransition),
);
commercialAnnualPlanningRouter.post(
  '/:id/approve',
  transition('approved', validateAnnualPlanTransition),
);
commercialAnnualPlanningRouter.post(
  '/:id/reject',
  transition('rejected', validateRejectAnnualPlan),
);
commercialAnnualPlanningRouter.post(
  '/:id/activate',
  transition('active', validateAnnualPlanTransition),
);
commercialAnnualPlanningRouter.post(
  '/:id/close',
  transition('closed', validateAnnualPlanTransition),
);
commercialAnnualPlanningRouter.post(
  '/:id/archive',
  transition('archived', validateAnnualPlanTransition),
);

commercialAnnualPlanningRouter.put(
  '/:id/learning-sets',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.updateLearningSets(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.id),
        validateLinkLearningSets(req.body),
      ),
    );
  }),
);

commercialAnnualPlanningRouter.post(
  '/:id/items',
  route(async (req, res) => {
    const auth = context(req);
    res
      .status(201)
      .json(
        await service.createPortfolioItem(
          auth.role,
          auth.tenantKey,
          auth.userId,
          String(req.params.id),
          validateCreatePortfolioItem(req.body),
        ),
      );
  }),
);

commercialAnnualPlanningRouter.put(
  '/:id/items/:itemId',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.updatePortfolioItem(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.id),
        String(req.params.itemId),
        validateUpdatePortfolioItem(req.body),
      ),
    );
  }),
);

commercialAnnualPlanningRouter.post(
  '/:id/items/:itemId/archive',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.archivePortfolioItem(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.id),
        String(req.params.itemId),
        validateArchivePortfolioItem(req.body),
      ),
    );
  }),
);

function transition(
  target: 'pending_approval' | 'approved' | 'rejected' | 'active' | 'closed' | 'archived',
  validate: (input: unknown) => { expectedRevision: number; reason?: string },
) {
  return route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.transitionAnnualPlan(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.id),
        target,
        validate(req.body),
      ),
    );
  });
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}
