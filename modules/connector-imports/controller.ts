import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import { validateOrThrow } from '@shared/validation';
import { createImportJobSchema, markReadySchema, disableJobSchema } from './types';

export const connectorImportsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

connectorImportsRouter.get('/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const readiness = await service.getReadiness(payload.role, payload.tenantKey || 'default');
    res.json(readiness);
  } catch (err) { next(err); }
});

connectorImportsRouter.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const requirements = await service.getRequirements(payload.role);
    res.json(requirements);
  } catch (err) { next(err); }
});

connectorImportsRouter.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const jobs = await service.listJobs(payload.role, payload.tenantKey || 'default', req.query.eventId as string | undefined);
    res.json(jobs);
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(createImportJobSchema, req.body);
    const job = await service.createJob(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(job);
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs/:id/mark-ready', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(markReadySchema, req.body);
    const job = await service.markReady(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input.testPassed ?? true, input.notes);
    res.json(job);
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(disableJobSchema, req.body);
    const job = await service.disableJob(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input.reason);
    res.json(job);
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/dry-run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { connectorId, eventId } = req.body;
    const result = await service.dryRun(payload.role, payload.tenantKey || 'default', connectorId, eventId);
    res.json(result);
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/approve-import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { connectorId, eventId, notes } = req.body;
    const result = await service.approveAndImport(payload.role, payload.tenantKey || 'default', payload.sub, connectorId, eventId, notes);
    res.json(result);
  } catch (err) { next(err); }
});
