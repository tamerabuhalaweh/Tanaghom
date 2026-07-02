import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';

export const eventCloseoutRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

eventCloseoutRouter.get('/events/:eventId/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const report = await service.getCloseoutReport(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(report);
  } catch (err) { next(err); }
});
