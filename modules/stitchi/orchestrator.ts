import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { AppError } from '@shared/errors';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import type { CommercialCurrency, CommercialRevenueLineType } from '@modules/commercial-command-center/types';
import { formatReadOnlyContextForPrompt, loadReadOnlyContext, type StitchiReadOnlyContext } from './context';
import { checkStitchiPermission } from './policy';
import * as repo from './repository';
import { classifyStitchiProviderFailure, stitchiProviderUnavailableMessage } from './provider-failure';
import { sanitizeForStorage } from './redaction';
import { startStitchiActionApprovalWorkflow } from './workflow';
import type { StitchiExecutableActionType } from './actions';
import type {
  ReadOnlyAssistantRequestInput,
  StitchiActionRunSummary,
  StitchiMessageSummary,
} from './types';

type OrchestrationStatus = 'answered' | 'action_proposed' | 'blocked';

interface ActionProposal {
  actionType: StitchiExecutableActionType;
  inputPayload: Record<string, unknown>;
  previewPayload: Record<string, unknown>;
  riskLevel: 'medium' | 'high';
  reason: string;
  providerType?: string;
  providerModel?: string;
}

interface FollowUpResponse {
  kind: 'follow_up';
  assistantText: string;
  providerType?: string;
  providerModel?: string;
  providerStatus?: 'used' | 'required' | 'unavailable';
}

type CommercialDerivation = ActionProposal | FollowUpResponse | null;

const commercialPlanAiEnrichmentSchema = z.object({
  title: z.string().trim().min(1).max(260).optional(),
  objective: z.string().trim().min(1).max(5000).optional(),
  audience: z.string().trim().min(1).max(5000).optional(),
  strategySummary: z.string().trim().min(1).max(8000).optional(),
  actionPlan: z.string().trim().min(1).max(8000).optional(),
  contentPillars: z.array(z.string().trim().min(1).max(260)).max(8).optional(),
  channelPlan: z.array(z.string().trim().min(1).max(320)).max(10).optional(),
  ghlFollowUpPlan: z.string().trim().min(1).max(1200).optional(),
  whatsappReminderPlan: z.string().trim().min(1).max(1200).optional(),
  successMetrics: z.array(z.string().trim().min(1).max(260)).max(10).optional(),
  assumptions: z.array(z.string().trim().min(1).max(260)).max(8).optional(),
});

const annualPlanAiEnrichmentSchema = z.object({
  title: z.string().trim().min(3).max(220),
  strategy: z.string().trim().min(20).max(12000),
  portfolioPriorities: z.array(z.string().trim().min(2).max(320)).min(1).max(12),
  seasonalityNotes: z.array(z.string().trim().min(2).max(320)).max(12).default([]),
  assumptions: z.array(z.string().trim().min(2).max(320)).max(10).default([]),
});

type CommercialPlanAiEnrichment = z.infer<typeof commercialPlanAiEnrichmentSchema> & {
  providerType: string;
  providerModel: string | null;
};

export interface StitchiOrchestrationResult {
  userMessage: StitchiMessageSummary;
  assistantMessage: StitchiMessageSummary;
  actionRun: StitchiActionRunSummary | null;
  status: OrchestrationStatus;
  provider: {
    status: 'used' | 'required' | 'unavailable' | 'not_needed';
    type: string;
    model: string | null;
  };
  safety: {
    approvalRequired: boolean;
    writesExecuted: false;
    externalExecution: 'blocked';
    langGraphWorkflow: 'completed';
  };
}

const orchestrationState = Annotation.Root({
  role: Annotation<string>,
  tenantKey: Annotation<string>,
  userId: Annotation<string>,
  conversationId: Annotation<string>,
  content: Annotation<string>,
  eventId: Annotation<string | undefined>,
  metadata: Annotation<Record<string, unknown> | undefined>,
  context: Annotation<StitchiReadOnlyContext | undefined>,
  actionProposal: Annotation<ActionProposal | undefined>,
  actionRun: Annotation<StitchiActionRunSummary | undefined>,
  assistantText: Annotation<string | undefined>,
  providerType: Annotation<string | undefined>,
  providerModel: Annotation<string | undefined>,
  providerStatus: Annotation<'used' | 'required' | 'unavailable' | undefined>,
  status: Annotation<OrchestrationStatus | undefined>,
});

async function loadContextNode(state: typeof orchestrationState.State) {
  const conversation = await repo.getConversation(state.tenantKey, state.userId, state.role, state.conversationId);
  const context = await loadReadOnlyContext(state.tenantKey, conversation, state.eventId, state.role);
  return {
    context,
    eventId: state.eventId || conversation.eventId || context.selectedEvent?.id || undefined,
  };
}

async function classifyNode(state: typeof orchestrationState.State): Promise<Partial<typeof orchestrationState.State>> {
  if (isExternalExecutionRequest(state.content)) {
    return {
      status: 'blocked' as const,
      assistantText: [
        'I cannot execute external publishing, CRM writes, WhatsApp, Telegram, or voice actions directly from chat.',
        'I can prepare the work, explain what is missing, or create an internal approval-gated task.',
        'Connect the required customer-owned account and use the governed workflow before any external execution.',
      ].join('\n'),
    };
  }
  const proposal = await deriveActionProposal(state.content, state.userId, state.eventId, state.context, state.metadata);
  if (isFollowUpResponse(proposal)) {
    return {
      status: 'answered' as const,
      assistantText: proposal.assistantText,
      providerType: proposal.providerType,
      providerModel: proposal.providerModel,
      providerStatus: proposal.providerStatus,
    };
  }
  if (proposal) return { actionProposal: proposal, providerType: proposal.providerType, providerModel: proposal.providerModel };
  return {};
}

function isFollowUpResponse(value: unknown): value is FollowUpResponse {
  return Boolean(value && typeof value === 'object' && 'kind' in value && value.kind === 'follow_up');
}

async function respondNode(state: typeof orchestrationState.State) {
  if (state.actionProposal) {
    const { actionRun, assistantText } = await createActionRunFromProposal({
      tenantKey: state.tenantKey,
      userId: state.userId,
      role: state.role,
      conversationId: state.conversationId,
    }, state.actionProposal);
    return {
      actionRun,
      status: 'action_proposed' as const,
      assistantText,
    };
  }

  if (state.status === 'blocked' || state.assistantText) return {};

  let configuredProvider: { type: string; model: string } | null = null;
  try {
    const provider = await resolveUserLLMProvider(state.userId);
    const providerStatus = provider.getStatus();
    configuredProvider = { type: providerStatus.type, model: providerStatus.model };
    const response = await provider.generate(buildOrchestrationPrompt(state.content, state.context), {
      systemPrompt: ORCHESTRATOR_READ_ONLY_PROMPT,
      maxTokens: 650,
      temperature: 0.2,
      timeoutMs: 30000,
    });
    return {
      status: 'answered' as const,
      assistantText: response.text,
      providerType: response.provider,
      providerModel: response.model,
      providerName: providerStatus.name,
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'LLM_PROVIDER_REQUIRED') {
      return {
        status: 'answered' as const,
        assistantText: 'I can answer and plan more deeply once your AI model is connected. No system data was changed.',
        providerType: 'none',
        providerStatus: 'required' as const,
      };
    }
    if (classifyStitchiProviderFailure(err) === 'unavailable') {
      return {
        status: 'answered' as const,
        assistantText: stitchiProviderUnavailableMessage(),
        providerType: configuredProvider?.type || 'none',
        providerModel: configuredProvider?.model,
        providerStatus: 'unavailable' as const,
      };
    }
    throw err;
  }
}

async function createActionRunFromProposal(
  state: { tenantKey: string; userId: string; role: string; conversationId: string },
  proposal: ActionProposal,
): Promise<{ actionRun: StitchiActionRunSummary; assistantText: string }> {
  const threadId = `stitchi-orchestrated-action-${randomUUID()}`;
  const actionRun = await repo.createActionRun(state.tenantKey, state.userId, state.role, state.conversationId, {
    actionType: proposal.actionType,
    inputPayload: proposal.inputPayload,
    previewPayload: proposal.previewPayload,
    requiresApproval: true,
    riskLevel: proposal.riskLevel,
    langGraphThreadId: threadId,
  });
  await startStitchiActionApprovalWorkflow({
    threadId,
    tenantKey: state.tenantKey,
    userId: state.userId,
    conversationId: state.conversationId,
    actionRunId: actionRun.id,
    actionType: actionRun.actionType,
    inputSummary: proposal.previewPayload,
  });
  return {
    actionRun,
    assistantText: [
      `I prepared this for review: ${proposal.reason}.`,
      'No data has been changed yet.',
      'A manager must approve it before Tanaghum executes the internal update.',
    ].join('\n'),
  };
}

const orchestrationGraph = new StateGraph(orchestrationState)
  .addNode('loadContext', loadContextNode)
  .addNode('classify', classifyNode)
  .addNode('respond', respondNode)
  .addEdge(START, 'loadContext')
  .addEdge('loadContext', 'classify')
  .addEdge('classify', 'respond')
  .addEdge('respond', END)
  .compile({ checkpointer: new MemorySaver() });

