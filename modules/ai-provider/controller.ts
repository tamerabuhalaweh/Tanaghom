import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { AppError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { decryptSecret, encryptSecret, secretFingerprint } from '@shared/crypto/secret-vault';
import { createConfiguredLLMProvider, type LLMProvider } from '@shared/providers/llm-provider';

export const aiProviderRouter = Router();

type LLMProviderType = 'openai' | 'claude' | 'deepseek';
type SelectableProviderType = 'mock' | LLMProviderType;

const providerSchema = z.enum(['mock', 'openai', 'claude', 'deepseek']);
const credentialProviderSchema = z.enum(['openai', 'claude', 'deepseek']);

const upsertCredentialSchema = z.object({
  provider: credentialProviderSchema,
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(12).max(10000),
});

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

aiProviderRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);

    const userCredentials = await listSafeCredentials(payload.sub);
    const activeProvider = await getUserSelectedProvider(payload.sub);
    const envProviderType = process.env.LLM_PROVIDER || 'mock';
    const mockAllowed = isMockLLMAllowed();
    const providers = [
      { name: 'Mock LLM', type: 'mock', configured: mockAllowed, model: 'mock-v1', apiKeyStatus: mockAllowed ? 'configured' as const : 'missing' as const, scope: 'development_only' },
      providerStatus('OpenAI', 'openai', userCredentials, process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || 'gpt-4o'),
      providerStatus('Claude', 'claude', userCredentials, process.env.CLAUDE_API_KEY, process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'),
      providerStatus('DeepSeek', 'deepseek', userCredentials, process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'),
    ];

    res.json({
      activeProvider,
      environmentProvider: envProviderType,
      providers,
      credentialStorage: {
        encryptedAtRest: isCredentialVaultConfigured(),
        scope: 'user',
        rawKeysReturned: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.get('/credentials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    res.json({
      activeProvider: await getUserSelectedProvider(payload.sub),
      credentials: await listSafeCredentials(payload.sub),
      encryption: {
        enabled: isCredentialVaultConfigured(),
        rawKeyReturned: false,
        scope: 'user',
      },
    });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.post('/credentials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = upsertCredentialSchema.parse(req.body);
    const encrypted = encryptSecret(input.apiKey);
    const fingerprint = secretFingerprint(input.apiKey);

    const credential = await prisma.llmProviderCredential.upsert({
      where: {
        owner_user_id_provider: {
          owner_user_id: payload.sub,
          provider: input.provider,
        },
      },
      create: {
        owner_user_id: payload.sub,
        provider: input.provider,
        model: input.model,
        encrypted_api_key: encrypted,
        key_fingerprint: fingerprint,
        is_active: true,
      },
      update: {
        model: input.model,
        encrypted_api_key: encrypted,
        key_fingerprint: fingerprint,
        is_active: true,
      },
    });

    await setUserSelectedProvider(payload.sub, input.provider);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'llm_credential_saved', object_type: 'llm_provider_credential', object_id: credential.id, result: 'success' },
      `LLM provider credential saved for ${input.provider}`,
    );

    res.status(201).json({
      id: credential.id,
      provider: credential.provider,
      model: credential.model,
      apiKeyStatus: 'configured',
      keyFingerprint: credential.key_fingerprint,
      rawKeyReturned: false,
      _label: 'Credential encrypted and saved for this user only',
    });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.post('/select', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const provider = providerSchema.parse(req.body.provider);

    if (provider === 'mock' && !isMockLLMAllowed()) {
      res.status(400).json({ error: 'Mock LLM is disabled for production use. Configure OpenAI or Claude.' });
      return;
    }

    if (provider !== 'mock') {
      const credential = await prisma.llmProviderCredential.findUnique({
        where: {
          owner_user_id_provider: {
            owner_user_id: payload.sub,
            provider,
          },
        },
      });
      if (!credential?.is_active) {
        res.status(400).json({ error: `${provider} credential is missing for this user` });
        return;
      }
    }

    await setUserSelectedProvider(payload.sub, provider);
    res.json({ activeProvider: provider, _label: 'Active LLM provider updated for this user' });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const provider = credentialProviderSchema.parse(req.body.provider);
    const credential = await prisma.llmProviderCredential.findUnique({
      where: {
        owner_user_id_provider: {
          owner_user_id: payload.sub,
          provider,
        },
      },
    });

    if (!credential?.is_active) {
      res.status(400).json({ status: 'missing', _label: 'No active credential for this user/provider' });
      return;
    }

    const llm = createConfiguredLLMProvider({
      provider: credential.provider,
      model: credential.model,
      apiKey: decryptSecret(credential.encrypted_api_key),
    });
    let result;
    try {
      result = await llm.generate('Return the single word OK.', { maxTokens: 16, temperature: 0, timeoutMs: 15000 });
    } catch (providerError) {
      auditLog(
        { actor: `user:${payload.sub}`, action: 'llm_provider_test_failed', object_type: 'llm_provider_credential', object_id: credential.id, result: 'failure' },
        `LLM provider test failed for ${provider}`,
      );
      res.status(502).json({
        status: 'failed',
        provider,
        model: credential.model,
        apiKeyStatus: 'configured',
        rawKeyReturned: false,
        code: 'LLM_PROVIDER_TEST_FAILED',
        _label: providerError instanceof Error ? providerError.message : 'Provider test failed',
      });
      return;
    }
    await prisma.llmProviderCredential.update({
      where: { id: credential.id },
      data: { last_used_at: new Date() },
    });

    res.json({
      status: 'connected',
      provider,
      model: result.model,
      apiKeyStatus: 'configured',
      rawKeyReturned: false,
      _label: 'Provider test completed through STITCH backend',
    });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.delete('/credentials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const id = z.string().uuid().parse(req.params.id);
    const credential = await prisma.llmProviderCredential.findFirst({
      where: { id, owner_user_id: payload.sub },
    });
    if (!credential) {
      res.status(404).json({ error: 'Credential not found' });
      return;
    }
    await prisma.llmProviderCredential.update({ where: { id }, data: { is_active: false } });
    res.json({ id, status: 'disabled', _label: 'Credential disabled for this user' });
  } catch (err) {
    next(err);
  }
});

aiProviderRouter.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const provider = await resolveUserLLMProvider(payload.sub);
    const status = provider.getStatus();
    res.json({ ...status, _label: status.type === 'mock' ? 'Mock Provider - No external API calls' : `${status.name} - User configured provider` });
  } catch (err) {
    next(err);
  }
});

