import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import * as validators from './validators';

export const eventCampaignPlannerRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

// Email Plans
eventCampaignPlannerRouter.get('/events/:eventId/email-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plans = await service.listEmailPlans(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(plans);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.get('/email-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plan = await service.getEmailPlan(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.post('/email-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateEmailPlan(req.body);
    const plan = await service.createEmailPlan(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.put('/email-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateEmailPlan(req.body);
    const plan = await service.updateEmailPlan(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(plan);
  } catch (err) { next(err); }
});

// WhatsApp Plans
eventCampaignPlannerRouter.get('/events/:eventId/whatsapp-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plans = await service.listWhatsappPlans(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(plans);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.get('/whatsapp-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plan = await service.getWhatsappPlan(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.post('/whatsapp-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateWhatsappPlan(req.body);
    const plan = await service.createWhatsappPlan(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.put('/whatsapp-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateWhatsappPlan(req.body);
    const plan = await service.updateWhatsappPlan(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(plan);
  } catch (err) { next(err); }
});

// Upsell Plans
eventCampaignPlannerRouter.get('/events/:eventId/upsell-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plans = await service.listUpsellPlans(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(plans);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.get('/upsell-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const plan = await service.getUpsellPlan(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.post('/upsell-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateUpsellPlan(req.body);
    const plan = await service.createUpsellPlan(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.put('/upsell-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateUpsellPlan(req.body);
    const plan = await service.updateUpsellPlan(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(plan);
  } catch (err) { next(err); }
});

// Content Requirements
eventCampaignPlannerRouter.get('/events/:eventId/content-requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const requirements = await service.listContentRequirements(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(requirements);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.get('/content-requirements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const requirement = await service.getContentRequirement(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(requirement);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.post('/content-requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateContentRequirement(req.body);
    const requirement = await service.createContentRequirement(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(requirement);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.put('/content-requirements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateContentRequirement(req.body);
    const requirement = await service.updateContentRequirement(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(requirement);
  } catch (err) { next(err); }
});

// Sales Tasks
eventCampaignPlannerRouter.get('/events/:eventId/sales-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tasks = await service.listSalesTasks(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(tasks);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.get('/sales-tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const task = await service.getSalesTask(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(task);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.post('/sales-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateSalesTask(req.body);
    const task = await service.createSalesTask(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(task);
  } catch (err) { next(err); }
});

eventCampaignPlannerRouter.put('/sales-tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateSalesTask(req.body);
    const task = await service.updateSalesTask(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(task);
  } catch (err) { next(err); }
});
