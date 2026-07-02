import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import { validateOrThrow } from '@shared/validation';
import { csvDryRunSchema, csvApproveImportSchema } from './types';

export const csvImportRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

csvImportRouter.post('/dry-run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(csvDryRunSchema, req.body);
    const result = await service.dryRunCsv(payload.role, payload.tenantKey || 'default', payload.sub, input.mappingId, input.eventId, input.rows);
    res.json(result);
  } catch (err) { next(err); }
});

csvImportRouter.post('/approve-import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(csvApproveImportSchema, req.body);
    const result = await service.approveCsvImport(payload.role, payload.tenantKey || 'default', payload.sub, input.mappingId, input.eventId, input.notes);
    res.json(result);
  } catch (err) { next(err); }
});
