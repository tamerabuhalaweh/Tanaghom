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
    currentUser: {
      id: 'user-1',
      name: 'Marketing Manager',
      email: 'manager@example.com',
      role: 'marketing_manager',
      departmentName: 'Commercial',
    },
    selectedEvent: { id: '00000000-0000-0000-0000-000000000001', name: 'Leadership Event' },
    recentEvents: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Leadership Event',
        status: 'active',
        eventType: 'live_event',
        eventDate: new Date('2026-08-02T00:00:00Z'),
        location: 'Amman',
        plannedBudget: 5000,
        revenueTarget: 30000,
        selectedChannels: ['instagram', 'email'],
      },
    ],
    leadSummary: { total: 3 },
    kpiSummary: { records: 1 },
    riskSummary: { open: 0 },
    connectorSummary: { configuredCredentials: 1, connectorJobs: 0 },
    commercialCenter: {
      configuredRevenueLines: 1,
      activePlans: 0,
      openAssessmentSignals: 0,
      revenueLines: [
        {
          id: '00000000-0000-0000-0000-000000000040',
          type: 'online_course',
          name: 'Online Courses',
          status: 'active',
          planCount: 0,
          openSignals: 0,
        },
      ],
      recentPlans: [],
    },
    guardrails: {
      mode: 'read_only',
      writesExecuted: false,
      externalExecution: 'blocked',
      secretsReturned: false,
    },
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
import { loadReadOnlyContext } from '../context';
import { orchestrateStitchiMessage } from '../orchestrator';
import { AppError } from '@shared/errors';

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
      text: JSON.stringify({
        title: 'Leadership Course Launch',
        objective: 'Sell the leadership course to entrepreneurs using warm trust segments.',
        audience: 'Warm followers and previous buyers.',
        strategySummary: 'AI-assisted launch plan focused on authority content, warm retargeting, CRM nurturing, and direct reminders.',
        actionPlan: 'Publish authority content, run warm-audience ads, prepare GHL follow-up, and prepare WhatsApp reminders before purchase deadlines.',
        contentPillars: ['leadership transformation', 'entrepreneur proof stories', 'course value and urgency'],
        channelPlan: ['content warm-up', 'paid retargeting', 'GHL nurture', 'WhatsApp reminder preparation'],
        ghlFollowUpPlan: 'Prepare buyer and warm-follower nurture stages in GHL before sync.',
        whatsappReminderPlan: 'Prepare reminder templates for approved segments only.',
        successMetrics: ['qualified leads', 'purchase conversion', 'cost per purchase'],
        assumptions: ['customer credentials and audience lists are provided separately'],
      }),
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

  it('turns a commercial plan edit into an approval-gated Commercial Command Center update', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Update commercial plan 00000000-0000-0000-0000-000000000020 and activate it for implementation engagement.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'update_commercial_plan',
        inputPayload: expect.objectContaining({
          commercialPlanId: '00000000-0000-0000-0000-000000000020',
          plan: expect.objectContaining({
            stage: 'implementation_engagement',
            status: 'active',
          }),
        }),
      }),
    );
  });

  it('turns a commercial-to-event bridge request into an approval-gated plan link update', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Update commercial plan 00000000-0000-0000-0000-000000000020 and link it to the next available live event.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'update_commercial_plan',
        inputPayload: expect.objectContaining({
          commercialPlanId: '00000000-0000-0000-0000-000000000020',
          plan: expect.objectContaining({
            linkedEventId: '00000000-0000-0000-0000-000000000001',
          }),
        }),
        previewPayload: expect.objectContaining({
          linkedEventName: 'Leadership Event',
          approvalRequired: true,
          externalExecution: 'blocked',
        }),
      }),
    );
  });

  it('turns a discipline workspace request into an approval-gated workspace record', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Create an objection handling record for entrepreneurs who hesitate on price.',
      metadata: {
        revenueLineId: '00000000-0000-0000-0000-000000000040',
      },
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_commercial_discipline_record',
        inputPayload: expect.objectContaining({
          discipline: 'conversion_closing',
          category: 'objection_handling',
          revenueLineId: '00000000-0000-0000-0000-000000000040',
          sourceType: 'stitchi',
        }),
        previewPayload: expect.objectContaining({
          disciplineLabel: 'Conversion & Closing',
          approvalRequired: true,
          externalExecution: 'blocked',
        }),
      }),
    );
  });

  it('turns a business-language Online Courses request into an approval-gated commercial plan', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Stitchi, create an Online Courses plan for a leadership course launch.',
        'Objective: sell to entrepreneurs.',
        'Audience: warm followers and previous buyers.',
        'Budget target: 5000.',
        'Revenue target: 30000.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
        'Link it to the next available live event if suitable.',
      ].join('\n'),
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_commercial_plan',
        inputPayload: expect.objectContaining({
          revenueLineId: '00000000-0000-0000-0000-000000000040',
          linkedEventId: '00000000-0000-0000-0000-000000000001',
          objective: 'Sell the leadership course to entrepreneurs using warm trust segments.',
          audience: 'Warm followers and previous buyers.',
          budgetTarget: 5000,
          revenueTarget: 30000,
          actionPlan: expect.stringContaining('GHL follow-up'),
          status: 'draft',
        }),
        previewPayload: expect.objectContaining({
          revenueLineName: 'Online Courses',
          linkedEventName: 'Leadership Event',
          aiAssisted: true,
          aiProvider: 'gemma',
          aiModel: 'gemma4-26b-a4b-canary',
          contentPillars: expect.arrayContaining(['leadership transformation']),
          externalExecution: 'blocked',
          approvalRequired: true,
        }),
      }),
    );
    expect(providerMocks.generate).toHaveBeenCalledWith(
      expect.stringContaining('Create AI-assisted commercial plan details'),
      expect.objectContaining({
        systemPrompt: expect.stringContaining('AI-assisted commercial planning operator'),
      }),
    );
    expect(result.provider).toMatchObject({
      status: 'used',
      type: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });
  });

  it('configures an unconfigured Online Courses revenue line before proposing the plan', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: {
        id: 'user-1',
        name: 'Marketing Manager',
        email: 'manager@example.com',
        role: 'marketing_manager',
        departmentName: 'Commercial',
      },
      selectedEvent: { id: '00000000-0000-0000-0000-000000000001', name: 'Leadership Event' },
      recentEvents: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Leadership Event',
          status: 'active',
          eventType: 'live_event',
          eventDate: new Date('2026-08-02T00:00:00Z'),
          location: 'Amman',
          plannedBudget: 5000,
          revenueTarget: 30000,
          selectedChannels: ['instagram', 'email'],
        },
      ],
      leadSummary: { total: 3 },
      kpiSummary: { records: 1 },
      riskSummary: { open: 0 },
      connectorSummary: { configuredCredentials: 1, connectorJobs: 0 },
      commercialCenter: {
        configuredRevenueLines: 1,
        activePlans: 0,
        openAssessmentSignals: 0,
        revenueLines: [
          {
            id: null,
            type: 'online_course',
            name: 'Online Courses',
            status: 'not_configured',
            planCount: 0,
            openSignals: 0,
          },
        ],
        recentPlans: [],
      },
      guardrails: {
        mode: 'read_only',
        writesExecuted: false,
        externalExecution: 'blocked',
        secretsReturned: false,
      },
    });

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Stitchi, create an Online Courses plan for a leadership course launch.',
        'Objective: sell to entrepreneurs.',
        'Audience: warm followers and previous buyers.',
        'Budget target: 5000.',
        'Revenue target: 30000.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
        'Link it to the next available live event if suitable.',
      ].join('\n'),
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_commercial_plan_with_revenue_line',
        inputPayload: expect.objectContaining({
          revenueLine: expect.objectContaining({
            revenueLineType: 'online_course',
            name: 'Online Courses',
            status: 'active',
          }),
          plan: expect.objectContaining({
            linkedEventId: '00000000-0000-0000-0000-000000000001',
            objective: 'Sell the leadership course to entrepreneurs using warm trust segments.',
            budgetTarget: 5000,
            revenueTarget: 30000,
            status: 'draft',
          }),
        }),
        previewPayload: expect.objectContaining({
          revenueLineName: 'Online Courses',
          revenueLineSetup: 'will be configured before saving this plan',
          aiAssisted: true,
          externalExecution: 'blocked',
          approvalRequired: true,
        }),
      }),
    );
  });

  it('does not mistake a linked live event request for the Online Courses revenue line', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: {
        id: 'user-1',
        name: 'Marketing Manager',
        email: 'manager@example.com',
        role: 'marketing_manager',
        departmentName: 'Commercial',
      },
      selectedEvent: { id: '00000000-0000-0000-0000-000000000001', name: 'Leadership Event' },
      recentEvents: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Leadership Event',
          status: 'active',
          eventType: 'live_event',
          eventDate: new Date('2026-08-02T00:00:00Z'),
          location: 'Amman',
          plannedBudget: 5000,
          revenueTarget: 30000,
          selectedChannels: ['instagram', 'email'],
        },
      ],
      leadSummary: { total: 3 },
      kpiSummary: { records: 1 },
      riskSummary: { open: 0 },
      connectorSummary: { configuredCredentials: 1, connectorJobs: 0 },
      commercialCenter: {
        configuredRevenueLines: 1,
        activePlans: 0,
        openAssessmentSignals: 0,
        revenueLines: [
          {
            id: '00000000-0000-0000-0000-000000000050',
            type: 'live_event',
            name: 'Live Events',
            status: 'active',
            planCount: 1,
            openSignals: 0,
          },
        ],
        recentPlans: [],
      },
      guardrails: {
        mode: 'read_only',
        writesExecuted: false,
        externalExecution: 'blocked',
        secretsReturned: false,
      },
    });

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Stitchi, create an Online Courses plan for a leadership course launch.',
        'Objective: sell to entrepreneurs.',
        'Audience: warm followers and previous buyers.',
        'Budget target: 5000.',
        'Revenue target: 30000.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
        'Link it to the next available live event if suitable.',
      ].join('\n'),
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_commercial_plan_with_revenue_line',
        inputPayload: expect.objectContaining({
          revenueLine: expect.objectContaining({
            revenueLineType: 'online_course',
            name: 'Online Courses',
          }),
          plan: expect.objectContaining({
            linkedEventId: '00000000-0000-0000-0000-000000000001',
            objective: 'Sell the leadership course to entrepreneurs using warm trust segments.',
            budgetTarget: 5000,
            revenueTarget: 30000,
            status: 'draft',
          }),
        }),
        previewPayload: expect.objectContaining({
          revenueLineName: 'Online Courses',
          linkedEventName: 'Leadership Event',
          aiAssisted: true,
          approvalRequired: true,
          externalExecution: 'blocked',
        }),
      }),
    );
  });

  it('asks for the missing budget before preparing a commercial plan action', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Create an Online Courses plan for a leadership course launch.',
        'Objective: sell to entrepreneurs.',
        'Audience: warm followers and previous buyers.',
        'Revenue target: 30000.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
      ].join('\n'),
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('budget target'),
      expect.objectContaining({
        status: 'answered',
        writesExecuted: false,
        externalExecution: 'blocked',
      }),
    );
  });

  it('requires a real AI provider before proposing commercial operator work', async () => {
    providerMocks.resolveUserLLMProvider.mockRejectedValueOnce(
      new AppError('No production LLM provider is configured for this user.', 424, 'LLM_PROVIDER_REQUIRED'),
    );

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Stitchi, create an Online Courses plan for a leadership course launch.',
        'Objective: sell to entrepreneurs.',
        'Audience: warm followers and previous buyers.',
        'Budget target: 5000.',
        'Revenue target: 30000.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
      ].join('\n'),
    });

    expect(result.status).toBe('answered');
    expect(result.provider).toMatchObject({ status: 'required', type: 'none' });
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(providerMocks.generate).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('AI model is connected'),
      expect.objectContaining({
        status: 'answered',
        writesExecuted: false,
        externalExecution: 'blocked',
      }),
    );
  });
});
