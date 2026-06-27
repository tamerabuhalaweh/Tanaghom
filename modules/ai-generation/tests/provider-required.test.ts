import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@shared/errors';

const prismaMocks = vi.hoisted(() => ({
  contentRequest: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));
vi.mock('@modules/ai-provider/controller', () => ({
  resolveUserLLMProvider: vi.fn(async () => {
    throw new AppError(
      'No production LLM provider is configured for this user. Configure OpenAI or Claude in AI Provider settings.',
      424,
      'LLM_PROVIDER_REQUIRED',
    );
  }),
}));

import { generateDrafts } from '../service';

describe('ai-generation provider readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.contentRequest.findUnique.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      raw_message: 'Campaign brief',
      objective: 'Generate qualified leads',
      audience: 'Marketing directors',
      cta: 'Book a walkthrough',
      content_type: 'campaign',
      risk_category: 'low',
      target_platforms: ['linkedin', 'instagram'],
    });
  });

  it('fails clearly when no real LLM provider is configured', async () => {
    await expect(generateDrafts('admin', 'user-1', {
      campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
      platforms: ['linkedin', 'instagram'],
      tone: 'professional',
    })).rejects.toMatchObject({
      statusCode: 424,
      code: 'LLM_PROVIDER_REQUIRED',
    });
  });
});
