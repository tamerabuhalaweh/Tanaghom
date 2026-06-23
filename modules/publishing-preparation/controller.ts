import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as repo from './repository';

export const publishingPrepRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

publishingPrepRouter.get('/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const packages = await repo.listPackages({
      campaignId: req.query.campaignId as string | undefined,
      packageStatus: req.query.status as string | undefined,
    });
    res.json(packages);
  } catch (err) {
    next(err);
  }
});

publishingPrepRouter.get('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const pkg = await repo.getPackageById(req.params.id as string);
    res.json(pkg);
  } catch (err) {
    next(err);
  }
});

publishingPrepRouter.get('/packages/:id/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const checks = await repo.listReadinessChecks(req.params.id as string);
    res.json(checks);
  } catch (err) {
    next(err);
  }
});
