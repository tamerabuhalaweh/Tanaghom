import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { createImportJobSchema, markReadySchema, disableJobSchema, CONNECTOR_REQUIREMENTS, SUPPORTED_CONNECTORS } from './types';
import * as service from './service';

export const connectorImportsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

connectorImportsRouter.get('/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const readiness = service.getReadiness(payload.role, tenantKey);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'connector_readiness_viewed', object_type: 'connector_imports', object_id: tenantKey, result: 'success' },
      'Connector readiness viewed',
    );
    res.json({ ...readiness, rawSecretsReturned: false, _label: 'Connector import readiness for this tenant' });
  } catch (err) { next(err); }
});

connectorImportsRouter.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    void payload;
    const requirements = Object.entries(CONNECTOR_REQUIREMENTS).map(([connectorId, req]) => ({
      connectorId,
      ...req,
    }));
    res.json({ connectors: requirements, supportedConnectors: SUPPORTED_CONNECTORS, rawSecretsReturned: false, _label: 'Connector import requirements' });
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const input = createImportJobSchema.parse(req.body);
    const job = service.createImportJob(payload.role, tenantKey, payload.sub, input);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'connector_import_job_created', object_type: 'connector_import_job', object_id: job.id, result: 'success' },
      `Connector import job created for ${input.connectorId}`,
    );
    res.status(201).json({ job, rawSecretsReturned: false, _label: 'Connector import job created' });
  } catch (err) { next(err); }
});

connectorImportsRouter.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const jobs = service.listImportJobs(payload.role, tenantKey);
    res.json({ jobs, rawSecretsReturned: false, _label: 'Connector import jobs for this tenant' });
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs/:id/mark-ready', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const input = markReadySchema.parse(req.body);
    const job = service.markJobReady(payload.role, tenantKey, req.params.id as string, input);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'connector_import_job_marked_ready', object_type: 'connector_import_job', object_id: job.id, result: 'success' },
      `Connector import job ${job.id} marked ${input.testPassed ? 'test_passed' : 'blocked'}`,
    );
    res.json({ job, rawSecretsReturned: false, _label: `Connector import job marked ${job.state}` });
  } catch (err) { next(err); }
});

connectorImportsRouter.post('/jobs/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const input = disableJobSchema.parse(req.body);
    const job = service.disableJob(payload.role, tenantKey, req.params.id as string, input);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'connector_import_job_disabled', object_type: 'connector_import_job', object_id: job.id, result: 'success' },
      `Connector import job ${job.id} disabled: ${input.reason}`,
    );
    res.json({ job, rawSecretsReturned: false, _label: 'Connector import job disabled' });
  } catch (err) { next(err); }
});
