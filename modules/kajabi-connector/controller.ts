import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';

export const kajabiConnectorRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

kajabiConnectorRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await service.getKajabiStatus(payload.role, payload.tenantKey || 'default');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

kajabiConnectorRouter.post('/validate-read-access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const result = await service.validateKajabiReadAccess(payload.role, payload.tenantKey || 'default', payload.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