export async function orchestrateStitchiMessage(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: ReadOnlyAssistantRequestInput,
): Promise<StitchiOrchestrationResult> {
  checkStitchiPermission(role, 'stitchi:create_message');
  checkStitchiPermission(role, 'stitchi:create_action');
  const threadId = `stitchi-orchestration-${randomUUID()}`;
  const userMessage = await repo.createMessage(tenantKey, userId, role, conversationId, {
    content: input.content,
    metadata: {
      ...input.metadata,
      mode: 'orchestrated',
      requestedEventId: input.eventId,
    },
  });

  let result = await orchestrationGraph.invoke({
    role,
    tenantKey,
    userId,
    conversationId,
    content: input.content,
    eventId: input.eventId,
    metadata: input.metadata,
    status: 'answered',
  }, {
    configurable: { thread_id: threadId },
  });

  if (!result.actionRun && !result.assistantText) {
    const conversation = await repo.getConversation(tenantKey, userId, role, conversationId);
    const context = await loadReadOnlyContext(tenantKey, conversation, input.eventId, role);
    const fallbackEventId = input.eventId || conversation.eventId || context.selectedEvent?.id || undefined;
    const fallbackProposal = await deriveActionProposal(input.content, userId, fallbackEventId, context, input.metadata);
    if (isFollowUpResponse(fallbackProposal)) {
      result = {
        ...result,
        context,
        eventId: fallbackEventId,
        status: 'answered',
        assistantText: fallbackProposal.assistantText,
        providerType: fallbackProposal.providerType,
        providerModel: fallbackProposal.providerModel,
        providerStatus: fallbackProposal.providerStatus,
      };
    } else if (fallbackProposal) {
      const { actionRun, assistantText } = await createActionRunFromProposal({
        tenantKey,
        userId,
        role,
        conversationId,
      }, fallbackProposal);
      result = {
        ...result,
        context,
        eventId: fallbackEventId,
        actionProposal: fallbackProposal,
        actionRun,
        status: 'action_proposed',
        assistantText,
        providerType: fallbackProposal.providerType,
        providerModel: fallbackProposal.providerModel,
      };
    }
  }

  const status = result.status || 'answered';
  const assistantMessage = await repo.createAssistantMessage(
    tenantKey,
    userId,
    role,
    conversationId,
    normalizeText(result.assistantText),
    {
      mode: 'orchestrated',
      status,
      actionRunId: result.actionRun?.id || null,
      writesExecuted: false,
      externalExecution: 'blocked',
      selectedEventId: result.eventId || null,
      provider: result.providerType || 'not_needed',
      model: result.providerModel || null,
      providerStatus: result.providerStatus || (result.providerType ? 'used' : 'not_needed'),
    },
  );

  await persistOrchestrationWorkflow({
    threadId,
    tenantKey,
    userId,
    stateSnapshot: {
      conversationId,
      userMessageId: userMessage.id,
      eventId: result.eventId || null,
      status,
      actionType: result.actionProposal?.actionType || null,
    },
    resultPayload: {
      assistantMessageId: assistantMessage.id,
      actionRunId: result.actionRun?.id || null,
      status,
    },
  });

  auditLog(
    { actor: `user:${userId}`, action: 'stitchi_orchestration_completed', object_type: 'stitchi_conversation', object_id: conversationId, result: 'success' },
    `Stitchi orchestration completed with status ${status}`,
  );

  return {
    userMessage,
    assistantMessage,
    actionRun: result.actionRun || null,
    status,
    provider: {
      status: result.providerStatus
        || (result.providerType === 'none' ? 'required' : result.providerType ? 'used' : 'not_needed'),
      type: result.providerType || 'none',
      model: result.providerModel || null,
    },
    safety: {
      approvalRequired: Boolean(result.actionRun),
      writesExecuted: false,
      externalExecution: 'blocked',
      langGraphWorkflow: 'completed',
    },
  };
}

async function deriveActionProposal(
  content: string,
  userId: string,
  eventId?: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): Promise<ActionProposal | FollowUpResponse | null> {
  const executiveReportProposal = deriveExecutiveReportActionProposal(content);
  if (executiveReportProposal) return executiveReportProposal;
  const annualPlanProposal = await deriveAnnualPlanActionProposal(content, userId, context);
  if (annualPlanProposal) return annualPlanProposal;
  const commercialProposal = await deriveCommercialCenterActionProposalV2(content, userId, context, metadata);
  if (commercialProposal) return commercialProposal;
  const disciplineProposal = deriveDisciplineActionProposal(content, eventId, context, metadata);
  if (disciplineProposal) return disciplineProposal;
  if (!eventId) return null;
  const lower = content.toLowerCase();
  const plannerProposal = derivePlannerActionProposal(content, lower, eventId);
  if (plannerProposal) return plannerProposal;
  if (/(problem|risk|blocker|issue|objection|delay|no-show|noshow|مشكلة|تحدي|اعتراض|خطر)/i.test(lower)) {
    const category = inferProblemCategory(lower);
    const severity = /(critical|urgent|severe|عاجل|حرج)/i.test(lower) ? 'high' : 'medium';
    const title = firstSentence(content, 'Event blocker needs attention');
    return {
      actionType: 'create_event_problem',
      inputPayload: {
        eventId,
        title,
        description: cleanText(content),
        category,
        severity,
        source: 'manual',
        impactSummary: 'Captured from Stitchi conversation for event team review.',
        recommendedAction: 'Review owner, impact, and next action before approving this blocker.',
      },
      previewPayload: {
        eventId,
        title,
        category,
        severity,
        approvalRequired: true,
      },
      riskLevel: severity === 'high' ? 'high' : 'medium',
      reason: `record a ${category} blocker for this event`,
    };
  }

  if (/(strategy|plan|brief|offer|audience|budget|email|whatsapp|upsell|خطة|استراتيجية|جمهور|عرض|ميزانية)/i.test(lower)) {
    const channels = inferChannels(lower);
    return {
      actionType: 'update_event_strategy',
      inputPayload: {
        eventId,
        strategy: {
          contentDepartmentRequirements: cleanText(content),
          salesTeamRequirements: cleanText(content),
          selectedChannels: channels.length > 0 ? channels : undefined,
        },
      },
      previewPayload: {
        eventId,
        strategyFields: ['contentDepartmentRequirements', 'salesTeamRequirements', ...(channels.length > 0 ? ['selectedChannels'] : [])],
        selectedChannels: channels,
        approvalRequired: true,
      },
      riskLevel: 'medium',
      reason: 'update the event strategy fields from your brief',
    };
  }

  return null;
}

