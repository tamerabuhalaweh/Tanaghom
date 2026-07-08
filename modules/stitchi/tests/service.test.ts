import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ForbiddenError } from '@shared/errors';

vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
const providerMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  streamGenerate: vi.fn(),
  getStatus: vi.fn(),
  resolveUserLLMProvider: vi.fn(),
}));

vi.mock('@modules/ai-provider/controller', () => ({
  resolveUserLLMProvider: providerMocks.resolveUserLLMProvider,
}));

vi.mock('../context', () => ({
  loadReadOnlyContext: vi.fn().mockResolvedValue({
    selectedEvent: { id: 'event-1', name: 'Leadership Course' },
    recentEvents: [{ id: 'event-1' }],
    leadSummary: { total: 2 },
    kpiSummary: { records: 1 },
    riskSummary: { open: 0 },
    connectorSummary: { configuredCredentials: 1, connectorJobs: 1 },
  }),
  formatReadOnlyContextForPrompt: vi.fn(() => '{"selectedEvent":{"name":"Leadership Course"}}'),
}));

const workflowMocks = vi.hoisted(() => ({
  startStitchiActionApprovalWorkflow: vi.fn(),
  resumeStitchiActionApprovalWorkflow: vi.fn(),
}));

vi.mock('../workflow', () => ({
  startStitchiActionApprovalWorkflow: workflowMocks.startStitchiActionApprovalWorkflow,
  resumeStitchiActionApprovalWorkflow: workflowMocks.resumeStitchiActionApprovalWorkflow,
}));

const actionMocks = vi.hoisted(() => ({
  isExecutableStitchiAction: vi.fn(),
  requiresApprovalForAction: vi.fn(),
  executeStitchiAction: vi.fn(),
}));

vi.mock('../actions', () => ({
  isExecutableStitchiAction: actionMocks.isExecutableStitchiAction,
  requiresApprovalForAction: actionMocks.requiresApprovalForAction,
  executeStitchiAction: actionMocks.executeStitchiAction,
}));

vi.mock('../repository', () => ({
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  createAssistantMessage: vi.fn(),
  createActionRun: vi.fn(),
  getActionRun: vi.fn(),
  markActionRunRunning: vi.fn(),
  completeActionRun: vi.fn(),
  failActionRun: vi.fn(),
  decideActionRun: vi.fn(),
  cancelActionRun: vi.fn(),
}));

import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import * as repo from '../repository';
import * as service from '../service';

