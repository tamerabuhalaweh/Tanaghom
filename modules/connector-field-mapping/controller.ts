import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import { validateOrThrow } from '@shared/validation';
import { createFieldMappingSchema, updateFieldMappingSchema } from './types';

export const connectorFieldMappingRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

connectorFieldMappingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const mappings = await service.listMappings(payload.role, payload.tenantKey || 'default', req.query.connectorId as string | undefined);
    res.json(mappings);
  } catch (err) { next(err); }
});

connectorFieldMappingRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const mapping = await service.getMapping(payload.role, payload.tenantKey || 'default', req.params.id as string);
    res.json(mapping);
  } catch (err) { next(err); }
});

connectorFieldMappingRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(createFieldMappingSchema, req.body);
    const mapping = await service.createMapping(payload.role, payload.tenantKey || 'default', payload.sub, input);
    res.status(201).json(mapping);
  } catch (err) { next(err); }
});

connectorFieldMappingRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateOrThrow(updateFieldMappingSchema, req.body);
    const mapping = await service.updateMapping(payload.role, payload.tenantKey || 'default', payload.sub, req.params.id as string, input);
    res.json(mapping);
  } catch (err) { next(err); }
});

connectorFieldMappingRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    await service.deleteMapping(payload.role, payload.tenantKey || 'default', req.params.id as string, payload.sub);
    res.status(204).send();
  } catch (err) { next(err); }
});
