import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';

export const connectorReadinessRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

connectorReadinessRouter.get('/global', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const readiness = await service.getGlobalConnectorReadiness(payload.role, payload.tenantKey || 'default');
    res.json(readiness);
  } catch (err) { next(err); }
});

connectorReadinessRouter.get('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const readiness = await service.getEventConnectorReadiness(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(readiness);
  } catch (err) { next(err); }
});
