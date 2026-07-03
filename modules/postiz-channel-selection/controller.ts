import { Router, Request, Response, NextFunction } from 'express';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { selectChannelForEventSchema, deselectChannelSchema } from './types';
import type { SelectChannelForEventInput, DeselectChannelInput } from './types';
import * as service from './service';

export const postizChannelRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

postizChannelRouter.get('/events/:eventId/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const result = await service.listChannelsForEvent(
      session.role,
      session.tenantKey,
      req.params.eventId as string,
    );
    res.json({
      ...result,
      _label: 'Postiz channel selection state for event - no secrets returned',
    });
  } catch (err) {
    next(err);
  }
});

postizChannelRouter.post('/events/:eventId/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(selectChannelForEventSchema, {
      ...req.body,
      eventId: req.params.eventId,
    }) as SelectChannelForEventInput;
    const result = await service.selectChannelForEvent(
      session.role,
      session.tenantKey,
      session.humanUserId,
      input,
    );
    res.status(201).json({
      ...result,
      _label: 'Postiz channel selected for event - scheduling still requires approval and readiness gates',
    });
  } catch (err) {
    next(err);
  }
});

postizChannelRouter.delete('/events/:eventId/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = deselectChannelSchema.parse(req.body || {}) as DeselectChannelInput;
    await service.deselectChannelForEvent(
      session.role,
      session.tenantKey,
      session.humanUserId,
      req.params.eventId as string,
      input,
    );
    res.json({
      status: 'deselected',
      _label: 'Postiz channel deselected for event',
    });
  } catch (err) {
    next(err);
  }
});

postizChannelRouter.get('/events/:eventId/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const readiness = await service.getChannelReadinessForEvent(
      session.role,
      session.tenantKey,
      req.params.eventId as string,
    );
    res.json({
      readiness,
      _label: `Channel readiness: ${readiness.state}`,
    });
  } catch (err) {
    next(err);
  }
});

postizChannelRouter.get('/packages/:packageId/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const readiness = await service.getChannelReadinessForPackage(
      session.role,
      session.tenantKey,
      req.params.packageId as string,
    );
    res.json({
      readiness,
      _label: `Channel readiness: ${readiness.state}`,
    });
  } catch (err) {
    next(err);
  }
});
