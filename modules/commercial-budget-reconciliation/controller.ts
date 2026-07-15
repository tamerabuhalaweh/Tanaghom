import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateBudgetTransition,
  validateCreateBudgetAllocation,
  validateReallocateBudget,
  validateVerifyKpiEvidence,
} from './validators';

export const commercialBudgetReconciliationRouter = Router();

commercialBudgetReconciliationRouter.get(
  '/annual-plans/:annualPlanId',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.getBudgetReconciliation(
        auth.role,
        auth.tenantKey,
        String(req.params.annualPlanId),
      ),
    );
  }),
);

commercialBudgetReconciliationRouter.post(
  '/annual-plans/:annualPlanId/allocations',
  route(async (req, res) => {
    const auth = context(req);
    res.status(201).json(
      await service.createBudgetAllocation(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.annualPlanId),
        validateCreateBudgetAllocation(req.body),
      ),
    );
  }),
);

commercialBudgetReconciliationRouter.put(
  '/annual-plans/:annualPlanId/allocations/:allocationId',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.reallocateBudget(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.annualPlanId),
        String(req.params.allocationId),
        validateReallocateBudget(req.body),
      ),
    );
  }),
);

for (const transition of ['approve', 'commit', 'archive'] as const) {
  const target = transition === 'approve' ? 'approved' : transition === 'commit' ? 'committed' : 'archived';
  commercialBudgetReconciliationRouter.post(
    `/annual-plans/:annualPlanId/allocations/:allocationId/${transition}`,
    route(async (req, res) => {
      const auth = context(req);
      res.json(
        await service.transitionBudgetAllocation(
          auth.role,
          auth.tenantKey,
          auth.userId,
          String(req.params.annualPlanId),
          String(req.params.allocationId),
          target,
          validateBudgetTransition(req.body),
        ),
      );
    }),
  );
}

commercialBudgetReconciliationRouter.post(
  '/evidence/:kpiId/review',
  route(async (req, res) => {
    const auth = context(req);
    res.json(
      await service.verifyKpiEvidence(
        auth.role,
        auth.tenantKey,
        auth.userId,
        String(req.params.kpiId),
        validateVerifyKpiEvidence(req.body),
      ),
    );
  }),
);

function context(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(authHeader.substring(7));
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}
