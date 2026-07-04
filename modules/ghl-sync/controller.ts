import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { ghlPullSchema, ghlWriteBackSchema } from './types';
import * as service from './service';

export const ghlSyncRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

ghlSyncRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await service.status(payload.role, payload.tenantKey || 'default', req.query.eventId as string | undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSyncRouter.post('/pull-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(ghlPullSchema, req.body);
    const result = await service.pullPreview(payload.role, payload.tenantKey || 'default', payload.sub, { ...input, limit: input.limit ?? 50 });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSyncRouter.post('/pull-sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(ghlPullSchema, req.body);
    const result = await service.pullSync(payload.role, payload.tenantKey || 'default', payload.sub, payload.agentRepId, { ...input, limit: input.limit ?? 50 });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSyncRouter.post('/write-back-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(ghlWriteBackSchema, req.body);
    const result = await service.writeBackPreview(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSyncRouter.post('/write-back', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(ghlWriteBackSchema, req.body);
    const result = await service.writeBack(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
