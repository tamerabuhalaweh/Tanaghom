import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createOnboardingToken, acceptOnboardingToken, login, getSession } from './service';
import { validateLoginInput } from './validators';
import { verifyToken } from '@shared/auth';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validateLoginInput(req.body);
    const result = await login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
      return;
    }

    const token = authHeader.substring(7);
    const user = await getSession(token);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/onboarding-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
      return;
    }
    const payload = verifyToken(authHeader.substring(7));
    const input = z.object({
      userId: z.string().uuid(),
      purpose: z.enum(['invite', 'password_reset']).default('invite'),
    }).parse(req.body);
    const token = await createOnboardingToken({
      requesterRole: payload.role,
      requesterUserId: payload.sub,
      userId: input.userId,
      purpose: input.purpose,
    });
    res.status(201).json({
      ...token,
      _label: 'One-time onboarding token created. Raw token is returned once and should be delivered through an approved channel.',
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/accept-onboarding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      token: z.string().min(24),
      password: z.string().min(8),
    }).parse(req.body);
    const result = await acceptOnboardingToken(input);
    res.json({
      ...result,
      _label: 'Password set successfully. User can now sign in.',
    });
  } catch (err) {
    next(err);
  }
});