describe('Stitchi service RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.createConversation).mockResolvedValue({
      id: 'conversation-1',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      eventId: null,
      title: 'Plan event',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.getConversation).mockResolvedValue({
      id: 'conversation-1',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      eventId: 'event-1',
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
      content: 'What should I do today?',
      metadata: {},
      createdAt: new Date(),
    });
    vi.mocked(repo.createAssistantMessage).mockResolvedValue({
      id: 'assistant-message-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      role: 'assistant',
      content: 'Focus on leads and content readiness.',
      metadata: {},
      createdAt: new Date(),
    });
    providerMocks.generate.mockResolvedValue({
      text: 'Focus on leads and content readiness.',
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
      usage: { promptTokens: 100, completionTokens: 40 },
    });
    providerMocks.streamGenerate.mockImplementation(async function* () {
      yield { type: 'token', text: 'Focus on leads ' };
      yield { type: 'token', text: 'and content readiness.' };
      yield {
        type: 'done',
        response: {
          text: 'Focus on leads and content readiness.',
          provider: 'gemma',
          model: 'gemma4-26b-a4b-canary',
          usage: { promptTokens: 100, completionTokens: 40 },
        },
      };
    });
    providerMocks.getStatus.mockReturnValue({
      name: 'Gemma',
      type: 'gemma',
      configured: true,
      model: 'gemma4-26b-a4b-canary',
      apiKeyStatus: 'configured',
    });
    providerMocks.resolveUserLLMProvider.mockResolvedValue({
      generate: providerMocks.generate,
      streamGenerate: providerMocks.streamGenerate,
      getStatus: providerMocks.getStatus,
    });
    actionMocks.isExecutableStitchiAction.mockReturnValue(false);
    actionMocks.requiresApprovalForAction.mockReturnValue(true);
    workflowMocks.startStitchiActionApprovalWorkflow.mockResolvedValue({
      threadId: 'thread-1',
      status: 'awaiting_human_approval',
      interrupt: {},
    });
    workflowMocks.resumeStitchiActionApprovalWorkflow.mockResolvedValue({
      threadId: 'thread-1',
      status: 'approved',
    });
  });

  it('allows a normal marketing user to create a conversation foundation', async () => {
    await service.createConversation('marketing_manager', 'tenant-a', 'user-1', { title: 'Plan event' });
    expect(repo.createConversation).toHaveBeenCalledWith('tenant-a', 'user-1', { title: 'Plan event' });
  });

  it('blocks non-approver roles from approving action proposals', async () => {
    await expect(service.approveActionRun('sales_manager', 'tenant-a', 'user-1', 'action-1', {}))
      .rejects.toThrow(ForbiddenError);
    expect(repo.decideActionRun).not.toHaveBeenCalled();
  });

  it('allows approver roles to approve action proposals', async () => {
    vi.mocked(repo.decideActionRun).mockResolvedValue({
      actionRun: {
        id: 'action-1',
        tenantKey: 'tenant-a',
        conversationId: 'conversation-1',
        userId: 'user-1',
        actionType: 'draft_event_strategy',
        status: 'approved',
        inputPayload: {},
        previewPayload: null,
        resultPayload: null,
        requiresApproval: true,
        riskLevel: 'medium',
        auditRecordId: null,
        langGraphThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      },
      approval: {
        id: 'approval-1',
        tenantKey: 'tenant-a',
        actionRunId: 'action-1',
        approverUserId: 'manager-1',
        decision: 'approved',
        notes: null,
        createdAt: new Date(),
      },
    });

    await service.approveActionRun('marketing_manager', 'tenant-a', 'manager-1', 'action-1', {});
    expect(repo.decideActionRun).toHaveBeenCalledWith('tenant-a', 'manager-1', 'marketing_manager', 'action-1', 'approved', {});
  });

  it('starts a LangGraph approval workflow for executable action proposals', async () => {
    actionMocks.isExecutableStitchiAction.mockReturnValue(true);
    vi.mocked(repo.createActionRun).mockResolvedValue({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: 'create_event_problem',
      status: 'awaiting_approval',
      inputPayload: { eventId: 'event-1', title: 'Follow-up delay', category: 'sales' },
      previewPayload: null,
      resultPayload: null,
      requiresApproval: true,
      riskLevel: 'medium',
      auditRecordId: null,
      langGraphThreadId: 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    const run = await service.createActionRun('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      actionType: 'create_event_problem',
      inputPayload: { eventId: 'event-1', title: 'Follow-up delay', category: 'sales' },
      requiresApproval: false,
      riskLevel: 'medium',
    });

    expect(run.requiresApproval).toBe(true);
    expect(repo.createActionRun).toHaveBeenCalledWith('tenant-a', 'user-1', 'marketing_manager', 'conversation-1', expect.objectContaining({
      requiresApproval: true,
      langGraphThreadId: expect.stringMatching(/^stitchi-action-/),
    }));
    expect(workflowMocks.startStitchiActionApprovalWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      tenantKey: 'tenant-a',
      userId: 'user-1',
      conversationId: 'conversation-1',
      actionRunId: 'action-1',
      actionType: 'create_event_problem',
    }));
  });

  it('executes an approved internal action through the action registry and completes the run', async () => {
    actionMocks.isExecutableStitchiAction.mockReturnValue(true);
    vi.mocked(repo.getActionRun).mockResolvedValue({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: 'create_event_problem',
      status: 'approved',
      inputPayload: { eventId: 'event-1', title: 'Follow-up delay', category: 'sales' },
      previewPayload: null,
      resultPayload: null,
      requiresApproval: true,
      riskLevel: 'medium',
      auditRecordId: null,
      langGraphThreadId: 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });
    vi.mocked(repo.markActionRunRunning).mockResolvedValue({} as never);
    actionMocks.executeStitchiAction.mockResolvedValue({
      objectType: 'event_problem',
      objectId: 'problem-1',
      result: { id: 'problem-1', title: 'Follow-up delay' },
    });
    vi.mocked(repo.completeActionRun).mockResolvedValue({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: 'create_event_problem',
      status: 'completed',
      inputPayload: {},
      previewPayload: null,
      resultPayload: { objectId: 'problem-1' },
      requiresApproval: true,
      riskLevel: 'medium',
      auditRecordId: null,
      langGraphThreadId: 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await service.executeApprovedActionRun('marketing_manager', 'tenant-a', 'user-1', 'action-1');

    expect(repo.markActionRunRunning).toHaveBeenCalledWith('tenant-a', 'user-1', 'marketing_manager', 'action-1');
    expect(actionMocks.executeStitchiAction).toHaveBeenCalledWith(expect.objectContaining({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_event_problem',
    }));
    expect(repo.completeActionRun).toHaveBeenCalledWith('tenant-a', 'user-1', 'action-1', expect.objectContaining({
      objectType: 'event_problem',
      objectId: 'problem-1',
      externalExecution: 'blocked',
    }));
    expect(result.executed.objectId).toBe('problem-1');
  });

  it('approves and executes an internal action in one governed service call', async () => {
    actionMocks.isExecutableStitchiAction.mockReturnValue(true);
    vi.mocked(repo.decideActionRun).mockResolvedValue({
      actionRun: {
        id: 'action-1',
        tenantKey: 'tenant-a',
        conversationId: 'conversation-1',
        userId: 'user-1',
        actionType: 'create_commercial_plan',
        status: 'approved',
        inputPayload: {},
        previewPayload: null,
        resultPayload: null,
        requiresApproval: true,
        riskLevel: 'medium',
        auditRecordId: null,
        langGraphThreadId: 'thread-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      },
      approval: {
        id: 'approval-1',
        tenantKey: 'tenant-a',
        actionRunId: 'action-1',
        approverUserId: 'manager-1',
        decision: 'approved',
        notes: null,
        createdAt: new Date(),
      },
    });
    vi.mocked(repo.getActionRun).mockResolvedValue({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: 'create_commercial_plan',
      status: 'approved',
      inputPayload: {
        revenueLineId: '00000000-0000-0000-0000-000000000040',
        horizon: 'quarterly',
        title: 'Leadership course launch',
      },
      previewPayload: null,
      resultPayload: null,
      requiresApproval: true,
      riskLevel: 'medium',
      auditRecordId: null,
      langGraphThreadId: 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });
    vi.mocked(repo.markActionRunRunning).mockResolvedValue({} as never);
    actionMocks.executeStitchiAction.mockResolvedValue({
      objectType: 'commercial_plan',
      objectId: 'plan-1',
      result: { id: 'plan-1', title: 'Leadership course launch' },
    });
    vi.mocked(repo.completeActionRun).mockResolvedValue({
      id: 'action-1',
      tenantKey: 'tenant-a',
      conversationId: 'conversation-1',
      userId: 'user-1',
      actionType: 'create_commercial_plan',
      status: 'completed',
      inputPayload: {},
      previewPayload: null,
      resultPayload: { objectId: 'plan-1' },
      requiresApproval: true,
      riskLevel: 'medium',
      auditRecordId: null,
      langGraphThreadId: 'thread-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await service.approveAndExecuteActionRun('marketing_manager', 'tenant-a', 'manager-1', 'action-1', {
      notes: 'Approved and saved from Stitchi assistant',
    });

    expect(repo.decideActionRun).toHaveBeenCalledWith('tenant-a', 'manager-1', 'marketing_manager', 'action-1', 'approved', {
      notes: 'Approved and saved from Stitchi assistant',
    });
    expect(actionMocks.executeStitchiAction).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'create_commercial_plan',
      tenantKey: 'tenant-a',
      userId: 'manager-1',
    }));
    expect(result.actionRun.status).toBe('completed');
    expect(result.executed.objectId).toBe('plan-1');
  });

  it('generates a read-only assistant answer with the configured user provider', async () => {
    const result = await service.generateReadOnlyAssistantResponse('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'What should I prioritize today?',
      eventId: '00000000-0000-0000-0000-000000000001',
    });

    expect(resolveUserLLMProvider).toHaveBeenCalledWith('user-1');
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.stringContaining('What should I prioritize today?'), expect.objectContaining({
      systemPrompt: expect.stringContaining('read-only operating assistant'),
      maxTokens: 750,
      temperature: 0.2,
    }));
    expect(repo.createMessage).toHaveBeenCalledWith('tenant-a', 'user-1', 'marketing_manager', 'conversation-1', expect.objectContaining({
      content: 'What should I prioritize today?',
      metadata: expect.objectContaining({ mode: 'read_only' }),
    }));
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      'Focus on leads and content readiness.',
      expect.objectContaining({
        mode: 'read_only',
        writesExecuted: false,
        externalExecution: 'blocked',
        provider: 'gemma',
        model: 'gemma4-26b-a4b-canary',
      }),
    );
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(result.provider).toEqual({
      status: 'used',
      name: 'Gemma',
      type: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });
    expect(result.safety.writesExecuted).toBe(false);
    expect(result.safety.actionProposalsCreated).toBe(0);
  });

  it('stores an honest setup-required answer when the user has no active AI provider', async () => {
    providerMocks.resolveUserLLMProvider.mockRejectedValue(new AppError('No production LLM provider is configured for this user.', 424, 'LLM_PROVIDER_REQUIRED'));

    const result = await service.generateReadOnlyAssistantResponse('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Prepare my event',
    });

    expect(providerMocks.generate).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('AI model is connected'),
      expect.objectContaining({
        providerRequired: true,
        writesExecuted: false,
        externalExecution: 'blocked',
      }),
    );
    expect(result.provider.status).toBe('required');
    expect(result.provider.model).toBeNull();
  });

  it('streams provider tokens and stores the final assistant answer', async () => {
    const events = [];
    for await (const event of service.streamReadOnlyAssistantResponse('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'What should I prioritize today?',
      eventId: '00000000-0000-0000-0000-000000000001',
    })) {
      events.push(event);
    }

    expect(events.map(event => event.type)).toEqual([
      'started',
      'user_message_saved',
      'context_loaded',
      'token',
      'token',
      'completed',
    ]);
    expect(events.filter(event => event.type === 'token').map(event => event.text).join('')).toBe('Focus on leads and content readiness.');
    expect(providerMocks.streamGenerate).toHaveBeenCalledWith(expect.stringContaining('What should I prioritize today?'), expect.objectContaining({
      systemPrompt: expect.stringContaining('read-only operating assistant'),
      maxTokens: 750,
    }));
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      'Focus on leads and content readiness.',
      expect.objectContaining({
        streamed: true,
        provider: 'gemma',
        model: 'gemma4-26b-a4b-canary',
      }),
    );
  });
});
