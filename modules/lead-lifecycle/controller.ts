import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import * as validators from './validators';
import type { LeadStatus } from './types';

export const leadLifecycleRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

leadLifecycleRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const leads = await service.listLeads(
      payload.role, payload.tenantKey || 'default',
      req.query.eventId as string | undefined,
      req.query.status as LeadStatus | undefined,
    );
    res.json(leads);
  } catch (err) { next(err); }
});

leadLifecycleRouter.get('/dashboard/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const dashboard = await service.getEventDashboard(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(dashboard);
  } catch (err) { next(err); }
});

leadLifecycleRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const lead = await service.getLead(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateLead(req.body);
    const lead = await service.createLead(payload.role, payload.tenantKey || 'default', payload.sub, payload.sub, input);
    res.status(201).json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateLead(req.body);
    const lead = await service.updateLead(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateTransitionLead(req.body);
    const lead = await service.transitionLead(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.post('/:id/meeting', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateMeeting(req.body);
    const lead = await service.updateMeeting(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.post('/:id/purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdatePurchase(req.body);
    const lead = await service.updatePurchase(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(lead);
  } catch (err) { next(err); }
});

leadLifecycleRouter.post('/:id/temperature', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateSetTemperature(req.body);
    const lead = await service.setTemperature(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(lead);
  } catch (err) { next(err); }
});
