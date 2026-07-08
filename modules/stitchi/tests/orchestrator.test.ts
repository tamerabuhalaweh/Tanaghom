import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

const prismaMocks = vi.hoisted(() => ({
  langGraphWorkflow: {
    upsert: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  getStatus: vi.fn(),
  resolveUserLLMProvider: vi.fn(),
}));

vi.mock('@modules/ai-provider/controller', () => ({
  resolveUserLLMProvider: providerMocks.resolveUserLLMProvider,
}));

vi.mock('../context', () => ({
  loadReadOnlyContext: vi.fn().mockResolvedValue({
    selectedEvent: { id: '00000000-0000-0000-0000-000000000001', name: 'Leadership Event' },
    recentEvents: [],
    leadSummary: { total: 3 },
    kpiSummary: { records: 1 },
    riskSummary: { open: 0 },
    connectorSummary: { configuredCredentials: 1, connectorJobs: 0 },
  }),
  formatReadOnlyContextForPrompt: vi.fn(() => '{"selectedEvent":{"name":"Leadership Event"}}'),
}));

const workflowMocks = vi.hoisted(() => ({
  startStitchiActionApprovalWorkflow: vi.fn(),
}));

vi.mock('../workflow', () => ({
  startStitchiActionApprovalWorkflow: workflowMocks.startStitchiActionApprovalWorkflow,
}));

vi.mock('../repository', () => ({
  getConversation: vi.fn(),
  createMessage: vi.fn(),
  createAssistantMessage: vi.fn(),
  createActionRun: vi.fn(),
}));

import * as repo from '../repository';
import { orchestrateStitchiMessage } from '../orchestrator';

describe('Stitchi natural-language orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.langGraphWorkflow.upsert.mockResolvedValue({});
    providerMocks.getStatus.mockReturnValue({
      name: 'Gemma',
      type: 'gemma',
      configured: true,
      model: 'gemma4-26b-a4b-canary',
      apiKeyStatus: 'configured',
    });
    providerMocks.generate.mockResolvedValue({
      text: 'Review lead flow and KPI readiness.',
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });
    providerMocks.resolveUserLLMProvider.mockResolvedValue({
      generate: providerMocks.generate,
      getStatus: providerMocks.getStatus,
    });
    vi.mocked(repo.getConversation).mockResolvedValue({
      id: 'conversation-1',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      eventId: '00000000-0000-0000-0000-000000000001',
      title: 'Plan event',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.createMessage).mockResolvedValue({
      id: 'user-message-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'There is a WhatsApp follow-up delay problem',
      metadata: {},
      createdAt: new Date(),
    });
    vi.mocked(repo.createAssistantMessage).mockResolvedValue({
      id: 'assistant-message-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      role: 'assistant',
      content: 'Prepared for review.',
      metadata: {},
      createdAt: new Date(),
    });
    vi.mocked(repo.createActionRun).mockImplementation(async (_tenantKey, _userId, _role, _conversationId, input) => ({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: input.actionType,
      status: 'awaiting_approval',
      inputPayload: input.inputPayload,
      previewPayload: input.previewPayload,
      resultPayload: null,
      requiresApproval: true,
      riskLevel: input.riskLevel,
      auditRecordId: null,
      langGraphThreadId: input.langGraphThreadId || 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    }));
    workflowMocks.startStitchiActionApprovalWorkflow.mockResolvedValue({
      threadId: 'thread-1',
      status: 'awaiting_human_approval',
      interrupt: {},
    });
  });

  it('turns a business blocker message into an approval-gated internal action proposal', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'There is a WhatsApp follow-up delay problem that risks sales conversion.',
      eventId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.status).toBe('action_proposed');
    expect(result.safety).toMatchObject({
      approvalRequired: true,
      writesExecuted: false,
      externalExecution: 'blocked',
    });
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_event_problem',
        requiresApproval: true,
        inputPayload: expect.objectContaining({
          eventId: '00000000-0000-0000-0000-000000000001',
          category: 'sales',
          source: 'manual',
        }),
      }),
    );
    expect(workflowMocks.startStitchiActionApprovalWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      actionRunId: 'action-1',
      actionType: 'create_event_problem',
    }));
    expect(prismaMocks.langGraphWorkflow.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        workflow_type: 'stitchi_natural_language_orchestration',
        status: 'completed',
      }),
    }));
  });

  it('blocks direct external execution requests from chat', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Publish this to Instagram and send WhatsApp messages now.',
      eventId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.status).toBe('blocked');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(providerMocks.generate).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('cannot execute external publishing'),
      expect.objectContaining({
        writesExecuted: false,
        externalExecution: 'blocked',
      }),
    );
  });

  it('turns an email planning request into an approval-gated planner action', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Prepare a 4 email sequence for existing customers before the event.',
      eventId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_email_plan',
        requiresApproval: true,
        inputPayload: expect.objectContaining({
          eventId: '00000000-0000-0000-0000-000000000001',
          emailCount: 4,
          audienceSegment: 'Existing customers and previous buyers',
        }),
      }),
    );
  });

  it('turns a content requirement request into an approval-gated planner action', async () => {
    await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Create a video content requirement for Instagram explaining the event offer.',
      eventId: '00000000-0000-0000-0000-000000000001',
    });

    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_content_requirement',
        inputPayload: expect.objectContaining({
          assetType: 'video',
          platform: 'instagram',
        }),
      }),
    );
  });
});
