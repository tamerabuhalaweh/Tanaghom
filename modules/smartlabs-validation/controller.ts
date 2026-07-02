import { Router, Request, Response, NextFunction } from 'express';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { validateTenantSmartLabs } from './service';

export const smartlabsValidationRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

function requireConnectorRole(role: string): void {
  if (!['admin', 'cco', 'department_head', 'specialist', 'reviewer'].includes(role)) {
    throw new ForbiddenError('SmartLabs validation access requires an authorized product role');
  }
}

smartlabsValidationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const summary = await validateTenantSmartLabs(session.tenantKey, session.humanUserId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