async function deriveAnnualPlanActionProposal(
  content: string,
  userId: string,
  context?: StitchiReadOnlyContext,
): Promise<ActionProposal | FollowUpResponse | null> {
  const lower = content.toLowerCase();
  if (!/(annual|yearly|year plan|12[- ]month|twelve[- ]month|next year)/i.test(lower)) return null;
  if (!/(prepare|create|build|draft|plan|strategy|portfolio|calendar|allocate)/i.test(lower)) return null;

  const yearMatch = /\b(20\d{2})\b/.exec(content);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear() + 1;
  const budgetTarget = extractMoneyValue(content, ['annual budget target', 'total budget', 'budget target', 'annual budget', 'budget']);
  const revenueTarget = extractMoneyValue(content, ['annual revenue target', 'total revenue target', 'revenue target', 'annual revenue', 'revenue']);
  const currency = extractCommercialCurrency(content, context?.commercialCenter.defaultCurrency || 'AED');
  const missing = [budgetTarget == null ? 'annual budget target' : null, revenueTarget == null ? 'annual revenue target' : null].filter(Boolean);
  if (missing.length) {
    return {
      kind: 'follow_up',
      providerType: 'none',
      assistantText: [
        `I can prepare the ${year} annual commercial plan, but I still need the ${missing.join(' and ')}.`,
        `The workspace currency is ${currency}. Tell me both totals, and I will use approved historical learning to prepare the strategy for review.`,
        'No plan has been created or changed.',
      ].join('\n'),
    };
  }

  let provider;
  try {
    provider = await resolveUserLLMProvider(userId);
  } catch (error) {
    if (isProviderRequiredError(error)) {
      return {
        kind: 'follow_up', providerType: 'none', providerStatus: 'required',
        assistantText: 'Connect Gemma or another approved AI model before Stitchi prepares an annual strategy. No plan has been created.',
      };
    }
    throw error;
  }
  const providerStatus = provider.getStatus();
  if (providerStatus.type === 'mock') {
    return {
      kind: 'follow_up', providerType: 'none', providerStatus: 'required',
      assistantText: 'A real AI model is required for annual strategy preparation. Mock output is not accepted for this production workflow.',
    };
  }

  let response;
  let enrichment: z.infer<typeof annualPlanAiEnrichmentSchema>;
  try {
    response = await provider.generate([
      'Prepare an evidence-aware annual commercial strategy for Tanaghum.',
      'Return JSON only with this exact shape:',
      JSON.stringify({ title: 'short annual plan title', strategy: 'annual strategic direction', portfolioPriorities: ['priority'], seasonalityNotes: ['seasonality note'], assumptions: ['assumption'] }),
      'Rules:',
      '- Use approved historical learning and current commercial context when available.',
      '- Do not change or invent the supplied budget, revenue target, year, or currency.',
      '- Do not claim external publishing, CRM writes, messaging, or live analytics.',
      '- Identify assumptions honestly when customer data or connectors are missing.',
      `Year: ${year}`,
      `Currency: ${currency}`,
      `Annual budget target: ${budgetTarget}`,
      `Annual revenue target: ${revenueTarget}`,
      `User request: ${content}`,
      `Tanaghum context: ${context ? formatReadOnlyContextForPrompt(context) : '{}'}`,
    ].join('\n'), {
      systemPrompt: 'You are Stitchi, Tanaghum\'s governed annual commercial planning operator. Return valid JSON only and never claim external execution.',
      maxTokens: 1300,
      temperature: 0.2,
      timeoutMs: 30000,
    });
    const json = extractJsonObject(response.text);
    if (!json) throw new AppError('AI provider did not return annual plan JSON.', 502, 'STITCHI_AI_ANNUAL_PLAN_INVALID');
    enrichment = annualPlanAiEnrichmentSchema.parse(JSON.parse(json));
  } catch (error) {
    if (classifyStitchiProviderFailure(error) === 'unavailable') {
      return { kind: 'follow_up', providerType: providerStatus.type, providerModel: providerStatus.model, providerStatus: 'unavailable', assistantText: stitchiProviderUnavailableMessage() };
    }
    if (error instanceof AppError && error.code === 'STITCHI_AI_ANNUAL_PLAN_INVALID') throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new AppError('AI provider returned annual plan JSON that failed backend validation.', 502, 'STITCHI_AI_ANNUAL_PLAN_INVALID');
    }
    throw error;
  }

  const learningSetIds = context?.annualPlanning.approvedLearningSets.map(set => set.id) || [];
  const strategy = [
    enrichment.strategy,
    `Portfolio priorities:\n${enrichment.portfolioPriorities.map(value => `- ${value}`).join('\n')}`,
    enrichment.seasonalityNotes.length ? `Seasonality:\n${enrichment.seasonalityNotes.map(value => `- ${value}`).join('\n')}` : null,
    enrichment.assumptions.length ? `Assumptions:\n${enrichment.assumptions.map(value => `- ${value}`).join('\n')}` : null,
  ].filter(Boolean).join('\n\n');
  return {
    actionType: 'create_annual_commercial_plan',
    inputPayload: { year, title: enrichment.title, strategy, currency, budgetTarget, revenueTarget, learningSetIds },
    previewPayload: {
      year, title: enrichment.title, currency, budgetTarget, revenueTarget,
      portfolioPriorities: enrichment.portfolioPriorities,
      approvedLearningSets: learningSetIds.length,
      approvalRequired: true,
      externalSystemsCalled: false,
    },
    riskLevel: 'high',
    reason: `create the ${year} annual commercial plan using approved learning`,
    providerType: response.provider || providerStatus.type,
    providerModel: response.model || providerStatus.model || undefined,
  };
}

function deriveExecutiveReportActionProposal(content: string): ActionProposal | null {
  const lower = content.toLowerCase();
  if (!/(executive|ceo|gm|cco|leadership|daily|weekly|monthly|report|dashboard)/i.test(lower)) return null;
  if (!/(report schedule|schedule report|daily report|executive report|ceo report|gm report|cco report|9\s*am|nine\s*am|working day)/i.test(lower)) return null;
  const cadence = /weekly/i.test(lower)
    ? 'weekly'
    : /monthly/i.test(lower)
      ? 'monthly'
      : 'daily';
  const deliveryChannels = [
    ...(/email/i.test(lower) || /report/i.test(lower) ? ['email'] : []),
    ...(/whatsapp|notification/i.test(lower) ? ['whatsapp'] : []),
  ];
  const title = firstSentence(content, 'Daily 9 AM commercial executive report');
  return {
    actionType: 'create_executive_report_schedule',
    inputPayload: {
      cadence,
      timezone: 'Asia/Dubai',
      recipients: [],
      recipientRoles: ['admin', 'cco'],
      deliveryChannels: deliveryChannels.length ? deliveryChannels : ['email', 'whatsapp'],
      reportLanguage: /arabic|عربي|العربية/i.test(lower) ? 'Arabic' : 'English',
      reportSections: [
        'executive_summary',
        'revenue_lines',
        'channel_performance',
        'lead_funnel',
        'data_freshness',
        'connector_readiness',
        'department_work',
        'alerts',
        'missing_data',
      ],
      kpiPolicy: {},
      workingDaysOnly: true,
      sendHour: /9\s*am|nine\s*am/i.test(lower) ? 9 : 9,
      sendMinute: 0,
      approvalRequired: false,
    },
    previewPayload: {
      title,
      cadence,
      recipientRoles: ['CEO/GM', 'CCO'],
      deliveryChannels: deliveryChannels.length ? deliveryChannels : ['email', 'whatsapp'],
      reportLanguage: /arabic|عربي|العربية/i.test(lower) ? 'Arabic' : 'English',
      sendTime: '09:00 Asia/Dubai on working days',
      deliveryExecution: 'blocked until email and WhatsApp credentials plus delivery worker are ready',
      approvalRequired: true,
      externalExecution: 'blocked',
    },
    riskLevel: 'medium',
    reason: 'prepare an executive report workflow schedule',
  };
}

function deriveDisciplineActionProposal(
  content: string,
  eventId?: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): ActionProposal | null {
  const lower = content.toLowerCase();
  if (
    eventId
    && /(problem|risk|blocker|issue|delay|no-show|noshow)/i.test(lower)
    && !/(workspace|discipline|record|library|approved script|objection handling|brand voice|messaging library|crm data quality|reporting schedule|training library)/i.test(lower)
  ) {
    return null;
  }
  if (!/(brand|positioning|competitor|voice|message|messaging|partnership|acquisition|paid media|seo|keyword|influencer|attribution|conversion|closing|script|objection|closer|cro|growth|retention|upsell|platinum|b2b|trainer|loyalty|operations|crm|data quality|tech stack|reporting|training library|discipline|workspace)/i.test(lower)) {
    return null;
  }

  const discipline = inferDiscipline(lower, metadata);
  const category = inferDisciplineCategory(lower, discipline);
  const title = firstSentence(content, `${disciplineLabel(discipline)} record`);
  const revenueLineId = textMetadata(metadata, 'revenueLineId')
    || context?.commercialCenter?.revenueLines?.[0]?.id
    || undefined;
  const commercialPlanId = extractUuidAfter(lower, 'commercial plan') || textMetadata(metadata, 'commercialPlanId') || undefined;

  return {
    actionType: 'create_commercial_discipline_record',
    inputPayload: {
      discipline,
      category,
      title,
      summary: cleanText(content),
      details: cleanText(content),
      priority: /(critical|urgent|high|blocker|risk|important)/i.test(lower) ? 'high' : 'medium',
      status: /(draft|idea|proposal)/i.test(lower) ? 'draft' : 'active',
      sourceType: 'stitchi',
      revenueLineId: revenueLineId || undefined,
      commercialPlanId,
      eventId: eventId || textMetadata(metadata, 'eventId') || undefined,
    },
    previewPayload: {
      discipline,
      disciplineLabel: disciplineLabel(discipline),
      category,
      title,
      revenueLineId: revenueLineId || null,
      commercialPlanId: commercialPlanId || null,
      eventId: eventId || textMetadata(metadata, 'eventId') || null,
      approvalRequired: true,
      externalExecution: 'blocked',
    },
    riskLevel: 'medium',
    reason: `create a ${disciplineLabel(discipline)} workspace record`,
  };
}

