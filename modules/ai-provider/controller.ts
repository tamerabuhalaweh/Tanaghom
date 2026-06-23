import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { getProviderStatus } from '@shared/providers/llm-provider';

export const aiProviderRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireAdmin(role: string): void {
  if (role !== 'admin' && role !== 'cco') {
    throw new ForbiddenError('Admin access required');
  }
}

aiProviderRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const providerType = process.env.LLM_PROVIDER || 'mock';
    const providers = [
      { name: 'Mock LLM', type: 'mock', configured: true, model: 'mock-v1', apiKeyStatus: 'configured' as const },
      { name: 'OpenAI', type: 'openai', configured: !!process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o', apiKeyStatus: process.env.OPENAI_API_KEY ? 'configured' as const : 'missing' as const },
      { name: 'Claude', type: 'claude', configured: !!process.env.CLAUDE_API_KEY, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514', apiKeyStatus: process.env.CLAUDE_API_KEY ? 'configured' as const : 'missing' as const },
    ];

    res.json({ activeProvider: providerType, providers });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const status = getProviderStatus();
    res.json({ ...status, _label: status.type === 'mock' ? 'Mock Provider — No external API calls' : `${status.name} — Live provider` });
  } catch (err) {
    next(err);
  }
});
