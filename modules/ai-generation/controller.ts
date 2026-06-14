import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { generateDrafts, reviseDraft } from '../service';
import { validateGenerateDraft, validateReviseDraft } from '../validators';

export const aiGenerationRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

aiGenerationRouter.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateGenerateDraft(req.body);
    const drafts = await generateDrafts(payload.role, payload.sub, input);
    res.status(201).json(drafts);
  } catch (err) {
    next(err);
  }
});

aiGenerationRouter.post('/revise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateReviseDraft(req.body);
    const draft = await reviseDraft(payload.role, payload.sub, input);
    res.json(draft);
  } catch (err) {
    next(err);
  }
});
