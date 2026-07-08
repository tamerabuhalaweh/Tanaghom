import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateCreateExecutiveReportPreview,
  validateCreateExecutiveReportSchedule,
  validateExecutiveDashboardQuery,
  validateListExecutiveReportsQuery,
  validateListExecutiveReportSchedulesQuery,
} from './validators';

export const commercialExecutiveReportingRouter = Router();

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

commercialExecutiveReportingRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateExecutiveDashboardQuery(req.query);
    res.json(await service.getDashboard(context.role, context.tenantKey, query));
  } catch (err) {
    next(err);
  }
});

commercialExecutiveReportingRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateListExecutiveReportsQuery(req.query);
    res.json(await service.listReports(context.role, context.tenantKey, query));
  } catch (err) {
    next(err);
  }
});

commercialExecutiveReportingRouter.post('/reports/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateExecutiveReportPreview(req.body);
    res.status(201).json(await service.createReportPreview(context.role, context.tenantKey, context.userId, input));
  } catch (err) {
    next(err);
  }
});

commercialExecutiveReportingRouter.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const query = validateListExecutiveReportSchedulesQuery(req.query);
    res.json(await service.listSchedules(context.role, context.tenantKey, query));
  } catch (err) {
    next(err);
  }
});

commercialExecutiveReportingRouter.post('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateExecutiveReportSchedule(req.body);
    res.status(201).json(await service.createSchedule(context.role, context.tenantKey, context.userId, input));
  } catch (err) {
    next(err);
  }
});
