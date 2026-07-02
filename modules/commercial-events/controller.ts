import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  updateEventStrategy,
  transitionEvent,
  linkCampaign,
  linkLead,
  getEventDashboard,
  listEventCampaigns,
  listEventLeads,
  createEventKpiRecord,
  updateEventKpiRecord,
} from './service';
import {
  validateCreateEvent,
  validateUpdateEvent,
  validateUpdateStrategy,
  validateTransitionEvent,
  validateLinkCampaign,
  validateLinkLead,
  validateCreateKpiRecord,
  validateUpdateKpiRecord,
} from './validators';
import type { CommercialEventStatus } from './types';

export const commercialEventsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

commercialEventsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const events = await listEvents(
      payload.role,
      payload.tenantKey || 'default',
      req.query.status as CommercialEventStatus | undefined,
      req.query.eventType as string | undefined,
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.get('/:id/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const dashboard = await getEventDashboard(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.get('/:id/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const campaigns = await listEventCampaigns(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.get('/:id/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const leads = await listEventLeads(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(leads);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.post('/:id/kpis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateKpiRecord(req.body);
    const record = await createEventKpiRecord(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.put('/:id/kpis/:kpiId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateKpiRecord(req.body);
    const record = await updateEventKpiRecord(
      payload.role,
      payload.tenantKey || 'default',
      payload.sub,
      req.params.id as string,
      req.params.kpiId as string,
      input,
    );
    res.json(record);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const event = await getEvent(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateEvent(req.body);
    const event = await createEvent(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateEvent(req.body);
    const event = await updateEvent(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.put('/:id/strategy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateStrategy(req.body);
    const event = await updateEventStrategy(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateTransitionEvent(req.body);
    const event = await transitionEvent(
      payload.role,
      payload.tenantKey || 'default',
      payload.sub,
      req.params.id as string,
      input.toStatus,
      input.reason,
    );
    res.json(event);
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.post('/:id/link-campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateLinkCampaign(req.body);
    await linkCampaign(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input.campaignId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

commercialEventsRouter.post('/:id/link-lead', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateLinkLead(req.body);
    await linkLead(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input.leadId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