async function deriveCommercialCenterActionProposalV2(
  content: string,
  userId: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): Promise<CommercialDerivation> {
  const lower = content.toLowerCase();
  if (!isCommercialCenterRequest(lower, metadata)) return null;

  const explicitRevenueLineType = inferExplicitRevenueLineType(lower);
  const fallbackRevenueLineType = explicitRevenueLineType || inferRevenueLineType(lower);
  const resolvedRevenueLine = resolveRevenueLine(content, context, metadata);
  const revenueLine = resolvedRevenueLine || (explicitRevenueLineType ? {
    id: null,
    type: explicitRevenueLineType,
    name: revenueLineLabel(explicitRevenueLineType),
    status: 'not_configured',
  } : null);
  const revenueLineId = revenueLine?.id
    || extractUuidAfter(lower, 'revenue line')
    || extractUuidAfter(lower, 'revenueLineId');
  const commercialPlanId = extractUuidAfter(lower, 'commercial plan') || extractUuidAfter(lower, 'plan') || extractUuidAfter(lower, 'commercialPlanId');
  const title = inferCommercialPlanTitle(content, revenueLine?.name || revenueLineLabel(fallbackRevenueLineType));

  if (commercialPlanId && /(update|change|edit|move|activate|pause|complete|budget|target|objective|audience|stage|status|link|event)/i.test(lower)) {
    const stage = inferCommercialStage(lower);
    const status = inferCommercialPlanStatus(lower);
    const linkedEvent = inferLinkedEvent(content, context);
    return {
      actionType: 'update_commercial_plan',
      inputPayload: {
        commercialPlanId,
        plan: {
          ...(status ? { status } : {}),
          ...(linkedEvent ? { linkedEventId: linkedEvent.id } : {}),
          stage,
          objective: cleanText(content),
          strategySummary: cleanText(content),
        },
      },
      previewPayload: {
        commercialPlanId,
        stage,
        status: status || 'unchanged',
        linkedEventId: linkedEvent?.id || null,
        linkedEventName: linkedEvent?.name || null,
        approvalRequired: true,
        externalExecution: 'blocked',
      },
      riskLevel: 'medium',
      reason: 'update a commercial planning record',
    };
  }

  const targetLineType = revenueLine?.type || fallbackRevenueLineType;
  if (!revenueLineId && isFutureRevenueLineType(targetLineType)) {
    return {
      kind: 'follow_up',
      assistantText: [
        `${revenueLineLabel(targetLineType)} is captured as a future revenue line, not an active operating line yet.`,
        'I can help record discovery notes, but leadership needs to enable this revenue line before I prepare plans, budgets, or revenue targets for daily execution.',
        'For active work today, choose Live Events, Online Courses, or Books.',
      ].join('\n'),
    };
  }

  if (/(risk|signal|assess|assessment|finding|problem|gap)/i.test(lower)) {
    return {
      actionType: 'create_commercial_assessment_signal',
      inputPayload: {
        revenueLineId,
        title,
        severity: /(critical|urgent|important|severe)/i.test(lower) ? 'critical' : 'watch',
        finding: cleanText(content),
        recommendedAction: 'Review this commercial signal and decide the next planning action.',
      },
      previewPayload: {
        revenueLineId: revenueLineId || 'not linked yet',
        revenueLineName: revenueLine?.name || revenueLineLabel(fallbackRevenueLineType),
        title,
        approvalRequired: true,
        externalExecution: 'blocked',
      },
      riskLevel: 'medium',
      reason: 'record a commercial assessment signal',
    };
  }

  if (/(plan|strategy|quarter|quarterly|year|implementation|create|prepare|build|launch)/i.test(lower)) {
    if (!revenueLine) {
      return {
        kind: 'follow_up',
        assistantText: [
          'Which revenue line should I use for this commercial plan?',
          'I can use Live Events, Online Courses, B2B, Platinum Elite, Certified Trainer Network, or Loyalty & Community.',
          'Once you choose one, I will prepare the plan card for approval.',
        ].join('\n'),
      };
    }
    const extractedPlan = extractCommercialPlanFields(content, context);
    const missing = requiredCommercialPlanFields(extractedPlan);
    if (missing.length > 0) {
      return {
        kind: 'follow_up',
        assistantText: formatCommercialPlanFollowUp(revenueLine.name, missing, extractedPlan),
      };
    }

    const stage = inferCommercialStage(lower);
    const enrichment = await enrichCommercialPlanWithLLM({
      userId,
      content,
      context,
      revenueLine,
      title,
      stage,
      extractedPlan,
    });
    if (isFollowUpResponse(enrichment)) return enrichment;
    const enrichedTitle = cleanAiText(enrichment.title, title, 260);
    const enrichedObjective = cleanAiText(enrichment.objective, extractedPlan.objective, 5000);
    const enrichedAudience = cleanAiText(enrichment.audience, extractedPlan.audience, 5000);
    const enrichedStrategySummary = buildAiStrategySummary(enrichment, extractedPlan.strategySummary);
    const enrichedActionPlan = buildAiActionPlan(enrichment, extractedPlan.actionPlan);
    const aiPreview = buildAiCommercialPreview(enrichment);

    if (!revenueLineId) {
      return {
        actionType: 'create_commercial_plan_with_revenue_line',
        inputPayload: {
          revenueLine: {
            revenueLineType: revenueLine.type,
            name: revenueLine.name,
            description: revenueLineLabel(revenueLine.type),
            status: 'active',
            systemOfRecord: 'tanaghum',
          },
          plan: {
            linkedEventId: extractedPlan.linkedEventId ?? undefined,
            horizon: inferCommercialHorizon(lower),
            stage,
            title: enrichedTitle,
            objective: enrichedObjective,
            audience: enrichedAudience,
            currency: extractedPlan.currency,
            budgetTarget: extractedPlan.budgetTarget,
            revenueTarget: extractedPlan.revenueTarget,
            strategySummary: enrichedStrategySummary,
            actionPlan: enrichedActionPlan,
            status: 'draft',
          },
        },
        previewPayload: {
          revenueLineId: null,
          revenueLineName: revenueLine.name,
          revenueLineSetup: 'will be configured before saving this plan',
          title: enrichedTitle,
          stage,
          objective: enrichedObjective,
          audience: enrichedAudience,
          currency: extractedPlan.currency,
          budgetTarget: extractedPlan.budgetTarget,
          revenueTarget: extractedPlan.revenueTarget,
          actionPlan: enrichedActionPlan,
          linkedEventId: extractedPlan.linkedEventId || null,
          linkedEventName: extractedPlan.linkedEventName || null,
          ...aiPreview,
          approvalRequired: true,
          externalExecution: 'blocked',
        },
        riskLevel: 'medium',
        reason: `configure ${revenueLine.name} and create a commercial plan`,
        providerType: enrichment.providerType,
        providerModel: enrichment.providerModel || undefined,
      };
    }

    return {
      actionType: 'create_commercial_plan',
      inputPayload: {
        revenueLineId,
        linkedEventId: extractedPlan.linkedEventId ?? undefined,
        horizon: inferCommercialHorizon(lower),
        stage,
        title: enrichedTitle,
        objective: enrichedObjective,
        audience: enrichedAudience,
        currency: extractedPlan.currency,
        budgetTarget: extractedPlan.budgetTarget,
        revenueTarget: extractedPlan.revenueTarget,
        strategySummary: enrichedStrategySummary,
        actionPlan: enrichedActionPlan,
        status: 'draft',
      },
      previewPayload: {
        revenueLineId,
        revenueLineName: revenueLine.name,
        title: enrichedTitle,
        stage,
        objective: enrichedObjective,
        audience: enrichedAudience,
        currency: extractedPlan.currency,
        budgetTarget: extractedPlan.budgetTarget,
        revenueTarget: extractedPlan.revenueTarget,
        actionPlan: enrichedActionPlan,
        linkedEventId: extractedPlan.linkedEventId || null,
        linkedEventName: extractedPlan.linkedEventName || null,
        ...aiPreview,
        approvalRequired: true,
        externalExecution: 'blocked',
      },
      riskLevel: 'medium',
      reason: `create a commercial plan for ${revenueLine.name}`,
      providerType: enrichment.providerType,
      providerModel: enrichment.providerModel || undefined,
    };
  }

  return {
    actionType: 'create_commercial_revenue_line',
    inputPayload: {
      revenueLineType: revenueLine?.type || fallbackRevenueLineType,
      name: revenueLine?.name || revenueLineLabel(fallbackRevenueLineType),
      description: cleanText(content),
      status: 'active',
      systemOfRecord: 'tanaghum',
    },
    previewPayload: {
      revenueLineType: revenueLine?.type || fallbackRevenueLineType,
      name: revenueLine?.name || revenueLineLabel(fallbackRevenueLineType),
      approvalRequired: true,
      externalExecution: 'blocked',
    },
    riskLevel: 'medium',
    reason: `configure the ${revenueLine?.name || revenueLineLabel(fallbackRevenueLineType)} commercial revenue line`,
  };
}

