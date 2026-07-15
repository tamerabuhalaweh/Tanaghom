import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateArchiveExecutionLink,
  validateArchiveLearning,
  validateAssignPlan,
  validateLinkCampaign,
  validateLinkEvent,
  validateLinkLearning,
  validateSupersedePlan,
  validateUnlinkParent,
} from './validators';

export const commercialPlanHierarchyRouter = Router();

type Context = { role: string; tenantKey: string; userId: string };

function context(req: Request): Context {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
  const payload: JwtPayload = verifyToken(header.substring(7));
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

commercialPlanHierarchyRouter.get('/orphans', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.listOrphanPlans(auth.role, auth.tenantKey));
}));

commercialPlanHierarchyRouter.get('/plans/:planId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.getPlanHierarchy(auth.role, auth.tenantKey, String(req.params.planId)));
}));

commercialPlanHierarchyRouter.get('/annual-plans/:annualPlanId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.getAnnualHierarchy(auth.role, auth.tenantKey, String(req.params.annualPlanId)));
}));

commercialPlanHierarchyRouter.get('/events/:eventId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.getEventHierarchy(auth.role, auth.tenantKey, String(req.params.eventId)));
}));

commercialPlanHierarchyRouter.get('/campaigns/:campaignId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.getCampaignHierarchy(auth.role, auth.tenantKey, String(req.params.campaignId)));
}));

commercialPlanHierarchyRouter.get('/learning/:learningSetId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.getLearningHierarchy(auth.role, auth.tenantKey, String(req.params.learningSetId)));
}));

commercialPlanHierarchyRouter.put('/plans/:planId/parent', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.assignPlan(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateAssignPlan(req.body),
  ));
}));

commercialPlanHierarchyRouter.delete('/plans/:planId/parent', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.unlinkParent(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateUnlinkParent(req.body),
  ));
}));

commercialPlanHierarchyRouter.post('/plans/:planId/events', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(await service.linkEvent(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateLinkEvent(req.body),
  ));
}));

commercialPlanHierarchyRouter.delete('/plans/:planId/events/:eventId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.archiveEventLink(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    String(req.params.eventId),
    validateArchiveExecutionLink(req.body),
  ));
}));

commercialPlanHierarchyRouter.post('/plans/:planId/campaigns', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(await service.linkCampaign(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateLinkCampaign(req.body),
  ));
}));

commercialPlanHierarchyRouter.delete('/plans/:planId/campaigns/:campaignId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.archiveCampaignLink(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    String(req.params.campaignId),
    validateArchiveExecutionLink(req.body),
  ));
}));

commercialPlanHierarchyRouter.post('/plans/:planId/learning', route(async (req, res) => {
  const auth = context(req);
  res.status(201).json(await service.linkLearning(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateLinkLearning(req.body),
  ));
}));

commercialPlanHierarchyRouter.delete('/plans/:planId/learning/:findingId', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.archiveLearning(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    String(req.params.findingId),
    validateArchiveLearning(req.body),
  ));
}));

commercialPlanHierarchyRouter.post('/plans/:planId/supersede', route(async (req, res) => {
  const auth = context(req);
  res.json(await service.supersedePlan(
    auth.role,
    auth.tenantKey,
    auth.userId,
    String(req.params.planId),
    validateSupersedePlan(req.body),
  ));
}));

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}
