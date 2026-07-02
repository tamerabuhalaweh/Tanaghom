import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import * as validators from './validators';
import type { ProblemStatus } from './types';

export const eventProblemLogRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

eventProblemLogRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const problems = await service.listProblems(
      payload.role, payload.tenantKey || 'default',
      req.query.eventId as string | undefined,
      req.query.status as ProblemStatus | undefined,
    );
    res.json(problems);
  } catch (err) { next(err); }
});

eventProblemLogRouter.get('/dashboard/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const dashboard = await service.getProblemDashboard(payload.role, payload.tenantKey || 'default', req.params.eventId as string);
    res.json(dashboard);
  } catch (err) { next(err); }
});

eventProblemLogRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const problem = await service.getProblem(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(problem);
  } catch (err) { next(err); }
});

eventProblemLogRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateCreateProblem(req.body);
    const problem = await service.createProblem(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(problem);
  } catch (err) { next(err); }
});

eventProblemLogRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateUpdateProblem(req.body);
    const problem = await service.updateProblem(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(problem);
  } catch (err) { next(err); }
});

eventProblemLogRouter.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validators.validateTransitionProblem(req.body);
    const problem = await service.transitionProblem(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(problem);
  } catch (err) { next(err); }
});
