import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { getCommercialWorkflowEvidence } from './evidence';
import {
  getCommercialWorkflowSnapshot,
  listCommercialWorkflowRuns,
  startCommercialWorkflowRun,
  syncCommercialWorkflowRunById,
} from './run-service';

export const commercialWorkflowRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

commercialWorkflowRouter.get('/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const campaignId = z.string().uuid().optional().parse(req.query.campaignId);
    const state = await getCommercialWorkflowSnapshot(session, campaignId);
    res.json({
      ...state,
      _label: 'Commercial/Social workflow state synchronized to a tenant-scoped STITCH WorkflowRun',
    });
  } catch (err) {
    next(err);
  }
});

commercialWorkflowRouter.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const runs = await listCommercialWorkflowRuns(session);
    res.json({
      runs,
      _label: 'Tenant-scoped Commercial/Social WorkflowRuns',
    });
  } catch (err) {
    next(err);
  }
});

commercialWorkflowRouter.post('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const input = z.object({
      campaignId: z.string().uuid().optional(),
    }).parse(req.body || {});
    const snapshot = await startCommercialWorkflowRun(session, input.campaignId);
    res.status(snapshot.workflowRun ? 201 : 200).json({
      ...snapshot,
      _label: snapshot.workflowRun
        ? 'Commercial/Social WorkflowRun started or synchronized'
        : 'No campaign exists yet; create a campaign before a WorkflowRun can be started',
    });
  } catch (err) {
    next(err);
  }
});

commercialWorkflowRouter.get('/runs/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const campaignId = z.string().uuid().optional().parse(req.query.campaignId);
    const snapshot = await getCommercialWorkflowSnapshot(session, campaignId);
    res.json({
      ...snapshot,
      _label: 'Current tenant-scoped Commercial/Social WorkflowRun',
    });
  } catch (err) {
    next(err);
  }
});

commercialWorkflowRouter.post('/runs/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const runId = z.string().uuid().parse(req.params.id);
    const run = await syncCommercialWorkflowRunById(session, runId);
    res.json({
      run,
      _label: 'Commercial/Social WorkflowRun synchronized from backend source records',
    });
  } catch (err) {
    next(err);
  }
});

commercialWorkflowRouter.get('/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const campaignId = z.string().uuid().optional().parse(req.query.campaignId);
    const evidence = await getCommercialWorkflowEvidence(session, campaignId);
    res.json(evidence);
  } catch (err) {
    next(err);
  }
});
