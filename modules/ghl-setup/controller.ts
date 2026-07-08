import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { LEAD_STATUSES, LEAD_TEMPERATURES } from '../lead-lifecycle/types';
import * as service from './service';

export const ghlSetupRouter = Router();

const tagTargetValues = [...LEAD_STATUSES, ...LEAD_TEMPERATURES] as [string, ...string[]];
const leadStatusValues = [...LEAD_STATUSES] as [string, ...string[]];

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

ghlSetupRouter.get('/wizard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const state = await service.getWizardState(payload.role, tenantKey);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.get('/credential-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const state = await service.getWizardState(payload.role, tenantKey);
    res.json({
      credentialStatus: state.credentialStatus,
      rawSecretsReturned: false,
    });
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.get('/mapping-readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const state = await service.getWizardState(payload.role, tenantKey);
    res.json({
      mappingReadiness: state.mappingReadiness,
      liveWriteBlocked: state.liveWriteBlocked,
      blockReason: state.blockReason,
    });
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.post('/test-connection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const result = await service.testGhlConnection(payload.role, payload.sub, tenantKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.post('/validate-mappings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const result = await service.validateMappingAcceptance(payload.role, tenantKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.post('/live-validation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const result = await service.validateGhlLiveCredentials(payload.role, payload.sub, tenantKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const tagMappingSchema = z.object({
  ghlTagId: z.string().min(1),
  ghlTagName: z.string().min(1),
  internalTag: z.enum(tagTargetValues),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).default('bidirectional'),
});

ghlSetupRouter.post('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const mappings = z.array(tagMappingSchema).parse(req.body.mappings);
    const result = await service.saveTagMappings(payload.role, payload.sub, tenantKey, mappings);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const pipelineMappingSchema = z.object({
  ghlPipelineId: z.string().min(1),
  ghlPipelineName: z.string().min(1),
  ghlStageId: z.string().min(1),
  ghlStageName: z.string().min(1),
  internalStage: z.enum(leadStatusValues),
});

ghlSetupRouter.post('/pipelines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const mappings = z.array(pipelineMappingSchema).parse(req.body.mappings);
    const result = await service.savePipelineMappings(payload.role, payload.sub, tenantKey, mappings);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const locationMappingSchema = z.object({
  ghlLocationId: z.string().min(1),
  displayName: z.string().min(1).max(160),
});

ghlSetupRouter.post('/location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const input = locationMappingSchema.parse(req.body);
    const result = await service.saveLocationMapping(payload.role, payload.sub, tenantKey, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

ghlSetupRouter.post('/write', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const result = await service.attemptLiveWrite(payload.role, tenantKey);
    res.status(403).json({
      status: 'blocked',
      ...result,
      _label: 'GHL live write blocked - no CRM writes authorized',
    });
  } catch (err) {
    next(err);
  }
});
