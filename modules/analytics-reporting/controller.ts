import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as repo from './repository';

export const analyticsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

analyticsRouter.get('/sources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const sources = await repo.listAnalyticsSources();
    res.json(sources);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/snapshots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const snapshots = await repo.listSnapshots({
      tenantKey: payload.tenantKey || 'default',
      sourceId: req.query.sourceId as string | undefined,
    });
    res.json(snapshots);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const reports = await repo.listPerformanceReports({
      tenantKey: payload.tenantKey || 'default',
      campaignId: req.query.campaignId as string | undefined,
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/demo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    res.json({
      impressions: 0,
      reach: 0,
      engagementRate: null,
      bestPlatform: null,
      topContent: null,
      bestTime: null,
      sourceStatus: 'requires_official_connector',
      _label: 'No analytics data is returned until official read-only analytics connectors provide snapshots',
    });
  } catch (err) {
    next(err);
  }
});
