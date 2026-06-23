import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as repo from './repository';

export const spineRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

spineRouter.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const runs = await repo.listSpineRuns({
      runStatus: req.query.status as string | undefined,
      runType: req.query.type as string | undefined,
    });
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

spineRouter.get('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const run = await repo.getSpineRunById(req.params.id as string);
    res.json(run);
  } catch (err) {
    next(err);
  }
});

spineRouter.get('/runs/:id/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const artifacts = await repo.listSpineArtifacts({ runId: req.params.id as string });
    res.json(artifacts);
  } catch (err) {
    next(err);
  }
});
