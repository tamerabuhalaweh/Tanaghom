import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  validateAssessmentFindingDecision,
  validateAssessmentPreview,
  validateCreateAssessmentRun,
  validateListAssessmentRuns,
} from './validators';

export const commercialHistoricalAssessmentRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function session(payload: JwtPayload) {
  return { role: payload.role, tenantKey: payload.tenantKey || 'default', userId: payload.sub };
}

commercialHistoricalAssessmentRouter.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.previewAssessment(context.role, context.tenantKey, validateAssessmentPreview(req.body)));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.get('/learning-sets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.listLearningSets(context.role, context.tenantKey));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.post('/findings/:id/decision', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.decideFinding(
      context.role,
      context.tenantKey,
      context.userId,
      String(req.params.id),
      validateAssessmentFindingDecision(req.body),
    ));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.listAssessments(context.role, context.tenantKey, validateListAssessmentRuns(req.query)));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.status(201).json(await service.createAssessment(
      context.role,
      context.tenantKey,
      context.userId,
      validateCreateAssessmentRun(req.body),
    ));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.getAssessment(context.role, context.tenantKey, String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

commercialHistoricalAssessmentRouter.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = session(getPayload(req));
    res.json(await service.generateAssessment(context.role, context.tenantKey, context.userId, String(req.params.id)));
  } catch (error) {
    next(error);
  }
});
