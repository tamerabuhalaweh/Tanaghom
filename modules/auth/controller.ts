import { Router, Request, Response, NextFunction } from 'express';
import { login, getSession } from '../service';
import { validateLoginInput } from '../validators';

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
