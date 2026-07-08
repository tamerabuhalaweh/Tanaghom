import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ValidationError } from '@shared/errors';
import * as service from './service';
import { COMMERCIAL_DISCIPLINES, type CommercialDisciplineId } from './types';
import {
  validateCreateDisciplineRecord,
  validateListDisciplineRecordsQuery,
  validateUpdateDisciplineRecord,
} from './validators';

export const commercialDisciplinesRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function session(payload: JwtPayload) {
  return {
    role: payload.role,
    tenantKey: payload.tenantKey || 'default',
    userId: payload.sub,
  };
}

commercialDisciplinesRouter.get('/workspaces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.listWorkspaces(context.role, context.tenantKey));
  } catch (err) {
    next(err);
  }
});

commercialDisciplinesRouter.get('/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const filters = validateListDisciplineRecordsQuery(req.query);
    res.json(await service.listRecords(context.role, context.tenantKey, filters));
  } catch (err) {
    next(err);
  }
});

commercialDisciplinesRouter.post('/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateCreateDisciplineRecord(req.body);
    res.status(201).json(await service.createRecord(context.role, context.tenantKey, context.userId, input));
  } catch (err) {
    next(err);
  }
});

commercialDisciplinesRouter.put('/records/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const input = validateUpdateDisciplineRecord(req.body);
    res.json(await service.updateRecord(context.role, context.tenantKey, context.userId, String(req.params.id), input));
  } catch (err) {
    next(err);
  }
});

commercialDisciplinesRouter.get('/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    const discipline = req.query.discipline ? parseDiscipline(String(req.query.discipline)) : undefined;
    res.json(await service.getWorkspaceContext(context.role, context.tenantKey, discipline));
  } catch (err) {
    next(err);
  }
});

function parseDiscipline(value: string): CommercialDisciplineId {
  if (COMMERCIAL_DISCIPLINES.includes(value as CommercialDisciplineId)) return value as CommercialDisciplineId;
  throw new ValidationError(`Unknown commercial discipline: ${value}`);
}
