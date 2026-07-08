import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  agentRep: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  llmProviderCredential: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import { resolveUserLLMProvider } from '../controller';
import { encryptSecret } from '@shared/crypto/secret-vault';

const previousNodeEnv = process.env.NODE_ENV;
const previousAllowMock = process.env.ALLOW_MOCK_LLM;
const previousVaultKey = process.env.SECRET_VAULT_ENCRYPTION_KEY;
const previousLlmProvider = process.env.LLM_PROVIDER;
const previousGemmaKey = process.env.GEMMA_API_KEY;

describe('production LLM provider resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_LLM;
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'test-provider-vault-key-with-at-least-32-characters';
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAllowMock === undefined) delete process.env.ALLOW_MOCK_LLM;
    else process.env.ALLOW_MOCK_LLM = previousAllowMock;
    if (previousVaultKey === undefined) delete process.env.SECRET_VAULT_ENCRYPTION_KEY;
    else process.env.SECRET_VAULT_ENCRYPTION_KEY = previousVaultKey;
    if (previousLlmProvider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = previousLlmProvider;
    if (previousGemmaKey === undefined) delete process.env.GEMMA_API_KEY;
    else process.env.GEMMA_API_KEY = previousGemmaKey;
  });

  it('does not silently fall back to mock in production', async () => {
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: {} });

    await expect(resolveUserLLMProvider('user-1')).rejects.toMatchObject({
      statusCode: 424,
      code: 'LLM_PROVIDER_REQUIRED',
    });
  });

  it('uses the configured environment provider when production users have no personal selection', async () => {
    process.env.LLM_PROVIDER = 'gemma';
    process.env.GEMMA_API_KEY = 'server-gemma-key';
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: {} });
    prismaMocks.llmProviderCredential.findUnique.mockResolvedValue(null);

    const provider = await resolveUserLLMProvider('user-1');

    expect(provider.getStatus()).toMatchObject({
      type: 'gemma',
      configured: true,
      apiKeyStatus: 'configured',
    });
  });

  it('uses the configured environment provider when production users still have mock selected', async () => {
    process.env.LLM_PROVIDER = 'gemma';
    process.env.GEMMA_API_KEY = 'server-gemma-key';
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: { llmProvider: 'mock' } });
    prismaMocks.llmProviderCredential.findUnique.mockResolvedValue(null);

    const provider = await resolveUserLLMProvider('user-1');

    expect(provider.getStatus()).toMatchObject({
      type: 'gemma',
      configured: true,
      apiKeyStatus: 'configured',
    });
  });

  it('requires credentials for the selected provider', async () => {
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: { llmProvider: 'openai' } });
    prismaMocks.llmProviderCredential.findUnique.mockResolvedValue(null);

    await expect(resolveUserLLMProvider('user-1')).rejects.toMatchObject({
      statusCode: 424,
      code: 'LLM_PROVIDER_REQUIRED',
    });
  });

  it('resolves the selected provider from encrypted user credentials', async () => {
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: { llmProvider: 'openai' } });
    prismaMocks.llmProviderCredential.findUnique.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      encrypted_api_key: encryptSecret('sk-test-user-owned-provider-key'),
      is_active: true,
    });

    const provider = await resolveUserLLMProvider('user-1');

    expect(provider.getStatus()).toMatchObject({
      type: 'openai',
      configured: true,
      model: 'gpt-4o',
      apiKeyStatus: 'configured',
    });
  });

  it('resolves DeepSeek from encrypted user credentials', async () => {
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: { llmProvider: 'deepseek' } });
    prismaMocks.llmProviderCredential.findUnique.mockResolvedValue({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      encrypted_api_key: encryptSecret('sk-test-user-owned-deepseek-key'),
      is_active: true,
    });

    const provider = await resolveUserLLMProvider('user-1');

    expect(provider.getStatus()).toMatchObject({
      type: 'deepseek',
      configured: true,
      model: 'deepseek-v4-flash',
      apiKeyStatus: 'configured',
    });
  });
});
