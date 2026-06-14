import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { scoreDraft, getRules, addRule, markRuleReviewed, getStaleRules } from './service';
import { validateScoreDraft, validateAddRule } from './validators';

export const algoRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

algoRouter.post('/score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateScoreDraft(req.body);
    const score = await scoreDraft(payload.role, payload.sub, input);
    res.json(score);
  } catch (err) { next(err); }
});

algoRouter.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const rules = await getRules(payload.role, req.query.platform as string | undefined);
    res.json(rules);
  } catch (err) { next(err); }
});

algoRouter.post('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateAddRule(req.body);
    const rule = await addRule(payload.role, payload.sub, input);
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

algoRouter.post('/rules/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const rule = await markRuleReviewed(payload.role, payload.sub, req.params.id as string);
    res.json(rule);
  } catch (err) { next(err); }
});

algoRouter.get('/rules/stale', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const rules = await getStaleRules(payload.role, req.query.platform as string | undefined);
    res.json(rules);
  } catch (err) { next(err); }
});
