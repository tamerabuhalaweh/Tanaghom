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

const historicalAssessmentMocks = vi.hoisted(() => ({
  previewAssessment: vi.fn(),
}));

vi.mock('@modules/commercial-historical-assessment/service', () => historicalAssessmentMocks);

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
      defaultCurrency: 'AED',
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
    annualPlanning: {
      currentPlan: null,
      approvedLearningSets: [
        {
          id: '00000000-0000-0000-0000-000000000090',
          title: '2026 Approved Commercial Learning',
          findingCount: 4,
        },
      ],
      requiredActions: ['Create the next annual commercial plan.'],
    },
    historicalAssessment: {
      recentRuns: 0,
      latestRunId: null,
      latestRunStatus: null,
      latestRunTitle: null,
      latestDateFrom: null,
      latestDateTo: null,
      latestEvidenceCount: 0,
      latestMissingData: [],
      pendingFindings: [],
      approvedLearning: [],
      requiredActions: ['Create a historical assessment.'],
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
  listMessages: vi.fn(),
  createMessage: vi.fn(),
  createAssistantMessage: vi.fn(),
  createActionRun: vi.fn(),
}));

import * as repo from '../repository';
import { loadReadOnlyContext } from '../context';
import { orchestrateStitchiMessage } from '../orchestrator';
import { AppError } from '@shared/errors';
import { LLMProviderError } from '@shared/providers/llm-provider';

