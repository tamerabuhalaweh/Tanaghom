import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ValidationError } from '@shared/errors';
import * as service from './service';
import { COMMERCIAL_REVENUE_LINE_TYPES, type CommercialRevenueLineType } from './types';
import {
  validateCreateAssessmentSignal,
  validateCreateCommercialPlan,
  validateCreateRevenueLine,
  validateDashboardQuery,
  validateListAssessmentSignalsQuery,
  validateListPlansQuery,
  validateUpdateCommercialPlan,
} from './validators';

export const commercialCommandCenterRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function session(payload: JwtPayload) {
  return {
    role: payload.role,
    tenantKey: payload.tenantKey || 'default',
    userId: payload.sub,
  };
}

commercialCommandCenterRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateDashboardQuery(req.query);
    const dashboard = await service.getCommercialCommandCenterDashboard(context.role, context.tenantKey, query);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.get('/revenue-lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const lines = await service.listRevenueLines(context.role, context.tenantKey);
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.get('/revenue-lines/:revenueLineType/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const dashboard = await service.getRevenueLineDashboard(context.role, context.tenantKey, parseRevenueLineType(String(req.params.revenueLineType)));
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.post('/revenue-lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateRevenueLine(req.body);
    const line = await service.createRevenueLine(context.role, context.tenantKey, context.userId, input);
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateListPlansQuery(req.query);
    const plans = await service.listPlans(context.role, context.tenantKey, query);
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateCommercialPlan(req.body);
    const plan = await service.createPlan(context.role, context.tenantKey, context.userId, input);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.put('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateUpdateCommercialPlan(req.body);
    const plan = await service.updatePlan(context.role, context.tenantKey, context.userId, String(req.params.id), input);
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.get('/assessment-signals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateListAssessmentSignalsQuery(req.query);
    const signals = await service.listAssessmentSignals(context.role, context.tenantKey, query);
    res.json(signals);
  } catch (err) {
    next(err);
  }
});

commercialCommandCenterRouter.post('/assessment-signals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateAssessmentSignal(req.body);
    const signal = await service.createAssessmentSignal(context.role, context.tenantKey, context.userId, input);
    res.status(201).json(signal);
  } catch (err) {
    next(err);
  }
});

function parseRevenueLineType(value: string): CommercialRevenueLineType {
  if (COMMERCIAL_REVENUE_LINE_TYPES.includes(value as CommercialRevenueLineType)) {
    return value as CommercialRevenueLineType;
  }
  throw new ValidationError(`Unknown commercial revenue line type: ${value}`);
}
