import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';

export const masterEventAggregationRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

masterEventAggregationRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const filters = {
      eventType: req.query.eventType as string | undefined,
      eventStatus: req.query.eventStatus as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      geography: req.query.geography as string | undefined,
      ownerUserId: req.query.ownerUserId as string | undefined,
    };
    const dashboard = await service.getMasterDashboard(payload.role, payload.tenantKey || 'default', filters);
    res.json(dashboard);
  } catch (err) { next(err); }
});