function annualOperatorContext(monthlyItems: Array<Record<string, unknown>> = []) {
  return {
    currentUser: { id: 'user-1', name: 'Manager', email: 'manager@example.com', role: 'department_head', departmentName: 'Commercial' },
    selectedEvent: null,
    recentEvents: [],
    commercialCenter: {
      defaultCurrency: 'AED',
      configuredRevenueLines: 1,
      activePlans: 0,
      openAssessmentSignals: 0,
      revenueLines: [{
        id: '00000000-0000-0000-0000-000000000040', type: 'online_course', name: 'Online Courses',
        status: 'active', planCount: 0, openSignals: 0,
      }],
      recentPlans: [],
    },
    annualPlanning: {
      currentPlan: {
        id: '00000000-0000-0000-0000-000000000930', revision: 4, year: 2027,
        title: '2027 Commercial Plan', status: 'draft', currency: 'AED', budgetTarget: 1000000,
        revenueTarget: 5000000, itemCount: monthlyItems.length, allocatedBudget: 0, monthlyItems,
      },
      approvedLearningSets: [],
      requiredActions: [],
    },
    historicalAssessment: {
      recentRuns: 0, latestRunId: null, latestRunStatus: null, latestRunTitle: null,
      latestDateFrom: null, latestDateTo: null, latestEvidenceCount: 0, latestMissingData: [],
      pendingFindings: [], approvedLearning: [], requiredActions: [],
    },
    guardrails: { mode: 'read_only', writesExecuted: false, externalExecution: 'blocked', secretsReturned: false },
  } as never;
}

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
    historicalAssessmentMocks.previewAssessment.mockResolvedValue({
      scope: {
        revenueLineId: '00000000-0000-0000-0000-000000000040',
        revenueLineName: 'Online Courses',
        eventIds: [],
        campaignIds: [],
        audienceQuery: null,
        channels: [],
        dateFrom: new Date('2025-01-01T00:00:00.000Z'),
        dateTo: new Date('2025-12-31T23:59:59.999Z'),
        defaultCurrency: 'AED',
      },
      summary: { evidenceCount: 4, completedEvents: 2 },
      missingData: [],
      evidence: [
        { id: '00000000-0000-0000-0000-000000000941' },
        { id: '00000000-0000-0000-0000-000000000942' },
        { id: '00000000-0000-0000-0000-000000000943' },
        { id: '00000000-0000-0000-0000-000000000944' },
      ],
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
    vi.mocked(repo.listMessages).mockResolvedValue([]);
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
        actionType: 'link_commercial_plan_event',
        inputPayload: expect.objectContaining({
          commercialPlanId: '00000000-0000-0000-0000-000000000020',
          eventId: '00000000-0000-0000-0000-000000000001',
          primary: true,
        }),
        previewPayload: expect.objectContaining({
          eventId: '00000000-0000-0000-0000-000000000001',
          approvalRequired: true,
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

  it('asks for missing annual targets before asking the AI provider to prepare a yearly plan', async () => {
    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Prepare our 2027 annual commercial plan and 12-month portfolio. Annual budget target: 500000 AED.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(providerMocks.generate).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.stringContaining('annual revenue target'),
      expect.objectContaining({ writesExecuted: false, externalExecution: 'blocked' }),
    );
  });

  it('uses Gemma and approved learning to propose an approval-gated annual commercial plan', async () => {
    providerMocks.generate.mockResolvedValueOnce({
      text: JSON.stringify({
        title: '2027 Commercial Growth Portfolio',
        strategy: 'Prioritize proven course and event motions, then stage launches around seasonal buying periods.',
        portfolioPriorities: ['Grow proven revenue lines', 'Protect budget for high-conversion periods'],
        seasonalityNotes: ['Keep Ramadan virtual-event timing visible in the monthly portfolio'],
        assumptions: ['Live connector results remain pending customer credentials'],
      }),
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Stitchi, create our 2027 annual commercial plan and twelve-month portfolio.',
        'Annual budget target: 500000 AED.',
        'Annual revenue target: 2500000 AED.',
        'Use approved historical learning and account for seasonality.',
      ].join('\n'),
    });

    expect(result.status).toBe('action_proposed');
    expect(providerMocks.generate).toHaveBeenCalledWith(
      expect.stringContaining('Prepare an evidence-aware annual commercial strategy'),
      expect.objectContaining({ systemPrompt: expect.stringContaining('annual commercial planning operator') }),
    );
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_annual_commercial_plan',
        requiresApproval: true,
        riskLevel: 'high',
        inputPayload: expect.objectContaining({
          year: 2027,
          title: '2027 Commercial Growth Portfolio',
          currency: 'AED',
          budgetTarget: 500000,
          revenueTarget: 2500000,
          learningSetIds: ['00000000-0000-0000-0000-000000000090'],
          strategy: expect.stringContaining('Portfolio priorities'),
        }),
        previewPayload: expect.objectContaining({
          approvedLearningSets: 1,
          approvalRequired: true,
          externalSystemsCalled: false,
        }),
      }),
    );
    expect(result.provider).toMatchObject({ status: 'used', type: 'gemma', model: 'gemma4-26b-a4b-canary' });
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

  it('prepares an AI-assisted Books plan with AED currency', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: {
        id: 'user-1',
        name: 'Marketing Manager',
        email: 'manager@example.com',
        role: 'marketing_manager',
        departmentName: 'Commercial',
      },
      selectedEvent: null,
      recentEvents: [],
      leadSummary: { total: 0 },
      kpiSummary: { records: 0 },
      riskSummary: { open: 0 },
      connectorSummary: { configuredCredentials: 0, connectorJobs: 0 },
      commercialCenter: {
        configuredRevenueLines: 0,
        activePlans: 0,
        openAssessmentSignals: 0,
        revenueLines: [
          {
            id: null,
            type: 'book',
            name: 'Books',
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
        'Create a Books plan for a leadership book launch.',
        'Objective: sell the new book to warm followers.',
        'Audience: readers, previous buyers, and entrepreneurs.',
        'Budget target: 5000 AED.',
        'Revenue target: 30000 AED.',
        'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
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
            revenueLineType: 'book',
            name: 'Books',
          }),
          plan: expect.objectContaining({
            currency: 'AED',
            budgetTarget: 5000,
            revenueTarget: 30000,
          }),
        }),
        previewPayload: expect.objectContaining({
          revenueLineName: 'Books',
          currency: 'AED',
          aiAssisted: true,
        }),
      }),
    );
  });

  it('does not create operational work for future merchandise lines before leadership enables them', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: [
        'Create a Merchandise plan for a product drop.',
        'Objective: sell branded shirts.',
        'Audience: fans and previous buyers.',
        'Budget target: 5000.',
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
      expect.stringContaining('Merchandise is captured as a future revenue line'),
      expect.objectContaining({
        status: 'answered',
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

  it('returns an actionable no-write answer when the configured provider rejects a read-only request', async () => {
    providerMocks.generate.mockRejectedValueOnce(
      new LLMProviderError('Gemma rejected the configured credential.', 400, 'LLM_PROVIDER_UNAVAILABLE'),
    );

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'What should I focus on today?',
    });

    expect(result.status).toBe('answered');
    expect(result.provider).toMatchObject({ status: 'unavailable', type: 'gemma' });
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('No system data was changed'),
      expect.objectContaining({
        providerStatus: 'unavailable',
        writesExecuted: false,
        externalExecution: 'blocked',
      }),
    );
  });

  it('does not create a commercial action when AI enrichment is unavailable', async () => {
    providerMocks.generate.mockRejectedValueOnce(
      new LLMProviderError('Gemma rejected the configured credential.', 400, 'LLM_PROVIDER_UNAVAILABLE'),
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
    expect(result.provider).toMatchObject({ status: 'unavailable', type: 'gemma' });
    expect(result.actionRun).toBeNull();
    expect(repo.createActionRun).not.toHaveBeenCalled();
  });

  it('asks for a missing amount before preparing a commercial budget allocation', async () => {
    const result = await orchestrateStitchiMessage(
      'department_head',
      'tenant-a',
      'user-1',
      'conversation-1',
      {
        content: 'Allocate budget to the selected January course launch.',
        metadata: {
          annualPlanId: '00000000-0000-0000-0000-000000000900',
          budgetLevel: 'monthly_item',
          budgetTargetId: '00000000-0000-0000-0000-000000000903',
          budgetCurrency: 'AED',
        },
      },
    );

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.stringContaining('amount'),
      expect.objectContaining({ writesExecuted: false, externalExecution: 'blocked' }),
    );
  });

  it('prepares an approval-gated allocation for the selected annual work item', async () => {
    const result = await orchestrateStitchiMessage(
      'department_head',
      'tenant-a',
      'user-1',
      'conversation-1',
      {
        content: 'Allocate budget amount 25000 AED to the selected January course launch.',
        metadata: {
          annualPlanId: '00000000-0000-0000-0000-000000000900',
          budgetLevel: 'monthly_item',
          budgetTargetId: '00000000-0000-0000-0000-000000000903',
          budgetCurrency: 'AED',
        },
      },
    );

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_commercial_budget_allocation',
        requiresApproval: true,
        riskLevel: 'high',
        inputPayload: expect.objectContaining({
          annualPlanId: '00000000-0000-0000-0000-000000000900',
          allocation: expect.objectContaining({
            level: 'monthly_item',
            monthlyPortfolioItemId: '00000000-0000-0000-0000-000000000903',
            currency: 'AED',
            amount: 25000,
          }),
        }),
      }),
    );
  });

  it('asks for a historical period before reading evidence or creating an assessment', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Assess our previous Online Courses performance and tell me what worked.',
    });

    expect(result.status).toBe('answered');
    expect(historicalAssessmentMocks.previewAssessment).not.toHaveBeenCalled();
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('Which historical period'),
      expect.objectContaining({ writesExecuted: false, externalExecution: 'blocked' }),
    );
  });

  it('reports missing historical evidence honestly and creates no action', async () => {
    historicalAssessmentMocks.previewAssessment.mockResolvedValueOnce({
      scope: {},
      summary: { evidenceCount: 0 },
      missingData: ['No verified KPI records were found for the completed events.'],
      evidence: [],
    });

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Assess our 2025 Online Courses performance and explain what failed.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.stringContaining('No verified KPI records'),
      expect.any(Object),
    );
  });

  it('prepares an evidence-scoped historical assessment with a real AI provider', async () => {
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Assess our 2025 Online Courses historical performance and explain what worked and failed.',
    });

    expect(result.status).toBe('action_proposed');
    expect(historicalAssessmentMocks.previewAssessment).toHaveBeenCalledWith(
      'marketing_manager',
      'tenant-a',
      expect.objectContaining({
        revenueLineId: '00000000-0000-0000-0000-000000000040',
        dateFrom: new Date('2025-01-01T00:00:00.000Z'),
      }),
    );
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'prepare_historical_commercial_assessment',
        riskLevel: 'high',
        inputPayload: expect.objectContaining({
          dateFrom: '2025-01-01T00:00:00.000Z',
          dateTo: '2025-12-31T23:59:59.999Z',
        }),
        previewPayload: expect.objectContaining({ evidenceCount: 4, aiProvider: 'gemma' }),
      }),
    );
  });

  it('requires a real configured provider after historical evidence is found', async () => {
    providerMocks.resolveUserLLMProvider.mockRejectedValueOnce(
      new AppError('No production LLM provider is configured for this user.', 424, 'LLM_PROVIDER_REQUIRED'),
    );

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Assess our 2025 Online Courses historical performance.',
    });

    expect(result.status).toBe('answered');
    expect(result.provider).toMatchObject({ status: 'required', type: 'none' });
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'marketing_manager', 'conversation-1',
      expect.stringContaining('Connect Gemma'), expect.any(Object),
    );
  });

  it('rejects mock AI output for historical analysis', async () => {
    providerMocks.getStatus.mockReturnValueOnce({
      name: 'Mock', type: 'mock', configured: true, model: 'deterministic-mock', apiKeyStatus: 'not_required',
    });

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Analyze our 2025 historical performance and explain what worked.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'marketing_manager', 'conversation-1',
      expect.stringContaining('Mock output is not accepted'), expect.any(Object),
    );
  });

  it('accepts an explicit date range and scoped evidence identifiers', async () => {
    const eventId = '00000000-0000-0000-0000-000000000941';
    const campaignId = '00000000-0000-0000-0000-000000000942';
    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Assess historical performance from 2025-02-01 to 2025-03-31 for Instagram. Audience: previous buyers.',
      metadata: { eventIds: [eventId], campaignIds: [campaignId] },
    });

    expect(result.status).toBe('action_proposed');
    expect(historicalAssessmentMocks.previewAssessment).toHaveBeenCalledWith(
      'marketing_manager', 'tenant-a', expect.objectContaining({
        eventIds: [eventId], campaignIds: [campaignId], channels: ['instagram'],
        audienceQuery: 'previous buyers.',
        dateFrom: new Date('2025-02-01T00:00:00.000Z'),
        dateTo: new Date('2025-03-31T23:59:59.999Z'),
      }),
    );
  });

  it('asks the user to choose when multiple assessment findings are pending', async () => {
    const context = annualOperatorContext() as unknown as {
      historicalAssessment: { pendingFindings: Array<Record<string, unknown>> };
    };
    context.historicalAssessment.pendingFindings = [
      { id: '00000000-0000-0000-0000-000000000951', type: 'repeat', title: 'Repeat buyer retargeting', summary: 'Strong conversion.', recommendation: 'Repeat it.', confidence: 0.9, evidenceIds: [] },
      { id: '00000000-0000-0000-0000-000000000952', type: 'improve', title: 'Improve meeting reminders', summary: 'No-shows were high.', recommendation: 'Add reminders.', confidence: 0.8, evidenceIds: [] },
    ];
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce(context as never);

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Reject the historical assessment finding.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'marketing_manager', 'conversation-1',
      expect.stringContaining('Choose the assessment finding to reject'), expect.any(Object),
    );
  });

  it('adds a monthly initiative to the current annual plan with AED targets', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: { id: 'user-1', name: 'Manager', email: 'manager@example.com', role: 'department_head', departmentName: 'Commercial' },
      selectedEvent: null,
      recentEvents: [],
      commercialCenter: {
        defaultCurrency: 'AED',
        configuredRevenueLines: 1,
        activePlans: 0,
        openAssessmentSignals: 0,
        revenueLines: [{ id: '00000000-0000-0000-0000-000000000040', type: 'online_course', name: 'Online Courses', status: 'active', planCount: 0, openSignals: 0 }],
        recentPlans: [],
      },
      annualPlanning: {
        currentPlan: {
          id: '00000000-0000-0000-0000-000000000930', revision: 4, year: 2027,
          title: '2027 Commercial Plan', status: 'draft', currency: 'AED', budgetTarget: 1000000,
          revenueTarget: 5000000, itemCount: 0, allocatedBudget: 0, monthlyItems: [],
        },
        approvedLearningSets: [],
        requiredActions: [],
      },
      guardrails: { mode: 'read_only', writesExecuted: false, externalExecution: 'blocked', secretsReturned: false },
    } as never);

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Add an Online Courses leadership launch in March. Budget allocation: 50000. Revenue target: 300000.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_monthly_portfolio_item',
        inputPayload: expect.objectContaining({
          annualPlanId: '00000000-0000-0000-0000-000000000930',
          item: expect.objectContaining({ month: 3, expectedRevision: 4, currency: 'AED', budgetAllocation: 50000, revenueTarget: 300000 }),
        }),
      }),
    );
  });

  it('does not create a monthly initiative before an annual plan exists', async () => {
    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Add an Online Courses initiative in April. Budget allocation: 50000. Revenue target: 300000.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'department_head', 'conversation-1',
      expect.stringContaining('Create or select the annual commercial plan first'), expect.any(Object),
    );
  });

  it('asks for the month before changing the annual portfolio', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce(annualOperatorContext());

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Add an Online Courses monthly initiative. Budget allocation: 50000. Revenue target: 300000.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'department_head', 'conversation-1',
      expect.stringContaining('Which month'), expect.any(Object),
    );
  });

  it('asks for missing financial targets before creating a monthly initiative', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce(annualOperatorContext());

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Add an Online Courses leadership initiative in May.',
    });

    expect(result.status).toBe('answered');
    expect(repo.createActionRun).not.toHaveBeenCalled();
    expect(repo.createAssistantMessage).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'department_head', 'conversation-1',
      expect.stringContaining('budget allocation and revenue target'), expect.any(Object),
    );
  });

  it('prepares a governed monthly item move with updated targets', async () => {
    const itemId = '00000000-0000-0000-0000-000000000931';
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce(annualOperatorContext([{
      id: itemId,
      month: 3,
      title: 'Leadership launch',
      revenueLineId: '00000000-0000-0000-0000-000000000040',
      revenueLineName: 'Online Courses',
      commercialPlanId: null,
      eventId: null,
      currency: 'AED',
      budgetAllocation: 50000,
      revenueTarget: 300000,
      priority: 'high',
      readiness: 'planned',
      plannedStartDate: null,
      plannedEndDate: null,
    }]));

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Move Leadership launch from March to April. Budget allocation: 60000. Revenue target: 360000.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a', 'user-1', 'department_head', 'conversation-1',
      expect.objectContaining({
        actionType: 'update_monthly_portfolio_item',
        inputPayload: expect.objectContaining({
          annualPlanId: '00000000-0000-0000-0000-000000000930',
          itemId,
          changes: expect.objectContaining({ expectedRevision: 4, month: 4, budgetAllocation: 60000, revenueTarget: 360000 }),
        }),
      }),
    );
  });

  it('continues a focused annual-plan follow-up without losing the original request', async () => {
    const priorRequest = 'Prepare the 2027 annual commercial plan using approved historical learning.';
    const currentAnswer = 'Annual budget target: 500000 AED. Annual revenue target: 2000000 AED.';
    vi.mocked(repo.listMessages).mockResolvedValue([
      { id: 'm1', tenantKey: 'tenant-a', conversationId: 'conversation-1', role: 'user', content: priorRequest, metadata: {}, createdAt: new Date() },
      { id: 'm2', tenantKey: 'tenant-a', conversationId: 'conversation-1', role: 'assistant', content: 'I still need the annual budget target and annual revenue target.', metadata: {}, createdAt: new Date() },
      { id: 'm3', tenantKey: 'tenant-a', conversationId: 'conversation-1', role: 'user', content: currentAnswer, metadata: {}, createdAt: new Date() },
    ]);
    providerMocks.generate.mockResolvedValueOnce({
      text: JSON.stringify({
        title: '2027 Evidence-Led Commercial Plan',
        strategy: 'Use approved historical learning to prioritize profitable launches and evidence-backed monthly investments.',
        portfolioPriorities: ['Profitable course launches', 'Evidence-led event portfolio'],
        seasonalityNotes: ['Review Ramadan and year-end demand'],
        assumptions: ['Customer connectors will provide live performance evidence'],
      }),
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });

    const result = await orchestrateStitchiMessage('department_head', 'tenant-a', 'user-1', 'conversation-1', {
      content: currentAnswer,
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'department_head',
      'conversation-1',
      expect.objectContaining({
        actionType: 'create_annual_commercial_plan',
        inputPayload: expect.objectContaining({ year: 2027, currency: 'AED', budgetTarget: 500000, revenueTarget: 2000000 }),
      }),
    );
  });

  it('prepares an executive-gated decision for the latest pending historical finding', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: { id: 'user-1', name: 'Manager', email: 'manager@example.com', role: 'marketing_manager', departmentName: 'Commercial' },
      selectedEvent: null,
      recentEvents: [],
      commercialCenter: { defaultCurrency: 'AED', configuredRevenueLines: 0, activePlans: 0, openAssessmentSignals: 0, revenueLines: [], recentPlans: [] },
      annualPlanning: { currentPlan: null, approvedLearningSets: [], requiredActions: [] },
      historicalAssessment: {
        recentRuns: 1,
        latestRunId: '00000000-0000-0000-0000-000000000950',
        latestRunStatus: 'generated',
        latestRunTitle: '2025 assessment',
        latestDateFrom: new Date('2025-01-01'),
        latestDateTo: new Date('2025-12-31'),
        latestEvidenceCount: 8,
        latestMissingData: [],
        pendingFindings: [{
          id: '00000000-0000-0000-0000-000000000951',
          type: 'repeat',
          title: 'Warm buyer retargeting converted strongly',
          summary: 'Prior buyers converted above the portfolio baseline.',
          recommendation: 'Repeat this segment strategy.',
          confidence: 0.9,
          evidenceIds: ['00000000-0000-0000-0000-000000000952'],
        }],
        approvedLearning: [],
        requiredActions: [],
      },
      guardrails: { mode: 'read_only', writesExecuted: false, externalExecution: 'blocked', secretsReturned: false },
    } as never);

    const result = await orchestrateStitchiMessage('marketing_manager', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Approve the latest historical assessment finding for future planning.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      expect.objectContaining({
        actionType: 'decide_historical_assessment_finding',
        inputPayload: expect.objectContaining({
          findingId: '00000000-0000-0000-0000-000000000951',
          decision: expect.objectContaining({ decision: 'approved' }),
        }),
      }),
    );
  });

  it('prepares an annual-plan status transition using the current revision', async () => {
    vi.mocked(loadReadOnlyContext).mockResolvedValueOnce({
      currentUser: { id: 'user-1', name: 'CCO', email: 'cco@example.com', role: 'cco', departmentName: 'Commercial' },
      selectedEvent: null,
      recentEvents: [],
      commercialCenter: { defaultCurrency: 'AED', configuredRevenueLines: 0, activePlans: 0, openAssessmentSignals: 0, revenueLines: [], recentPlans: [] },
      annualPlanning: {
        currentPlan: {
          id: '00000000-0000-0000-0000-000000000960', revision: 7, year: 2027,
          title: '2027 Commercial Plan', status: 'pending_approval', currency: 'AED', budgetTarget: 1000000,
          revenueTarget: 5000000, itemCount: 0, allocatedBudget: 0, monthlyItems: [],
        },
        approvedLearningSets: [],
        requiredActions: [],
      },
      historicalAssessment: { recentRuns: 0, latestRunId: null, latestRunStatus: null, latestRunTitle: null, latestDateFrom: null, latestDateTo: null, latestEvidenceCount: 0, latestMissingData: [], pendingFindings: [], approvedLearning: [], requiredActions: [] },
      guardrails: { mode: 'read_only', writesExecuted: false, externalExecution: 'blocked', secretsReturned: false },
    } as never);

    const result = await orchestrateStitchiMessage('cco', 'tenant-a', 'user-1', 'conversation-1', {
      content: 'Approve the annual plan after reviewing its evidence and budget.',
    });

    expect(result.status).toBe('action_proposed');
    expect(repo.createActionRun).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'cco',
      'conversation-1',
      expect.objectContaining({
        actionType: 'transition_annual_commercial_plan',
        inputPayload: expect.objectContaining({
          annualPlanId: '00000000-0000-0000-0000-000000000960',
          target: 'approved',
          decision: expect.objectContaining({ expectedRevision: 7 }),
        }),
      }),
    );
  });
});