// Legacy fallback kept temporarily for audit comparison with the V2 commercial derivation path.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deriveCommercialCenterActionProposal(content: string): ActionProposal | null {
  const lower = content.toLowerCase();
  if (!/(commercial|revenue line|business line|online course|b2b|platinum|trainer network|loyalty|community|three-year|quarterly|department|ØªØ¬Ø§Ø±ÙŠ|Ø¯ÙˆØ±Ø©|Ø§ÙŠØ±Ø§Ø¯)/i.test(lower)) {
    return null;
  }

  const revenueLineType = inferRevenueLineType(lower);
  const revenueLineId = extractUuidAfter(lower, 'revenue line') || extractUuidAfter(lower, 'revenueLineId');
  const commercialPlanId = extractUuidAfter(lower, 'commercial plan') || extractUuidAfter(lower, 'plan') || extractUuidAfter(lower, 'commercialPlanId');
  const title = firstSentence(content, 'Commercial plan');

  if (commercialPlanId && /(update|change|edit|move|activate|pause|complete|budget|target|objective|audience|stage|status)/i.test(lower)) {
    const stage = inferCommercialStage(lower);
    const status = inferCommercialPlanStatus(lower);
    return {
      actionType: 'update_commercial_plan',
      inputPayload: {
        commercialPlanId,
        plan: {
          ...(status ? { status } : {}),
          stage,
          objective: cleanText(content),
          strategySummary: cleanText(content),
        },
      },
      previewPayload: {
        commercialPlanId,
        stage,
        status: status || 'unchanged',
        approvalRequired: true,
      },
      riskLevel: 'medium',
      reason: 'update a commercial planning record',
    };
  }

  if (/(risk|signal|assess|assessment|finding|problem|gap|ØªÙ‚ÙŠÙŠÙ…|Ù…Ø´ÙƒÙ„Ø©|ÙØ¬ÙˆØ©)/i.test(lower)) {
    return {
      actionType: 'create_commercial_assessment_signal',
      inputPayload: {
        revenueLineId,
        title,
        severity: /(critical|urgent|Ù‡Ø§Ù…|Ø­Ø±Ø¬|Ø¹Ø§Ø¬Ù„)/i.test(lower) ? 'critical' : 'watch',
        finding: cleanText(content),
        recommendedAction: 'Review this commercial signal and decide the next planning action.',
      },
      previewPayload: {
        revenueLineId: revenueLineId || 'not linked yet',
        title,
        approvalRequired: true,
      },
      riskLevel: 'medium',
      reason: 'record a commercial assessment signal',
    };
  }

  if (revenueLineId && /(plan|strategy|quarter|quarterly|year|implementation|Ø®Ø·Ø©|Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©)/i.test(lower)) {
    const stage = inferCommercialStage(lower);
    return {
      actionType: 'create_commercial_plan',
      inputPayload: {
        revenueLineId,
        horizon: inferCommercialHorizon(lower),
        stage,
        title,
        objective: cleanText(content),
        strategySummary: cleanText(content),
        actionPlan: 'Prepared by Stitchi from the user request. Review before execution.',
      },
      previewPayload: {
        revenueLineId,
        title,
        stage,
        approvalRequired: true,
      },
      riskLevel: 'medium',
      reason: 'create a commercial plan for this revenue line',
    };
  }

  return {
    actionType: 'create_commercial_revenue_line',
    inputPayload: {
      revenueLineType,
      name: revenueLineLabel(revenueLineType),
      description: cleanText(content),
      status: 'active',
      systemOfRecord: 'tanaghum',
    },
    previewPayload: {
      revenueLineType,
      name: revenueLineLabel(revenueLineType),
      approvalRequired: true,
    },
    riskLevel: 'medium',
    reason: `configure the ${revenueLineLabel(revenueLineType)} commercial revenue line`,
  };
}

