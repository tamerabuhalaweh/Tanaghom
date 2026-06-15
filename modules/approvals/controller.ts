import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  submitForApproval,
  recordApprovalDecision,
  getApprovalStatus,
  getPendingApprovalsForReviewer,
  checkSlaCompliance,
} from './service';
import {
  validateSubmitForApproval,
  validateApprovalDecision,
} from './validators';

export const approvalsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

approvalsRouter.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateSubmitForApproval(req.body);
    const status = await submitForApproval(payload.role, payload.sub, input);
    res.status(201).json(status);
  } catch (err) { next(err); }
});

approvalsRouter.post('/decide', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateApprovalDecision(req.body);
    const status = await recordApprovalDecision(payload.role, payload.sub, input);
    res.json(status);
  } catch (err) { next(err); }
});

approvalsRouter.get('/status/:contentItemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const _payload = getPayload(req);
    const status = await getApprovalStatus(_payload.role, req.params.contentItemId as string);
    res.json(status);
  } catch (err) { next(err); }
});

approvalsRouter.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const pending = await getPendingApprovalsForReviewer(payload.role, payload.sub);
    res.json(pending);
  } catch (err) { next(err); }
});

approvalsRouter.get('/sla', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req); // Verify authentication
    const sla = await checkSlaCompliance();
    res.json(sla);
  } catch (err) { next(err); }
});
