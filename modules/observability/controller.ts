import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as repo from './repository';

export const observabilityRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

observabilityRouter.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const events = await repo.listEvents({
      tenantKey: payload.tenantKey || 'default',
      eventType: req.query.type as string | undefined,
      eventCategory: req.query.category as string | undefined,
      severity: req.query.severity as string | undefined,
      humanUserId: req.query.userId as string | undefined,
      agentRepId: req.query.agentRepId as string | undefined,
      targetObjectType: req.query.targetType as string | undefined,
      targetObjectId: req.query.targetId as string | undefined,
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

observabilityRouter.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const event = await repo.getTenantEventById(req.params.id as string, payload.tenantKey || 'default');
    res.json(event);
  } catch (err) {
    next(err);
  }
});

observabilityRouter.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const records = await repo.listAuditRecords({
      tenantKey: payload.tenantKey || 'default',
      auditType: req.query.type as string | undefined,
      action: req.query.action as string | undefined,
      targetObjectType: req.query.objectType as string | undefined,
      targetObjectId: req.query.objectId as string | undefined,
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

observabilityRouter.get('/learning-signals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const signals = await repo.listLearningSignals({
      tenantKey: payload.tenantKey || 'default',
      signalType: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json(signals);
  } catch (err) {
    next(err);
  }
});