export async function resolveUserLLMProvider(userId: string): Promise<LLMProvider> {
  const selected = await getUserSelectedProvider(userId);
  if (selected === 'mock') {
    if (isMockLLMAllowed()) return createConfiguredLLMProvider({ provider: 'mock' });
    throw new AppError('No production LLM provider is configured for this user. Configure DeepSeek, OpenAI, or Claude in AI Provider settings.', 424, 'LLM_PROVIDER_REQUIRED');
  }
  const credential = await prisma.llmProviderCredential.findUnique({
    where: {
      owner_user_id_provider: {
        owner_user_id: userId,
        provider: selected,
      },
    },
  });
  if (!credential?.is_active) {
    throw new AppError(`Selected LLM provider ${selected} is missing credentials for this user.`, 424, 'LLM_PROVIDER_REQUIRED');
  }
  return createConfiguredLLMProvider({
    provider: credential.provider,
    model: credential.model,
    apiKey: decryptSecret(credential.encrypted_api_key),
  });
}

async function listSafeCredentials(userId: string) {
  const credentials = await prisma.llmProviderCredential.findMany({
    where: { owner_user_id: userId },
    orderBy: { updated_at: 'desc' },
  });
  return credentials.map((credential) => ({
    id: credential.id,
    provider: credential.provider,
    model: credential.model,
    apiKeyStatus: credential.is_active ? 'configured' : 'disabled',
    keyFingerprint: credential.key_fingerprint,
    isActive: credential.is_active,
    lastUsedAt: credential.last_used_at,
    updatedAt: credential.updated_at,
  }));
}

function hasCredential(credentials: Awaited<ReturnType<typeof listSafeCredentials>>, provider: LLMProviderType): boolean {
  return credentials.some((credential) => credential.provider === provider && credential.isActive);
}

function credentialModel(credentials: Awaited<ReturnType<typeof listSafeCredentials>>, provider: LLMProviderType): string | null {
  return credentials.find((credential) => credential.provider === provider && credential.isActive)?.model || null;
}

async function getUserSelectedProvider(userId: string): Promise<SelectableProviderType> {
  const agentRep = await prisma.agentRep.findUnique({ where: { user_id: userId } });
  const selected = (agentRep?.metadata as { llmProvider?: string } | null)?.llmProvider;
  return selected === 'openai' || selected === 'claude' || selected === 'deepseek' ? selected : 'mock';
}

async function setUserSelectedProvider(userId: string, provider: SelectableProviderType): Promise<void> {
  const agentRep = await prisma.agentRep.findUnique({ where: { user_id: userId } });
  if (!agentRep) return;
  const metadata = (agentRep.metadata as Record<string, unknown> | null) || {};
  await prisma.agentRep.update({
    where: { id: agentRep.id },
    data: { metadata: { ...metadata, llmProvider: provider } },
  });
}

function isMockLLMAllowed(): boolean {
  return process.env.ALLOW_MOCK_LLM === 'true' || process.env.NODE_ENV === 'test';
}

function isCredentialVaultConfigured(): boolean {
  return Boolean(process.env.SECRET_VAULT_ENCRYPTION_KEY || process.env.LLM_CREDENTIAL_ENCRYPTION_KEY);
}

function providerStatus(
  name: string,
  provider: LLMProviderType,
  credentials: Awaited<ReturnType<typeof listSafeCredentials>>,
  envApiKey: string | undefined,
  defaultModel: string,
) {
  const userConfigured = hasCredential(credentials, provider);
  return {
    name,
    type: provider,
    configured: userConfigured || Boolean(envApiKey),
    model: credentialModel(credentials, provider) || defaultModel,
    apiKeyStatus: userConfigured || envApiKey ? 'configured' as const : 'missing' as const,
    scope: userConfigured ? 'user' : 'environment',
  };
}