function derivePlannerActionProposal(content: string, lower: string, eventId: string): ActionProposal | null {
  if (/(problem|risk|blocker|issue|objection|delay|no-show|noshow)/i.test(lower)) return null;
  if (!/(prepare|create|add|draft|plan|need|build|set up|setup|sequence|campaign|task|requirement|خطة|جهز|انشئ|اكتب)/i.test(lower)) return null;

  const description = cleanText(content);

  if (/(email|mail|newsletter|sequence|reminder email|ايميل|بريد)/i.test(lower)) {
    const sequenceName = firstSentence(content, 'Event email sequence');
    const emailCount = inferCount(lower, 3);
    return {
      actionType: 'create_email_plan',
      inputPayload: {
        eventId,
        sequenceName,
        audienceSegment: inferAudienceSegment(lower),
        emailCount,
        contentType: 'text',
        subjectDraft: sequenceName,
        contentDraft: description,
      },
      previewPayload: { eventId, sequenceName, emailCount, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'create an email campaign plan for this event',
    };
  }

  if (/(whatsapp|wa message|message plan|واتساب)/i.test(lower)) {
    const frequency = inferFrequency(lower);
    const contentType = inferWhatsappContentType(lower);
    return {
      actionType: 'create_whatsapp_plan',
      inputPayload: {
        eventId,
        audienceSegment: inferAudienceSegment(lower),
        frequency,
        contentType,
        messageDraft: description,
      },
      previewPayload: { eventId, frequency, contentType, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'create a WhatsApp outreach plan for this event',
    };
  }

  if (/(upsell|upgrade|vip|fomo|scarcity|limited seats|ترقية|عرض|محدود)/i.test(lower)) {
    const plannedChannel = inferChannels(lower)[0] || 'email';
    const offer = firstSentence(content, 'Event upsell offer');
    return {
      actionType: 'create_upsell_plan',
      inputPayload: {
        eventId,
        targetSegment: inferAudienceSegment(lower),
        offer,
        fomoAngle: description,
        plannedChannel,
      },
      previewPayload: { eventId, offer, plannedChannel, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'create an upsell plan for this event',
    };
  }

  if (/(content|creative|asset|video|image|caption|carousel|story|landing page|copy|المحتوى|فيديو|صورة)/i.test(lower)) {
    const assetType = inferAssetType(lower);
    const platform = inferChannels(lower)[0];
    const dueDate = dueDateIso(3);
    return {
      actionType: 'create_content_requirement',
      inputPayload: {
        eventId,
        assetType,
        description,
        platform,
        dueDate,
      },
      previewPayload: { eventId, assetType, platform: platform || 'not specified', dueDate, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'create a content requirement for the content team',
    };
  }

  if (/(sales task|follow-up task|follow up task|call task|meeting|no-show recovery|close|closing|inquiry|lead task|متابعة|اجتماع)/i.test(lower)) {
    const taskType = inferSalesTaskType(lower);
    const dueDate = dueDateIso(1);
    return {
      actionType: 'create_sales_task',
      inputPayload: {
        eventId,
        taskType,
        ownerRole: 'sales_manager',
        description,
        dueDate,
      },
      previewPayload: { eventId, taskType, ownerRole: 'sales_manager', dueDate, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'create a sales team task for this event',
    };
  }

  return null;
}

type DisciplineId =
  | 'brand_positioning'
  | 'acquisition'
  | 'conversion_closing'
  | 'growth_retention'
  | 'commercial_operations';

function inferDiscipline(lower: string, metadata?: Record<string, unknown>): DisciplineId {
  const metadataDiscipline = textMetadata(metadata, 'discipline');
  if (isDisciplineId(metadataDiscipline)) return metadataDiscipline;
  if (/(brand|positioning|competitor|voice|message|messaging|\bpr\b|partnership)/i.test(lower)) return 'brand_positioning';
  if (/(acquisition|paid media|ad |ads|seo|keyword|influencer|attribution|lead source)/i.test(lower)) return 'acquisition';
  if (/(conversion|closing|script|objection|closer|cro|landing page|sales call)/i.test(lower)) return 'conversion_closing';
  if (/(growth|retention|upsell|ascension|platinum|b2b|trainer|loyalty|community|renewal)/i.test(lower)) return 'growth_retention';
  return 'commercial_operations';
}

function inferDisciplineCategory(lower: string, discipline: DisciplineId):
  | 'research_note'
  | 'competitor_intelligence'
  | 'brand_voice'
  | 'messaging_library'
  | 'pr_partnership'
  | 'paid_media'
  | 'seo_keyword'
  | 'influencer_partnership'
  | 'attribution'
  | 'approved_script'
  | 'objection_handling'
  | 'closer_feedback'
  | 'cro_note'
  | 'upsell_ascension'
  | 'platinum_elite'
  | 'b2b_account'
  | 'trainer_network'
  | 'loyalty_lifecycle'
  | 'crm_data_quality'
  | 'tech_stack'
  | 'reporting_schedule'
  | 'training_library' {
  if (discipline === 'brand_positioning') {
    if (/competitor/i.test(lower)) return 'competitor_intelligence';
    if (/voice|tone/i.test(lower)) return 'brand_voice';
    if (/message|messaging|copy/i.test(lower)) return 'messaging_library';
    if (/pr|partner|partnership/i.test(lower)) return 'pr_partnership';
    return 'research_note';
  }
  if (discipline === 'acquisition') {
    if (/seo|keyword/i.test(lower)) return 'seo_keyword';
    if (/influencer|partner/i.test(lower)) return 'influencer_partnership';
    if (/attribution|source/i.test(lower)) return 'attribution';
    return 'paid_media';
  }
  if (discipline === 'conversion_closing') {
    if (/objection/i.test(lower)) return 'objection_handling';
    if (/closer|feedback|reason/i.test(lower)) return 'closer_feedback';
    if (/cro|landing page|form/i.test(lower)) return 'cro_note';
    return 'approved_script';
  }
  if (discipline === 'growth_retention') {
    if (/platinum|elite|premium/i.test(lower)) return 'platinum_elite';
    if (/b2b|corporate|enterprise/i.test(lower)) return 'b2b_account';
    if (/trainer|certified/i.test(lower)) return 'trainer_network';
    if (/loyalty|community|renewal|retention/i.test(lower)) return 'loyalty_lifecycle';
    return 'upsell_ascension';
  }
  if (/tech|stack|system|tool/i.test(lower)) return 'tech_stack';
  if (/report|schedule|cadence/i.test(lower)) return 'reporting_schedule';
  if (/training|script library|enablement/i.test(lower)) return 'training_library';
  return 'crm_data_quality';
}

function isDisciplineId(value: string): value is DisciplineId {
  return value === 'brand_positioning'
    || value === 'acquisition'
    || value === 'conversion_closing'
    || value === 'growth_retention'
    || value === 'commercial_operations';
}

function disciplineLabel(value: DisciplineId): string {
  return {
    brand_positioning: 'Brand & Positioning',
    acquisition: 'Acquisition',
    conversion_closing: 'Conversion & Closing',
    growth_retention: 'Growth & Retention',
    commercial_operations: 'Commercial Operations',
  }[value];
}

function textMetadata(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

type ResolvedRevenueLine = {
  id: string | null;
  type: CommercialRevenueLineType;
  name: string;
  status: string;
};

type ExtractedCommercialPlan = {
  objective: string | null;
  audience: string | null;
  currency: CommercialCurrency;
  budgetTarget: number | null;
  revenueTarget: number | null;
  actionPlan: string | null;
  strategySummary: string | null;
  linkedEventId: string | null;
  linkedEventName: string | null;
};

function isCommercialCenterRequest(lower: string, metadata?: Record<string, unknown>): boolean {
  if (typeof metadata?.revenueLineType === 'string') return true;
  if (
    typeof metadata?.revenueLineId === 'string'
    && /(commercial plan|plan|strategy|target|budget|revenue|launch|pipeline|forecast|report|dashboard|assessment|signal|quarterly|three-year)/i.test(lower)
  ) {
    return true;
  }
  if (/(commercial plan|revenue line|business line|online course|online courses|course launch|leadership course|book launch|books?|merchandise|merch|b2b|platinum|trainer network|loyalty|community)/i.test(lower)) {
    return true;
  }
  return /(commercial|three-year|quarterly|department)/i.test(lower) && /(plan|strategy|target|budget|revenue|launch|pipeline|forecast|report|dashboard|assessment|signal|risk|gap)/i.test(lower);
}

function resolveRevenueLine(
  content: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): ResolvedRevenueLine | null {
  const lines = context?.commercialCenter?.revenueLines || [];
  const metadataId = typeof metadata?.revenueLineId === 'string' ? metadata.revenueLineId : '';
  const metadataType = typeof metadata?.revenueLineType === 'string' ? metadata.revenueLineType : '';
  const direct = lines.find(line => (metadataId && line.id === metadataId) || (metadataType && line.type === metadataType));
  const directType = direct ? asCommercialRevenueLineType(direct.type) : null;
  if (direct) return {
    id: direct.id,
    type: directType || 'live_event',
    name: direct.name,
    status: direct.status,
  };

  const inferredType = inferExplicitRevenueLineType(content.toLowerCase());
  if (inferredType) {
    const byType = lines.find(line => line.type === inferredType);
    const typedByType = byType ? asCommercialRevenueLineType(byType.type) : null;
    if (byType) return {
      id: byType.id,
      type: typedByType || inferredType,
      name: byType.name,
      status: byType.status,
    };
  }

  const normalized = normalizeForMatch(content);
  const byName = lines.find(line => normalized.includes(normalizeForMatch(line.name)));
  const byNameType = byName ? asCommercialRevenueLineType(byName.type) : null;
  if (byName) return {
    id: byName.id,
    type: byNameType || 'live_event',
    name: byName.name,
    status: byName.status,
  };

  return null;
}

function asCommercialRevenueLineType(value: string): CommercialRevenueLineType | null {
  if (
    value === 'live_event'
    || value === 'online_course'
    || value === 'book'
    || value === 'merchandise'
    || value === 'b2b'
    || value === 'platinum_elite'
    || value === 'certified_trainer_network'
    || value === 'loyalty_community'
  ) {
    return value;
  }
  return null;
}

function extractCommercialPlanFields(content: string, context?: StitchiReadOnlyContext): ExtractedCommercialPlan {
  const objective = extractLabelValue(content, ['objective', 'goal', 'purpose']);
  const audience = extractLabelValue(content, ['audience', 'target audience', 'segment']);
  const currency = extractCommercialCurrency(content, context?.commercialCenter.defaultCurrency || 'AED');
  const budgetTarget = extractMoneyValue(content, ['budget target', 'budget', 'spend target']);
  const revenueTarget = extractMoneyValue(content, ['revenue target', 'sales target', 'target revenue']);
  const actionPlan = extractLabelValue(content, ['action plan', 'plan', 'next actions']);
  const linkedEvent = inferLinkedEvent(content, context);
  return {
    objective,
    audience,
    currency,
    budgetTarget,
    revenueTarget,
    actionPlan,
    strategySummary: cleanText(content),
    linkedEventId: linkedEvent?.id || null,
    linkedEventName: linkedEvent?.name || null,
  };
}

async function enrichCommercialPlanWithLLM(input: {
  userId: string;
  content: string;
  context?: StitchiReadOnlyContext;
  revenueLine: ResolvedRevenueLine;
  title: string;
  stage: string;
  extractedPlan: ExtractedCommercialPlan;
}): Promise<CommercialPlanAiEnrichment | FollowUpResponse> {
  let provider;
  try {
    provider = await resolveUserLLMProvider(input.userId);
  } catch (err) {
    if (isProviderRequiredError(err)) {
      return {
        kind: 'follow_up',
        providerType: 'none',
        providerStatus: 'required',
        assistantText: [
          'I can prepare this commercial plan only after your AI model is connected.',
          'Open AI Settings, connect Gemma or another approved provider, then send the request again.',
          'No commercial plan was created because this operator flow must be AI-assisted.',
        ].join('\n'),
      };
    }
    throw err;
  }

  const status = provider.getStatus();
  if (status.type === 'mock') {
    return {
      kind: 'follow_up',
      providerType: 'none',
      assistantText: [
        'I need a real AI model before I prepare this commercial plan.',
        'Mock AI is not accepted for production commercial operator work.',
        'Connect Gemma or another approved provider in AI Settings, then send the request again.',
      ].join('\n'),
    };
  }
  let response;
  let parsed;
  try {
    response = await provider.generate(buildCommercialPlanEnrichmentPrompt(input), {
      systemPrompt: COMMERCIAL_OPERATOR_SYSTEM_PROMPT,
      maxTokens: 1100,
      temperature: 0.25,
      timeoutMs: 30000,
    });
    parsed = parseCommercialPlanEnrichment(response.text);
  } catch (err) {
    if (isAiPlanInvalidError(err)) {
      return {
        kind: 'follow_up',
        providerType: 'none',
        assistantText: [
          'The AI model responded, but the commercial plan structure did not pass backend validation.',
          'No commercial plan was created.',
          'Please send the request again, and I will prepare a new approval card.',
        ].join('\n'),
      };
    }
    if (classifyStitchiProviderFailure(err) === 'unavailable') {
      return {
        kind: 'follow_up',
        providerType: status.type,
        providerModel: status.model,
        providerStatus: 'unavailable',
        assistantText: stitchiProviderUnavailableMessage(),
      };
    }
    throw err;
  }
  return {
    ...parsed,
    providerType: response.provider || status.type,
    providerModel: response.model || status.model || null,
  };
}

function buildCommercialPlanEnrichmentPrompt(input: {
  content: string;
  context?: StitchiReadOnlyContext;
  revenueLine: ResolvedRevenueLine;
  title: string;
  stage: string;
  extractedPlan: ExtractedCommercialPlan;
}): string {
  return [
    'Create AI-assisted commercial plan details for Tanaghum.',
    'Return JSON only. Do not wrap it in markdown.',
    '',
    'Required JSON shape:',
    JSON.stringify({
      title: 'short plan title',
      objective: 'clear commercial objective',
      audience: 'clear target audience',
      strategySummary: 'concise strategy summary',
      actionPlan: 'practical execution plan',
      contentPillars: ['pillar 1', 'pillar 2'],
      channelPlan: ['channel step 1', 'channel step 2'],
      ghlFollowUpPlan: 'CRM follow-up plan, no live execution',
      whatsappReminderPlan: 'WhatsApp reminder plan, no live execution',
      successMetrics: ['metric 1', 'metric 2'],
      assumptions: ['assumption 1'],
    }),
    '',
    'Rules:',
    '- Use the user request and Tanaghum context only.',
    '- Keep the budget target and revenue target exactly as provided by the backend context. Do not invent or change numbers.',
    '- Do not claim publishing, CRM writes, WhatsApp sending, calls, or external execution.',
    '- Make the plan useful for a sales and marketing manager selling courses or events.',
    '- If GHL, WhatsApp, ads, or analytics are mentioned, describe preparation/readiness only.',
    '',
    `Revenue line: ${input.revenueLine.name} (${input.revenueLine.type})`,
    `Operating stage: ${input.stage}`,
    `Backend title: ${input.title}`,
    `Backend objective: ${input.extractedPlan.objective}`,
    `Backend audience: ${input.extractedPlan.audience}`,
    `Backend budget target: ${input.extractedPlan.budgetTarget}`,
    `Backend revenue target: ${input.extractedPlan.revenueTarget}`,
    `Backend currency: ${input.extractedPlan.currency}`,
    `Backend linked event: ${input.extractedPlan.linkedEventName || 'none'}`,
    '',
    'User request:',
    input.content,
    '',
    'Tanaghum context:',
    input.context ? formatReadOnlyContextForPrompt(input.context) : '{}',
  ].join('\n');
}

function parseCommercialPlanEnrichment(text: string): z.infer<typeof commercialPlanAiEnrichmentSchema> {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    throw new AppError('AI provider did not return a valid commercial plan JSON object.', 502, 'STITCHI_AI_PLAN_INVALID');
  }
  try {
    return commercialPlanAiEnrichmentSchema.parse(JSON.parse(jsonText));
  } catch {
    throw new AppError('AI provider returned commercial plan JSON that failed backend validation.', 502, 'STITCHI_AI_PLAN_INVALID');
  }
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]?.trim().startsWith('{')) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

function cleanAiText(value: string | undefined, fallback: string | null, maxLength: number): string | null {
  const cleaned = cleanText(value || '');
  if (cleaned) return cleaned.slice(0, maxLength);
  return fallback ? cleanText(fallback).slice(0, maxLength) : null;
}

function buildAiStrategySummary(enrichment: CommercialPlanAiEnrichment, fallback: string | null): string | null {
  const parts = [
    cleanAiText(enrichment.strategySummary, fallback, 8000),
    formatAiList('Content pillars', enrichment.contentPillars),
    formatAiList('Channel plan', enrichment.channelPlan),
    enrichment.ghlFollowUpPlan ? `GHL follow-up plan: ${cleanText(enrichment.ghlFollowUpPlan)}` : null,
    enrichment.whatsappReminderPlan ? `WhatsApp reminder plan: ${cleanText(enrichment.whatsappReminderPlan)}` : null,
    formatAiList('Success metrics', enrichment.successMetrics),
    formatAiList('Assumptions', enrichment.assumptions),
  ].filter(Boolean);
  return parts.join('\n\n').slice(0, 8000) || null;
}

function buildAiActionPlan(enrichment: CommercialPlanAiEnrichment, fallback: string | null): string | null {
  const parts = [
    cleanAiText(enrichment.actionPlan, fallback, 8000),
    formatAiList('Channel sequence', enrichment.channelPlan),
    enrichment.ghlFollowUpPlan ? `GHL preparation: ${cleanText(enrichment.ghlFollowUpPlan)}` : null,
    enrichment.whatsappReminderPlan ? `WhatsApp preparation: ${cleanText(enrichment.whatsappReminderPlan)}` : null,
  ].filter(Boolean);
  return parts.join('\n\n').slice(0, 8000) || null;
}

function buildAiCommercialPreview(enrichment: CommercialPlanAiEnrichment): Record<string, unknown> {
  return {
    aiAssisted: true,
    aiProvider: enrichment.providerType,
    aiModel: enrichment.providerModel,
    aiSummary: cleanAiText(enrichment.strategySummary, null, 700),
    contentPillars: enrichment.contentPillars,
    channelPlan: enrichment.channelPlan,
    ghlFollowUpPlan: enrichment.ghlFollowUpPlan,
    whatsappReminderPlan: enrichment.whatsappReminderPlan,
    successMetrics: enrichment.successMetrics,
  };
}

function formatAiList(label: string, values?: string[]): string | null {
  const cleaned = (values || []).map(value => cleanText(value)).filter(Boolean).slice(0, 8);
  if (!cleaned.length) return null;
  return `${label}:\n${cleaned.map(value => `- ${value}`).join('\n')}`;
}

function isProviderRequiredError(err: unknown): boolean {
  return err instanceof AppError && err.code === 'LLM_PROVIDER_REQUIRED';
}

function isAiPlanInvalidError(err: unknown): boolean {
  return err instanceof AppError && err.code === 'STITCHI_AI_PLAN_INVALID';
}

function requiredCommercialPlanFields(plan: ExtractedCommercialPlan): string[] {
  const missing: string[] = [];
  if (!plan.objective) missing.push('objective');
  if (!plan.audience) missing.push('audience');
  if (plan.budgetTarget == null) missing.push('budget target');
  if (plan.revenueTarget == null) missing.push('revenue target');
  if (!plan.actionPlan) missing.push('action plan');
  return missing;
}

function formatCommercialPlanFollowUp(
  revenueLineName: string,
  missing: string[],
  plan: ExtractedCommercialPlan,
): string {
  const captured: string[] = [];
  if (plan.objective) captured.push(`objective: ${plan.objective}`);
  if (plan.audience) captured.push(`audience: ${plan.audience}`);
  if (plan.budgetTarget != null) captured.push(`budget target: ${plan.budgetTarget}`);
  if (plan.revenueTarget != null) captured.push(`revenue target: ${plan.revenueTarget}`);
  if (plan.actionPlan) captured.push(`action plan: ${plan.actionPlan}`);
  const capturedText = captured.length ? `\nI already captured: ${captured.join('; ')}.` : '';
  const missingText = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return [
    `I can prepare the ${revenueLineName} plan, but I need the ${missingText} before I create the approval card.`,
    capturedText.trim(),
    `Please send the missing ${missing.length === 1 ? 'field' : 'fields'}, and I will prepare the plan for approval.`,
  ].filter(Boolean).join('\n');
}

function inferCommercialPlanTitle(content: string, revenueLineName: string): string {
  const explicitTitle = extractLabelValue(content, ['title', 'plan title', 'campaign title']);
  if (explicitTitle) return explicitTitle.slice(0, 260);
  const launchMatch = content.match(/for\s+(?:a|an|the)?\s*([^.\n:]{8,120}?)(?:\.|\n|objective:|audience:|budget|revenue|action plan|$)/i);
  if (launchMatch?.[1]) return `${capitalizeWords(launchMatch[1].trim())}`.slice(0, 260);
  return `${revenueLineName} commercial plan`;
}

function extractLabelValue(content: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escaped}\\s*[:\\-]\\s*([^\\n]+)`, 'i').exec(content);
    if (match?.[1]?.trim()) return cleanText(match[1]).slice(0, 5000);
  }
  return null;
}

function extractMoneyValue(content: string, labels: string[]): number | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escaped}\\s*[:\\-]?\\s*([0-9][0-9,]*(?:\\.\\d+)?)`, 'i').exec(content);
    if (match?.[1]) {
      const parsed = Number(match[1].replaceAll(',', ''));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function extractCommercialCurrency(content: string, defaultCurrency: CommercialCurrency): CommercialCurrency {
  if (/\b(AED|UAE\s*dirham|dirhams?)\b/i.test(content)) return 'AED';
  if (/\b(USD|US\s*dollar|dollars?)\b|\$/i.test(content)) return 'USD';
  return defaultCurrency;
}

function inferLinkedEvent(content: string, context?: StitchiReadOnlyContext): { id: string; name: string } | null {
  const events = context?.recentEvents || [];
  if (!events.length) return null;
  const lower = content.toLowerCase();
  const explicit = events.find(event => normalizeForMatch(content).includes(normalizeForMatch(event.name)));
  if (explicit) return { id: explicit.id, name: explicit.name };
  if (!/(next available|next live event|linked event|link it|suitable event|available live event)/i.test(lower)) return null;
  const now = new Date();
  const future = events
    .filter(event => !['completed', 'cancelled', 'archived'].includes(event.status))
    .filter(event => new Date(event.eventDate).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  const selected = future[0] || events.find(event => !['completed', 'cancelled', 'archived'].includes(event.status));
  return selected ? { id: selected.id, name: selected.name } : null;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function capitalizeWords(value: string): string {
  return value.replace(/\b[a-z]/g, char => char.toUpperCase());
}

function inferRevenueLineType(lower: string): CommercialRevenueLineType {
  if (/(book|books|book launch|reader funnel|publication|author)/i.test(lower)) return 'book';
  if (/(merchandise|merch|product drop|bundle|t-shirt|shirt|hoodie)/i.test(lower)) return 'merchandise';
  if (/(online course|course|ÙƒÙˆØ±Ø³|Ø¯ÙˆØ±Ø©)/i.test(lower)) return 'online_course';
  if (/(b2b|corporate|company|enterprise|business user)/i.test(lower)) return 'b2b';
  if (/(platinum|elite|premium|vip)/i.test(lower)) return 'platinum_elite';
  if (/(trainer|certified trainer|network|Ù…Ø¯Ø±Ø¨)/i.test(lower)) return 'certified_trainer_network';
  if (/(loyalty|community|retention|referral|Ù…Ø¬ØªÙ…Ø¹)/i.test(lower)) return 'loyalty_community';
  return 'live_event';
}

function inferExplicitRevenueLineType(lower: string): ReturnType<typeof inferRevenueLineType> | undefined {
  if (/(book|books|book launch|reader funnel|publication|author)/i.test(lower)) return 'book';
  if (/(merchandise|merch|product drop|bundle|t-shirt|shirt|hoodie)/i.test(lower)) return 'merchandise';
  if (/(online course|online courses|course|courses|leadership course)/i.test(lower)) return 'online_course';
  if (/(b2b|corporate|company|enterprise|business user)/i.test(lower)) return 'b2b';
  if (/(platinum|elite|premium|vip)/i.test(lower)) return 'platinum_elite';
  if (/(certified trainer|trainer network)/i.test(lower)) return 'certified_trainer_network';
  if (/(loyalty|community|retention|referral)/i.test(lower)) return 'loyalty_community';
  if (/(live event|events|event campaign|on stage|workshop|camp)/i.test(lower)) return 'live_event';
  return undefined;
}

function revenueLineLabel(type: ReturnType<typeof inferRevenueLineType>): string {
  const labels: Record<ReturnType<typeof inferRevenueLineType>, string> = {
    live_event: 'Live Events',
    online_course: 'Online Courses',
    book: 'Books',
    merchandise: 'Merchandise',
    b2b: 'B2B',
    platinum_elite: 'Platinum Elite',
    certified_trainer_network: 'Certified Trainer Network',
    loyalty_community: 'Loyalty & Community',
  };
  return labels[type];
}

function isFutureRevenueLineType(type: CommercialRevenueLineType): boolean {
  return type === 'merchandise'
    || type === 'b2b'
    || type === 'platinum_elite'
    || type === 'certified_trainer_network'
    || type === 'loyalty_community';
}

function inferCommercialStage(lower: string): 'assess' | 'strategy_planning' | 'implementation_engagement' {
  if (/(implementation|engagement|execute|launch|follow-up|sales action|Ù†ÙØ°|ØªÙ†ÙÙŠØ°)/i.test(lower)) return 'implementation_engagement';
  if (/(strategy|planning|plan|budget|channels|Ø®Ø·Ø©|Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©)/i.test(lower)) return 'strategy_planning';
  return 'assess';
}

function inferCommercialHorizon(lower: string): 'three_year' | 'one_year' | 'quarterly' | 'product_or_event' {
  if (/(three-year|3 year|three year|3-year)/i.test(lower)) return 'three_year';
  if (/(one-year|1 year|annual|yearly)/i.test(lower)) return 'one_year';
  if (/(quarter|quarterly|q1|q2|q3|q4)/i.test(lower)) return 'quarterly';
  return 'product_or_event';
}

function inferCommercialPlanStatus(lower: string): 'draft' | 'active' | 'paused' | 'completed' | 'archived' | undefined {
  if (/(activate|active|start)/i.test(lower)) return 'active';
  if (/(pause|paused|hold)/i.test(lower)) return 'paused';
  if (/(complete|completed|done|finish)/i.test(lower)) return 'completed';
  if (/(archive|archived)/i.test(lower)) return 'archived';
  if (/(draft)/i.test(lower)) return 'draft';
  return undefined;
}

function extractUuidAfter(text: string, label: string): string | undefined {
  const uuidPattern = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
  const nearby = new RegExp(`${label}[^0-9a-f]{0,40}${uuidPattern}`, 'i').exec(text);
  if (nearby?.[1]) return nearby[1];
  return undefined;
}

function isExternalExecutionRequest(content: string): boolean {
  return /(publish|schedule|send whatsapp|send telegram|call the lead|write to ghl|crm write|post to instagram|نشر|ارسل|اتصل)/i.test(content);
}

function inferProblemCategory(lower: string): string {
  if (/(ad|ads|meta|campaign|dark ad)/i.test(lower)) return 'ads';
  if (/(audience|target|segment|جمهور)/i.test(lower)) return 'audience';
  if (/(funnel|form|landing|checkout)/i.test(lower)) return 'funnel';
  if (/(sales|lead|meeting|no-show|noshow|whatsapp|follow-up)/i.test(lower)) return 'sales';
  if (/(budget|spend|cost|cpl|cpa|ميزانية)/i.test(lower)) return 'budget';
  if (/(content|creative|video|copy|asset)/i.test(lower)) return 'content';
  if (/(api|integration|sync|connector)/i.test(lower)) return 'integration';
  return 'other';
}

function inferChannels(lower: string): string[] {
  const channels = new Set<string>();
  if (/instagram|انستغرام|انستجرام/i.test(lower)) channels.add('instagram');
  if (/linkedin/i.test(lower)) channels.add('linkedin');
  if (/x\/twitter|twitter|تويتر/i.test(lower)) channels.add('x');
  if (/whatsapp|واتساب/i.test(lower)) channels.add('whatsapp');
  if (/email|ايميل|بريد/i.test(lower)) channels.add('email');
  if (/youtube|يوتيوب/i.test(lower)) channels.add('youtube');
  if (/meta|facebook|فيسبوك/i.test(lower)) channels.add('meta');
  return [...channels];
}

function inferAudienceSegment(lower: string): string | undefined {
  if (/(buyer|purchased|customer|existing|عميل)/i.test(lower)) return 'Existing customers and previous buyers';
  if (/(warm|interested|booked|meeting)/i.test(lower)) return 'Warm leads and booked prospects';
  if (/(cold|non follower|non-follower)/i.test(lower)) return 'Cold audience and non-followers';
  if (/(followers|follower)/i.test(lower)) return 'Social followers';
  return undefined;
}

function inferCount(lower: string, fallback: number): number {
  const match = lower.match(/\b([1-9]|[1-4][0-9]|50)\b/);
  return match ? Number(match[1]) : fallback;
}

function inferFrequency(lower: string): string | undefined {
  if (/(daily|every day)/i.test(lower)) return 'daily';
  if (/(weekly|every week)/i.test(lower)) return 'weekly';
  if (/(twice|2 times|two times)/i.test(lower)) return 'twice during campaign';
  if (/(reminder|follow-up|follow up)/i.test(lower)) return 'follow-up reminders';
  return undefined;
}

function inferWhatsappContentType(lower: string): 'text' | 'image' | 'video' {
  if (/(video|فيديو)/i.test(lower)) return 'video';
  if (/(image|photo|creative|صورة)/i.test(lower)) return 'image';
  return 'text';
}

function inferAssetType(lower: string): 'video' | 'image' | 'caption' | 'landing_page' | 'carousel' | 'story' | 'email_template' | 'whatsapp_template' {
  if (/(landing page|page)/i.test(lower)) return 'landing_page';
  if (/carousel/i.test(lower)) return 'carousel';
  if (/story/i.test(lower)) return 'story';
  if (/(email template|newsletter)/i.test(lower)) return 'email_template';
  if (/(whatsapp template|whatsapp)/i.test(lower)) return 'whatsapp_template';
  if (/(image|photo|صورة)/i.test(lower)) return 'image';
  if (/(caption|copy)/i.test(lower)) return 'caption';
  return 'video';
}

function inferSalesTaskType(lower: string): 'inquiry_response' | 'follow_up' | 'closing' | 'discovery_call' | 'no_show_recovery' | 'feedback_collection' {
  if (/(no-show|noshow|no show)/i.test(lower)) return 'no_show_recovery';
  if (/(meeting|call|discovery)/i.test(lower)) return 'discovery_call';
  if (/(close|closing|purchase|payment)/i.test(lower)) return 'closing';
  if (/(feedback|survey)/i.test(lower)) return 'feedback_collection';
  if (/(inquiry|question|response)/i.test(lower)) return 'inquiry_response';
  return 'follow_up';
}

function dueDateIso(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

function buildOrchestrationPrompt(userRequest: string, context?: StitchiReadOnlyContext): string {
  return [
    `User request: ${userRequest}`,
    '',
    'Tanaghum context:',
    context ? formatReadOnlyContextForPrompt(context) : '{}',
  ].join('\n');
}

function firstSentence(text: string, fallback: string): string {
  const sanitized = cleanText(text);
  const sentence = sanitized.split(/[.!?\n]/)[0]?.trim() || fallback;
  return sentence.slice(0, 180);
}

function cleanText(value: string): string {
  const sanitized = sanitizeForStorage(value);
  return String(sanitized || '').trim().slice(0, 5000);
}

function normalizeText(value?: string): string {
  const trimmed = value?.trim();
  return trimmed || 'I could not complete this request. No system data was changed.';
}

async function persistOrchestrationWorkflow(input: {
  threadId: string;
  tenantKey: string;
  userId: string;
  stateSnapshot: Record<string, unknown>;
  resultPayload: Record<string, unknown>;
}) {
  await prisma.langGraphWorkflow.upsert({
    where: { thread_id: input.threadId },
    create: {
      thread_id: input.threadId,
      tenant_key: input.tenantKey,
      workflow_type: 'stitchi_natural_language_orchestration',
      status: 'completed',
      human_user_id: input.userId,
      checkpoint_strategy: 'langgraph_stategraph_with_database_state_snapshot',
      state_snapshot: toJsonObject(input.stateSnapshot),
      result_payload: toJsonObject(input.resultPayload),
      completed_at: new Date(),
    },
    update: {
      status: 'completed',
      state_snapshot: toJsonObject(input.stateSnapshot),
      result_payload: toJsonObject(input.resultPayload),
      completed_at: new Date(),
    },
  });
}

function toJsonObject(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

const ORCHESTRATOR_READ_ONLY_PROMPT = [
  'You are Stitchi, Tanaghum\'s governed operating assistant.',
  'Answer in business language for sales and marketing users.',
  'Use only supplied context. If data or credentials are missing, say what is needed.',
  'Do not claim external execution. Do not claim you changed data unless an approved action was executed by backend.',
  'Give concise next steps.',
].join('\n');

const COMMERCIAL_OPERATOR_SYSTEM_PROMPT = [
  'You are Stitchi, Tanaghum\'s AI-assisted commercial planning operator.',
  'You enrich sales and marketing plans for course, event, community, premium, and B2B revenue lines.',
  'Return valid JSON only, with no markdown and no extra prose.',
  'Do not claim that external systems were called.',
  'Do not schedule, publish, send messages, write to CRM, or call leads.',
  'Do not include secrets, API keys, raw credentials, or unsafe personal data.',
  'Keep the plan practical for a sales and marketing manager.',
].join('\n');
