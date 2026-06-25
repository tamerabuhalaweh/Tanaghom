import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  submitForApproval,
  getApproval,
  getApprovalDecisionPacket,
  listApprovals,
  approve,
  reject,
  requestChanges,
} from './service';

export const approvalsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getId(req: Request): string {
  const id = req.params.id;
  if (Array.isArray(id)) throw new Error('Invalid id');
  return id;
}

approvalsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const approvals = await listApprovals(payload.role, {
      targetId: req.query.targetId as string | undefined,
      targetType: req.query.targetType as string | undefined,
      approvalStatus: req.query.status as string | undefined,
      requesterUserId: req.query.requesterId as string | undefined,
      approverUserId: req.query.approverId as string | undefined,
      requiredDepartment: req.query.department as string | undefined,
    });
    res.json(approvals);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const approval = await getApproval(payload.role, getId(req));
    res.json(approval);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.get('/:id/decision-packet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const packet = await getApprovalDecisionPacket(payload.role, getId(req));
    res.json(packet);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const approval = await submitForApproval(payload.role, {
      ...req.body,
      requesterUserId: payload.sub,
      requesterAgentRepId: payload.agentRepId || '',
    });
    res.status(201).json(approval);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await approve(
      payload.role,
      getId(req),
      payload.sub,
      payload.agentRepId || '',
      'governance',
      { ...req.body, approverUserId: payload.sub, approverAgentRepId: payload.agentRepId || '' },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await reject(
      payload.role,
      getId(req),
      payload.sub,
      payload.agentRepId || '',
      'governance',
      { ...req.body, approverUserId: payload.sub, approverAgentRepId: payload.agentRepId || '' },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:id/request-changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await requestChanges(
      payload.role,
      getId(req),
      payload.sub,
      payload.agentRepId || '',
      'governance',
      { ...req.body, approverUserId: payload.sub, approverAgentRepId: payload.agentRepId || '' },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
