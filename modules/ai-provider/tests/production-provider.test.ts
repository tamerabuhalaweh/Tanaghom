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

const previousNodeEnv = process.env.NODE_ENV;
const previousAllowMock = process.env.ALLOW_MOCK_LLM;

describe('production LLM provider resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_LLM;
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAllowMock === undefined) delete process.env.ALLOW_MOCK_LLM;
    else process.env.ALLOW_MOCK_LLM = previousAllowMock;
  });

  it('does not silently fall back to mock in production', async () => {
    prismaMocks.agentRep.findUnique.mockResolvedValue({ metadata: {} });

    await expect(resolveUserLLMProvider('user-1')).rejects.toMatchObject({
      statusCode: 424,
      code: 'LLM_PROVIDER_REQUIRED',
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
});
