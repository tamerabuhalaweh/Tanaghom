import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { AppError } from '@shared/errors';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import type { CommercialCurrency, CommercialRevenueLineType } from '@modules/commercial-command-center/types';
import * as historicalAssessmentService from '@modules/commercial-historical-assessment/service';
import { assessmentScopeSchema } from '@modules/commercial-historical-assessment/types';
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
  effectiveContent: Annotation<string | undefined>,
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
  const [context, messages] = await Promise.all([
    loadReadOnlyContext(state.tenantKey, conversation, state.eventId, state.role),
    repo.listMessages(state.tenantKey, state.userId, state.role, state.conversationId),
  ]);
  return {
    context,
    effectiveContent: buildEffectiveFollowUpRequest(state.content, messages),
    eventId: state.eventId || conversation.eventId || context.selectedEvent?.id || undefined,
  };
}

async function classifyNode(state: typeof orchestrationState.State): Promise<Partial<typeof orchestrationState.State>> {
  const effectiveContent = state.effectiveContent || state.content;
  if (isExternalExecutionRequest(effectiveContent)) {
    return {
      status: 'blocked' as const,
      assistantText: [
        'I cannot execute external publishing, CRM writes, WhatsApp, Telegram, or voice actions directly from chat.',
        'I can prepare the work, explain what is missing, or create an internal approval-gated task.',
        'Connect the required customer-owned account and use the governed workflow before any external execution.',
      ].join('\n'),
    };
  }
  const proposal = await deriveActionProposal(
    effectiveContent,
    state.userId,
    state.role,
    state.tenantKey,
    state.eventId,
    state.context,
    state.metadata,
  );
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

function buildEffectiveFollowUpRequest(
  currentContent: string,
  messages: StitchiMessageSummary[] | undefined,
): string {
  if (!messages?.length || currentContent.trim().length > 320) return currentContent;
  const recent = messages.slice(-8);
  const currentIndex = findLastIndex(recent, message => message.role === 'user' && message.content.trim() === currentContent.trim());
  const beforeCurrent = recent.slice(0, currentIndex >= 0 ? currentIndex : recent.length);
  const assistantIndex = findLastIndex(beforeCurrent, message => message.role === 'assistant');
  if (assistantIndex < 0) return currentContent;
  const assistant = beforeCurrent[assistantIndex];
  if (!/(still need|need the|tell me|provide|which (?:historical )?period|which month|select the|choose the|what is the|what are the|missing)/i.test(assistant.content)) {
    return currentContent;
  }
  const priorUser = [...beforeCurrent.slice(0, assistantIndex)].reverse().find(message => message.role === 'user');
  if (!priorUser || priorUser.content.trim() === currentContent.trim()) return currentContent;
  return `${priorUser.content.trim()}\nFollow-up answer: ${currentContent.trim()}`;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
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
      'An Admin or CCO must approve it before Tanaghum executes the internal update.',
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
    const messages = await repo.listMessages(tenantKey, userId, role, conversationId);
    const fallbackContent = buildEffectiveFollowUpRequest(input.content, messages);
    const fallbackProposal = await deriveActionProposal(
      fallbackContent,
      userId,
      role,
      tenantKey,
      fallbackEventId,
      context,
      input.metadata,
    );
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
  role: string,
  tenantKey: string,
  eventId?: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): Promise<ActionProposal | FollowUpResponse | null> {
  const executiveReportProposal = deriveExecutiveReportActionProposal(content);
  if (executiveReportProposal) return executiveReportProposal;
  const historicalAssessmentProposal = await deriveHistoricalAssessmentActionProposal(
    content,
    userId,
    role,
    tenantKey,
    context,
    metadata,
  );
  if (historicalAssessmentProposal) return historicalAssessmentProposal;
  const executionPlanProposal = await deriveMonthlyExecutionPlanActionProposal(
    content,
    userId,
    context,
    metadata,
  );
  if (executionPlanProposal) return executionPlanProposal;
  const annualPortfolioProposal = deriveAnnualPortfolioActionProposal(content, context, metadata);
  if (annualPortfolioProposal) return annualPortfolioProposal;
  const budgetProposal = deriveCommercialBudgetActionProposal(content, context, metadata);
  if (budgetProposal) return budgetProposal;
  const hierarchyProposal = deriveCommercialHierarchyActionProposal(content, eventId, context, metadata);
  if (hierarchyProposal) return hierarchyProposal;
  const annualPlanProposal = await deriveAnnualPlanActionProposal(content, userId, context);
  if (annualPlanProposal) return annualPlanProposal;
  const commercialProposal = await deriveCommercialCenterActionProposalV2(content, userId, context, metadata);
  if (commercialProposal) return commercialProposal;
  const disciplineProposal = deriveDisciplineActionProposal(content, eventId, context, metadata);
  if (disciplineProposal) return disciplineProposal;
  if (!eventId) return null;
  const lower = content.toLowerCase();
  const kpiGovernanceProposal = deriveKpiGovernanceActionProposal(content, lower, eventId);
  if (kpiGovernanceProposal) return kpiGovernanceProposal;
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

function deriveKpiGovernanceActionProposal(
  content: string,
  lower: string,
  eventId: string,
): ActionProposal | FollowUpResponse | null {
  if (/(venue|hall).{0,20}capacity|capacity.{0,20}(venue|hall)|sellable.{0,20}(ticket|capacity)/i.test(lower)) {
    const venueCapacity = extractMoneyValue(content, ['venue capacity', 'hall capacity', 'capacity']);
    const sellableTicketCapacity = extractMoneyValue(content, [
      'sellable ticket capacity',
      'sellable capacity',
      'ticket capacity',
    ]);
    const source = extractLabelValue(content, ['capacity evidence', 'capacity source', 'source']);
    const missing = [
      venueCapacity == null ? 'venue capacity' : null,
      sellableTicketCapacity == null ? 'sellable ticket capacity' : null,
      !source ? 'capacity evidence, such as the signed hall agreement' : null,
    ].filter(Boolean);
    if (missing.length) {
      return {
        kind: 'follow_up',
        assistantText: `I still need ${missing.join(' and ')}. No capacity value has been changed.`,
      };
    }
    return {
      actionType: 'set_event_capacity',
      inputPayload: {
        eventId,
        capacity: { venueCapacity, sellableTicketCapacity, source },
      },
      previewPayload: {
        eventId,
        venueCapacity,
        sellableTicketCapacity,
        source,
        absoluteLimit: true,
        approvalRequired: true,
      },
      riskLevel: 'high',
      reason: 'set the event venue and sellable ticket capacity',
    };
  }

  if (!/(kpi target|performance target|target kpi|cost per lead target|interaction rate target|daily ad spend limit|ticket sales target)/i.test(lower)) {
    return null;
  }
  const presets = [
    { pattern: /ticket sales/i, metricKey: 'ticket_sales', label: 'Ticket sales target', unit: 'count', direction: 'target', labels: ['ticket sales target', 'ticket target', 'target'] },
    { pattern: /cost per lead|\bcpl\b/i, metricKey: 'cost_per_lead', label: 'Maximum cost per lead', unit: 'currency', direction: 'maximum', labels: ['cost per lead target', 'cpl target', 'target'] },
    { pattern: /interaction rate|engagement rate/i, metricKey: 'interaction_rate', label: 'Minimum interaction rate', unit: 'percentage', direction: 'minimum', labels: ['interaction rate target', 'engagement rate target', 'target'] },
    { pattern: /daily ad spend|daily spend/i, metricKey: 'daily_ad_spend', label: 'Maximum daily ad spend', unit: 'currency', direction: 'maximum', labels: ['daily ad spend limit', 'daily spend target', 'target'] },
    { pattern: /purchase conversion|conversion rate/i, metricKey: 'purchase_conversion_rate', label: 'Minimum purchase conversion rate', unit: 'percentage', direction: 'minimum', labels: ['purchase conversion rate', 'conversion rate target', 'target'] },
  ] as const;
  const preset = presets.find(item => item.pattern.test(lower));
  if (!preset) {
    return {
      kind: 'follow_up',
      assistantText: 'Which event KPI should I prepare: ticket sales, cost per lead, interaction rate, daily ad spend, or purchase conversion rate?',
    };
  }
  const targetValue = extractMoneyValue(content, [...preset.labels]);
  if (targetValue == null) {
    return {
      kind: 'follow_up',
      assistantText: `What target value should I use for ${preset.label.toLowerCase()}? No target has been created.`,
    };
  }
  const usesThresholds = preset.direction === 'minimum' || preset.direction === 'maximum';
  const warningValue = usesThresholds
    ? extractMoneyValue(content, ['warning threshold', 'warning at', 'warning value'])
    : null;
  const criticalValue = usesThresholds
    ? extractMoneyValue(content, ['critical threshold', 'critical at', 'critical value'])
    : null;
  if (usesThresholds && (warningValue == null || criticalValue == null)) {
    const directionText = preset.direction === 'maximum' ? 'at or above' : 'at or below';
    return {
      kind: 'follow_up',
      assistantText: `What warning and critical values should apply ${directionText} for ${preset.label.toLowerCase()}? Both thresholds require CCO approval, and I will not invent them.`,
    };
  }
  return {
    actionType: 'create_governed_event_kpi_target',
    inputPayload: {
      metricKey: preset.metricKey,
      label: preset.label,
      unit: preset.unit,
      direction: preset.direction,
      scope: 'event',
      controlMode: 'adjustable',
      targetValue,
      ...(usesThresholds ? { warningValue, criticalValue } : {}),
      eventId,
      ...(preset.unit === 'currency' ? { currency: 'AED' } : {}),
    },
    previewPayload: {
      eventId,
      label: preset.label,
      targetValue,
      ...(usesThresholds ? { warningValue, criticalValue } : {}),
      unit: preset.unit,
      status: 'draft',
      approvalRequired: true,
      ccoControlled: true,
    },
    riskLevel: 'high',
    reason: `create the governed ${preset.label.toLowerCase()} target for this event`,
  };
}

async function deriveMonthlyExecutionPlanActionProposal(
  content: string,
  userId: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): Promise<CommercialDerivation> {
  const lower = content.toLowerCase();
  const selectedItemId = textMetadata(metadata, 'monthlyPortfolioItemId');
  const asksForExecutionPlan = /(execution plan|execute this initiative|run this initiative|detailed plan for.*initiative|plan for.*monthly initiative)/i.test(lower)
    || Boolean(selectedItemId && /(plan|strategy|launch|prepare|build)/i.test(lower));
  if (!asksForExecutionPlan || !selectedItemId) return null;

  const currentPlan = context?.annualPlanning?.currentPlan;
  const selectedAnnualPlanId = textMetadata(metadata, 'annualPlanId') || currentPlan?.id;
  if (!currentPlan || !selectedAnnualPlanId || currentPlan.id !== selectedAnnualPlanId) {
    return {
      kind: 'follow_up',
      assistantText: 'Open the annual plan and select a monthly initiative first. I need that approved planning context before I prepare an execution plan.',
    };
  }
  const item = currentPlan.monthlyItems.find(candidate => candidate.id === selectedItemId);
  if (!item) {
    return {
      kind: 'follow_up',
      assistantText: 'The selected monthly initiative is not part of the current annual plan. Refresh Annual Planning and choose the initiative again.',
    };
  }
  if (item.commercialPlanId) {
    return {
      kind: 'follow_up',
      assistantText: `The ${item.title} initiative already has an execution plan. Open that plan to review or update it instead of creating a duplicate.`,
    };
  }

  const objective = extractLabelValue(content, ['objective', 'goal', 'purpose']);
  const audience = extractLabelValue(content, ['audience', 'target audience', 'segment']);
  const actionPlan = extractLabelValue(content, ['action plan', 'next actions']);
  const missing = [
    objective ? null : 'objective',
    audience ? null : 'audience',
    actionPlan ? null : 'action plan',
  ].filter(Boolean);
  if (missing.length) {
    return {
      kind: 'follow_up',
      assistantText: [
        `I found ${item.title} in ${monthName(item.month)} and will inherit its ${item.currency} ${item.budgetAllocation} budget and ${item.revenueTarget} revenue target.`,
        `Before I prepare the execution plan, tell me the ${missing.join(', ')}.`,
        'No plan has been created.',
      ].join('\n'),
    };
  }

  const revenueLine = context?.commercialCenter.revenueLines.find(line => line.id === item.revenueLineId);
  const revenueLineType = revenueLine ? asCommercialRevenueLineType(revenueLine.type) : null;
  if (!revenueLine || !revenueLineType) {
    return {
      kind: 'follow_up',
      assistantText: 'The monthly initiative revenue line is not available. Ask a manager to repair the annual-plan item before creating execution work.',
    };
  }
  const linkedEvent = item.eventId
    ? context?.recentEvents.find(event => event.id === item.eventId) || context?.selectedEvent
    : null;
  const extractedPlan: ExtractedCommercialPlan = {
    objective,
    audience,
    currency: item.currency === 'USD' ? 'USD' : 'AED',
    budgetTarget: item.budgetAllocation,
    revenueTarget: item.revenueTarget,
    actionPlan,
    strategySummary: cleanText(content),
    linkedEventId: item.eventId,
    linkedEventName: linkedEvent?.name || null,
  };
  const title = inferCommercialPlanTitle(content, item.title) || `${item.title} execution plan`;
  const enrichment = await enrichCommercialPlanWithLLM({
    userId,
    content,
    context,
    revenueLine: {
      id: revenueLine.id,
      type: revenueLineType,
      name: revenueLine.name,
      status: revenueLine.status,
    },
    title,
    stage: 'strategy_planning',
    extractedPlan,
  });
  if (isFollowUpResponse(enrichment)) return enrichment;
  const enrichedTitle = cleanAiText(enrichment.title, title, 260);
  const enrichedObjective = cleanAiText(enrichment.objective, objective, 5000);
  const enrichedAudience = cleanAiText(enrichment.audience, audience, 5000);
  const enrichedStrategySummary = buildAiStrategySummary(enrichment, extractedPlan.strategySummary);
  const enrichedActionPlan = buildAiActionPlan(enrichment, actionPlan);

  return {
    actionType: 'create_execution_plan_for_monthly_item',
    inputPayload: {
      annualPlanId: currentPlan.id,
      itemId: item.id,
      executionPlan: {
        expectedRevision: currentPlan.revision,
        title: enrichedTitle,
        objective: enrichedObjective,
        audience: enrichedAudience,
        strategySummary: enrichedStrategySummary,
        actionPlan: enrichedActionPlan,
      },
    },
    previewPayload: {
      annualPlanTitle: currentPlan.title,
      year: currentPlan.year,
      month: monthName(item.month),
      monthlyInitiative: item.title,
      title: enrichedTitle,
      objective: enrichedObjective,
      audience: enrichedAudience,
      currency: item.currency,
      budgetTarget: item.budgetAllocation,
      revenueTarget: item.revenueTarget,
      linkedEventId: item.eventId,
      linkedEventName: linkedEvent?.name || null,
      ...buildAiCommercialPreview(enrichment),
      approvalRequired: true,
      externalExecution: 'blocked',
    },
    riskLevel: 'high',
    reason: `create the execution plan for ${item.title} under the ${currentPlan.year} annual plan`,
    providerType: enrichment.providerType,
    providerModel: enrichment.providerModel || undefined,
  };
}

async function deriveHistoricalAssessmentActionProposal(
  content: string,
  userId: string,
  role: string,
  tenantKey: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): Promise<CommercialDerivation> {
  const lower = content.toLowerCase();
  const decisionMatch = /\b(approve|accept|reject|decline)\b/i.exec(lower);
  if (decisionMatch && /(assessment finding|historical finding|learning finding|finding)/i.test(lower)) {
    const decision = /reject|decline/i.test(decisionMatch[1]) ? 'rejected' : 'approved';
    const findingId = textMetadata(metadata, 'findingId')
      || extractUuidAfter(lower, 'finding')
      || (context?.historicalAssessment.pendingFindings.length === 1
        ? context.historicalAssessment.pendingFindings[0].id
        : '');
    if (!findingId) {
      const options = context?.historicalAssessment.pendingFindings.map(finding => finding.title) || [];
      return {
        kind: 'follow_up',
        assistantText: options.length
          ? `Choose the assessment finding to ${decision === 'approved' ? 'approve' : 'reject'}: ${options.join('; ')}. No decision has been recorded.`
          : 'There is no pending historical assessment finding to review. Generate an evidence-backed assessment first.',
      };
    }
    return {
      actionType: 'decide_historical_assessment_finding',
      inputPayload: {
        findingId,
        decision: { decision, reason: cleanText(content) },
      },
      previewPayload: {
        findingId,
        decision,
        findingTitle: context?.historicalAssessment.pendingFindings.find(finding => finding.id === findingId)?.title,
        executiveApprovalRequired: true,
        externalSystemsCalled: false,
      },
      riskLevel: 'high',
      reason: `${decision === 'approved' ? 'approve' : 'reject'} the selected evidence-backed historical finding`,
    };
  }

  if (!/(historical|previous|past|prior|last year|last quarter|what worked|what failed)/i.test(lower)) return null;
  if (!/(assess|assessment|analy[sz]e|analysis|what worked|what failed|review (?:our )?(?:historical|previous|past|prior)|learn from (?:historical|previous|past|prior))/i.test(lower)) return null;

  const dateRange = extractAssessmentDateRange(content, metadata);
  if (!dateRange) {
    return {
      kind: 'follow_up',
      assistantText: [
        'Which historical period should I assess?',
        'Give me a year (for example, 2025) or a start and end date. You may also name a revenue line, event, campaign, audience, or channel.',
        'No assessment has been created.',
      ].join('\n'),
    };
  }

  const revenueLine = resolveRevenueLine(content, context, metadata);
  const allowedChannels = new Set(['meta', 'instagram', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual']);
  const channels = inferChannels(lower).filter(channel => allowedChannels.has(channel));
  const scope = assessmentScopeSchema.parse({
    revenueLineId: revenueLine?.id || null,
    eventIds: stringArrayMetadata(metadata, 'eventIds'),
    campaignIds: stringArrayMetadata(metadata, 'campaignIds'),
    audienceQuery: extractLabelValue(content, ['audience', 'audience segment']) || null,
    channels,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  });
  const preview = await historicalAssessmentService.previewAssessment(role, tenantKey, scope);
  if (!preview.evidence.length) {
    return {
      kind: 'follow_up',
      assistantText: [
        `I found no usable historical evidence for ${formatDateRange(dateRange.dateFrom, dateRange.dateTo)}${revenueLine ? ` in ${revenueLine.name}` : ''}.`,
        ...(preview.missingData.length ? preview.missingData.map(item => `- ${item}`) : ['- No completed commercial evidence matched this scope.']),
        'Connect or import the missing customer data, or choose a broader period. No assessment has been created.',
      ].join('\n'),
    };
  }

  let provider;
  try {
    provider = await resolveUserLLMProvider(userId);
  } catch (error) {
    if (isProviderRequiredError(error)) {
      return {
        kind: 'follow_up',
        providerType: 'none',
        providerStatus: 'required',
        assistantText: 'Connect Gemma or another approved AI model before Stitchi analyzes the evidence. The evidence preview succeeded, but no assessment was created.',
      };
    }
    throw error;
  }
  const providerStatus = provider.getStatus();
  if (providerStatus.type === 'mock') {
    return {
      kind: 'follow_up',
      providerType: 'none',
      providerStatus: 'required',
      assistantText: 'A real AI model is required for historical analysis. Mock output is not accepted for this production workflow.',
    };
  }

  const title = `${revenueLine?.name || 'Commercial'} assessment - ${formatDateRange(dateRange.dateFrom, dateRange.dateTo)}`;
  return {
    actionType: 'prepare_historical_commercial_assessment',
    inputPayload: {
      ...scope,
      dateFrom: dateRange.dateFrom.toISOString(),
      dateTo: dateRange.dateTo.toISOString(),
      title,
    },
    previewPayload: {
      title,
      revenueLineName: revenueLine?.name || 'All revenue lines',
      dateFrom: dateRange.dateFrom.toISOString(),
      dateTo: dateRange.dateTo.toISOString(),
      channels,
      evidenceCount: preview.evidence.length,
      evidenceSummary: preview.summary,
      missingData: preview.missingData,
      aiProvider: providerStatus.type,
      aiModel: providerStatus.model,
      approvalRequired: true,
      externalSystemsCalled: false,
    },
    riskLevel: 'high',
    reason: `snapshot ${preview.evidence.length} evidence record(s) and ask Stitchi to prepare the historical assessment`,
    providerType: providerStatus.type,
    providerModel: providerStatus.model || undefined,
  };
}

function deriveAnnualPortfolioActionProposal(
  content: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): CommercialDerivation {
  const lower = content.toLowerCase();
  const currentPlan = context?.annualPlanning?.currentPlan;
  const transitionTarget = inferAnnualPlanTransition(lower);
  if (transitionTarget) {
    if (!currentPlan) {
      return { kind: 'follow_up', assistantText: 'Create or select an annual commercial plan first. No status has been changed.' };
    }
    const reason = cleanText(content);
    if (transitionTarget === 'rejected' && reason.length < 3) {
      return { kind: 'follow_up', assistantText: 'Tell me why the annual plan should be rejected. A reason is required for the audit record.' };
    }
    return {
      actionType: 'transition_annual_commercial_plan',
      inputPayload: {
        annualPlanId: currentPlan.id,
        target: transitionTarget,
        decision: { expectedRevision: currentPlan.revision, reason },
      },
      previewPayload: {
        annualPlanTitle: currentPlan.title,
        currentStatus: currentPlan.status,
        targetStatus: transitionTarget,
        executiveApprovalRequired: ['approved', 'rejected'].includes(transitionTarget),
        approvalRequired: true,
      },
      riskLevel: 'high',
      reason: `move the ${currentPlan.year} annual plan to ${transitionTarget.replaceAll('_', ' ')}`,
    };
  }

  if (!/(monthly|portfolio item|initiative|calendar|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(lower)) {
    return null;
  }
  if (!/(add|create|schedule|plan|move|reschedule|update|change)/i.test(lower)) return null;
  if (!currentPlan) {
    return { kind: 'follow_up', assistantText: 'Create or select the annual commercial plan first. I need its approved year, currency, and revision before changing the monthly calendar.' };
  }

  const month = inferMonthNumber(content);
  if (!month) {
    return { kind: 'follow_up', assistantText: 'Which month should this product, event, or initiative appear in? No calendar item has been changed.' };
  }
  const isUpdate = /(move|reschedule|update|change)/i.test(lower);
  if (isUpdate) {
    const itemId = textMetadata(metadata, 'monthlyPortfolioItemId')
      || resolveMonthlyItem(content, currentPlan.monthlyItems)?.id;
    if (!itemId) {
      const options = currentPlan.monthlyItems.map(item => `${monthName(item.month)}: ${item.title}`);
      return {
        kind: 'follow_up',
        assistantText: options.length
          ? `Which monthly initiative should I change? Current items: ${options.join('; ')}. No item has been changed.`
          : 'There are no monthly initiatives to update. Ask me to add the first one instead.',
      };
    }
    const budget = extractMoneyValue(content, ['budget allocation', 'budget']);
    const revenue = extractMoneyValue(content, ['revenue target', 'revenue']);
    const changes: Record<string, unknown> = { expectedRevision: currentPlan.revision, month };
    if (budget != null) changes.budgetAllocation = budget;
    if (revenue != null) changes.revenueTarget = revenue;
    const revenueLine = resolveRevenueLine(content, context, metadata);
    if (revenueLine?.id) changes.revenueLineId = revenueLine.id;
    return {
      actionType: 'update_monthly_portfolio_item',
      inputPayload: { annualPlanId: currentPlan.id, itemId, changes },
      previewPayload: {
        annualPlanTitle: currentPlan.title,
        itemTitle: currentPlan.monthlyItems.find(item => item.id === itemId)?.title,
        moveToMonth: monthName(month),
        budgetAllocation: budget,
        revenueTarget: revenue,
        currency: currentPlan.currency,
        approvalRequired: true,
      },
      riskLevel: 'high',
      reason: `update the selected monthly initiative in ${monthName(month)}`,
    };
  }

  const revenueLine = resolveRevenueLine(content, context, metadata);
  if (!revenueLine?.id) {
    return { kind: 'follow_up', assistantText: 'Which revenue line owns this monthly initiative? Choose Live Events, Online Courses, Books, or another configured business line.' };
  }
  const budget = extractMoneyValue(content, ['budget allocation', 'budget']);
  const revenue = extractMoneyValue(content, ['revenue target', 'revenue']);
  const missing = [budget == null ? 'budget allocation' : null, revenue == null ? 'revenue target' : null].filter(Boolean);
  if (missing.length) {
    return {
      kind: 'follow_up',
      assistantText: `I still need the ${missing.join(' and ')} for the ${monthName(month)} initiative. The annual plan currency is ${currentPlan.currency}. No item has been created.`,
    };
  }
  const title = extractPortfolioItemTitle(content, revenueLine.name, month);
  return {
    actionType: 'create_monthly_portfolio_item',
    inputPayload: {
      annualPlanId: currentPlan.id,
      item: {
        expectedRevision: currentPlan.revision,
        month,
        revenueLineId: revenueLine.id,
        title,
        currency: extractCommercialCurrency(content, currentPlan.currency === 'USD' ? 'USD' : 'AED'),
        budgetAllocation: budget,
        revenueTarget: revenue,
        priority: inferPortfolioPriority(lower),
        readiness: 'planned',
      },
    },
    previewPayload: {
      annualPlanTitle: currentPlan.title,
      month: monthName(month),
      title,
      revenueLineName: revenueLine.name,
      budgetAllocation: budget,
      revenueTarget: revenue,
      currency: currentPlan.currency,
      approvalRequired: true,
      externalSystemsCalled: false,
    },
    riskLevel: 'high',
    reason: `add ${title} to the ${monthName(month)} annual portfolio`,
  };
}

function deriveCommercialBudgetActionProposal(
  content: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): CommercialDerivation {
  const lower = content.toLowerCase();
  if (!/(budget allocation|allocate budget|reallocate|budget exception|approve budget|commit budget|archive budget)/i.test(lower)) {
    return null;
  }
  const annualPlanId = textMetadata(metadata, 'annualPlanId') || context?.annualPlanning?.currentPlan?.id;
  const allocationId = textMetadata(metadata, 'budgetAllocationId') || extractUuidAfter(lower, 'allocation');
  const expectedRevision = numberMetadata(metadata, 'budgetRevision');
  const reason = cleanText(content);

  if (/(approve budget|commit budget|archive budget)/i.test(lower)) {
    const actionType = /commit budget/i.test(lower)
      ? 'commit_commercial_budget'
      : /archive budget/i.test(lower)
        ? 'archive_commercial_budget'
        : 'approve_commercial_budget';
    const missing = [annualPlanId ? null : 'annual plan', allocationId ? null : 'budget allocation', expectedRevision ? null : 'current allocation revision'].filter(Boolean);
    if (missing.length) {
      return {
        kind: 'follow_up',
        assistantText: `Open the budget allocation in Annual Planning first so I can safely ${actionType.split('_')[0]} it with the current revision. Missing: ${missing.join(', ')}. No budget was changed.`,
      };
    }
    return {
      actionType,
      inputPayload: {
        annualPlanId,
        allocationId,
        decision: { expectedRevision, reason },
      },
      previewPayload: { annualPlanId, allocationId, expectedRevision, approvalRequired: true },
      riskLevel: 'high',
      reason: `${actionType.split('_')[0]} the selected governed budget allocation`,
    };
  }

  const amount = extractMoneyValue(content, ['allocation amount', 'allocate', 'reallocate', 'amount', 'budget']);
  if (/reallocate/i.test(lower)) {
    const missing = [annualPlanId ? null : 'annual plan', allocationId ? null : 'budget allocation', expectedRevision ? null : 'current allocation revision', amount == null ? 'new amount' : null].filter(Boolean);
    if (missing.length) {
      return {
        kind: 'follow_up',
        assistantText: `I can prepare the reallocation after you provide the ${missing.join(', ')}. Open the allocation in Annual Planning and state the new amount. No budget was changed.`,
      };
    }
    const allowOverAllocation = /exception|over[- ]allocat/i.test(lower);
    return {
      actionType: 'reallocate_commercial_budget',
      inputPayload: {
        annualPlanId,
        allocationId,
        change: {
          expectedRevision,
          amount,
          reason,
          allowOverAllocation,
          ...(allowOverAllocation ? { exceptionReason: reason } : {}),
        },
      },
      previewPayload: { annualPlanId, allocationId, amount, allowOverAllocation, approvalRequired: true },
      riskLevel: 'high',
      reason: 'reallocate the selected governed budget with permanent audit evidence',
    };
  }

  const level = textMetadata(metadata, 'budgetLevel');
  const targetId = textMetadata(metadata, 'budgetTargetId');
  const parentAllocationId = textMetadata(metadata, 'parentAllocationId') || null;
  const currency = textMetadata(metadata, 'budgetCurrency') || context?.commercialCenter.defaultCurrency || 'AED';
  const missing = [annualPlanId ? null : 'annual plan', level ? null : 'allocation level', targetId ? null : 'target work item', amount == null ? 'amount' : null].filter(Boolean);
  if (missing.length) {
    return {
      kind: 'follow_up',
      assistantText: `I can allocate this budget after you select the work item in Annual Planning and provide the ${missing.join(', ')}. No budget was changed.`,
    };
  }
  const targetKey = level === 'monthly_item'
    ? 'monthlyPortfolioItemId'
    : level === 'commercial_plan'
      ? 'commercialPlanId'
      : level === 'event'
        ? 'eventId'
        : 'campaignId';
  const allowOverAllocation = /exception|over[- ]allocat/i.test(lower);
  return {
    actionType: 'create_commercial_budget_allocation',
    inputPayload: {
      annualPlanId,
      allocation: {
        level,
        parentAllocationId,
        [targetKey]: targetId,
        currency,
        amount,
        reason,
        allowOverAllocation,
        ...(allowOverAllocation ? { exceptionReason: reason } : {}),
      },
    },
    previewPayload: { annualPlanId, level, targetId, currency, amount, allowOverAllocation, approvalRequired: true },
    riskLevel: 'high',
    reason: 'allocate budget to the selected commercial work item',
  };
}

function deriveCommercialHierarchyActionProposal(
  content: string,
  eventId?: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): CommercialDerivation {
  const lower = content.toLowerCase();
  if (isStandaloneExceptionRequest(lower)) return null;
  if (!/(connect|link|assign|attach|use approved learning)/i.test(lower)) return null;

  const commercialPlanId = extractUuidAfter(lower, 'commercial plan')
    || textMetadata(metadata, 'commercialPlanId')
    || (context?.commercialCenter.recentPlans.length === 1 ? context.commercialCenter.recentPlans[0].id : '');
  const annualPlanId = extractUuidAfter(lower, 'annual plan')
    || textMetadata(metadata, 'annualPlanId')
    || context?.annualPlanning?.currentPlan?.id;
  const monthlyPortfolioItemId = extractUuidAfter(lower, 'monthly item')
    || extractUuidAfter(lower, 'monthly initiative')
    || textMetadata(metadata, 'monthlyPortfolioItemId')
    || resolveMonthlyItem(content, context?.annualPlanning?.currentPlan?.monthlyItems || [])?.id;

  if (/(annual plan|annual strategy|monthly item|monthly initiative|annual parent)/i.test(lower)) {
    const missing = [
      commercialPlanId ? null : 'execution plan',
      annualPlanId ? null : 'annual plan',
      monthlyPortfolioItemId ? null : 'monthly initiative',
    ].filter(Boolean);
    if (missing.length) {
      return {
        kind: 'follow_up',
        assistantText: `I can connect this hierarchy after you select the ${missing.join(', ')} in Annual Planning. No record has been changed.`,
      };
    }
    return {
      actionType: 'assign_commercial_plan_hierarchy',
      inputPayload: { commercialPlanId, annualPlanId, monthlyPortfolioItemId },
      previewPayload: {
        commercialPlanId,
        annualPlanId,
        monthlyPortfolioItemId,
        approvalRequired: true,
      },
      riskLevel: 'medium',
      reason: 'connect the execution plan to its annual strategy and monthly initiative',
    };
  }

  if (/(event|event operations)/i.test(lower)) {
    const selectedEventId = extractUuidAfter(lower, 'event') || textMetadata(metadata, 'eventId') || eventId;
    if (!commercialPlanId) return null;
    if (!selectedEventId) {
      return {
        kind: 'follow_up',
        assistantText: 'Choose both the execution plan and event first. I will then prepare the connection for approval.',
      };
    }
    return {
      actionType: 'link_commercial_plan_event',
      inputPayload: { commercialPlanId, eventId: selectedEventId, primary: true },
      previewPayload: { commercialPlanId, eventId: selectedEventId, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'connect Event Operations to the approved commercial execution plan',
    };
  }

  if (/campaign/i.test(lower)) {
    const campaignId = extractUuidAfter(lower, 'campaign') || textMetadata(metadata, 'campaignId');
    if (!commercialPlanId || !campaignId) {
      return {
        kind: 'follow_up',
        assistantText: 'Choose both the execution plan and campaign first. I will then prepare the connection for approval.',
      };
    }
    return {
      actionType: 'link_commercial_plan_campaign',
      inputPayload: { commercialPlanId, campaignId },
      previewPayload: { commercialPlanId, campaignId, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'connect the campaign to the approved commercial execution plan',
    };
  }

  if (/(learning|finding)/i.test(lower)) {
    const learningSetId = extractUuidAfter(lower, 'learning set') || textMetadata(metadata, 'learningSetId');
    const findingId = extractUuidAfter(lower, 'finding') || textMetadata(metadata, 'findingId');
    if (!commercialPlanId || !learningSetId || !findingId) {
      return {
        kind: 'follow_up',
        assistantText: 'Choose the execution plan and an approved assessment finding first. I will record why that learning guides the plan after approval.',
      };
    }
    return {
      actionType: 'link_commercial_plan_learning',
      inputPayload: { commercialPlanId, learningSetId, findingIds: [findingId], rationale: cleanText(content) },
      previewPayload: { commercialPlanId, learningSetId, findingId, approvalRequired: true },
      riskLevel: 'medium',
      reason: 'record approved historical learning behind the execution plan',
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
  if (isStandaloneExceptionRequest(lower)) return null;
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

  const learningSetIds = context?.annualPlanning?.approvedLearningSets.map(set => set.id) || [];
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
    const standaloneException = isStandaloneExceptionRequest(lower);
    if (!standaloneException) {
      const currentAnnualPlan = context?.annualPlanning?.currentPlan;
      const availableItems = currentAnnualPlan?.monthlyItems.filter(item => !item.commercialPlanId) || [];
      return {
        kind: 'follow_up',
        assistantText: currentAnnualPlan
          ? [
            `This work should be created from a monthly initiative in the ${currentAnnualPlan.year} annual plan.`,
            availableItems.length
              ? `Choose one of these unplanned initiatives: ${availableItems.slice(0, 6).map(item => `${monthName(item.month)} - ${item.title}`).join('; ')}.`
              : 'There are no monthly initiatives available for a new execution plan. Add one in Annual Planning first.',
            'If this is genuinely unplanned work, explicitly ask for a standalone exception and explain why it cannot belong to the annual calendar.',
          ].join('\n')
          : [
            'Create the annual plan and its monthly initiative first, then I can prepare the execution plan with inherited budget, revenue, event, and learning context.',
            'If this is genuinely unplanned work, explicitly ask for a standalone exception and explain why it cannot belong to an annual month.',
            'No plan has been created.',
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
            standaloneReason: cleanText(content),
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
        standaloneReason: cleanText(content),
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

function numberMetadata(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function stringArrayMetadata(metadata: Record<string, unknown> | undefined, key: string): string[] {
  const value = metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function extractAssessmentDateRange(
  content: string,
  metadata?: Record<string, unknown>,
): { dateFrom: Date; dateTo: Date } | null {
  const metadataFrom = textMetadata(metadata, 'dateFrom');
  const metadataTo = textMetadata(metadata, 'dateTo');
  if (metadataFrom && metadataTo) {
    const dateFrom = new Date(metadataFrom);
    const dateTo = new Date(metadataTo);
    if (!Number.isNaN(dateFrom.getTime()) && !Number.isNaN(dateTo.getTime()) && dateFrom <= dateTo) {
      return { dateFrom, dateTo };
    }
  }
  const isoDates = [...content.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map(match => match[1]);
  if (isoDates.length >= 2) {
    const dateFrom = new Date(`${isoDates[0]}T00:00:00.000Z`);
    const dateTo = new Date(`${isoDates[1]}T23:59:59.999Z`);
    if (dateFrom <= dateTo) return { dateFrom, dateTo };
  }
  const now = new Date();
  const explicitYear = /\b(20\d{2})\b/.exec(content);
  const year = explicitYear
    ? Number(explicitYear[1])
    : /last year|previous year|prior year/i.test(content)
      ? now.getUTCFullYear() - 1
      : null;
  if (year) {
    return {
      dateFrom: new Date(Date.UTC(year, 0, 1)),
      dateTo: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (/last quarter|previous quarter/i.test(content)) {
    const currentQuarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const currentQuarterStart = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStartMonth, 1));
    const dateTo = new Date(currentQuarterStart.getTime() - 1);
    const dateFrom = new Date(Date.UTC(dateTo.getUTCFullYear(), Math.floor(dateTo.getUTCMonth() / 3) * 3, 1));
    return { dateFrom, dateTo };
  }
  return null;
}

function formatDateRange(dateFrom: Date, dateTo: Date): string {
  return `${dateFrom.toISOString().slice(0, 10)} to ${dateTo.toISOString().slice(0, 10)}`;
}

function inferAnnualPlanTransition(lower: string): 'pending_approval' | 'approved' | 'rejected' | 'active' | 'closed' | 'archived' | null {
  if (!/(annual plan|annual strategy|year plan)/i.test(lower)) return null;
  if (/\b(?:submit|send)\b.*?\b(?:approval|review)\b|\bpending approval\b/i.test(lower)) return 'pending_approval';
  if (/\b(?:approve|accept)\b.*?\b(?:annual plan|annual strategy)\b|\b(?:annual plan|annual strategy)\b.*?\b(?:approve|accept)\b/i.test(lower)) return 'approved';
  if (/\b(?:reject|decline)\b.*?\b(?:annual plan|annual strategy)\b|\b(?:annual plan|annual strategy)\b.*?\b(?:reject|decline)\b/i.test(lower)) return 'rejected';
  if (/\b(?:activate|start)\b.*?\b(?:annual plan|annual strategy)\b|\b(?:annual plan|annual strategy)\b.*?\b(?:activate|start)\b/i.test(lower)) return 'active';
  if (/\b(?:close|complete)\b.*?\b(?:annual plan|annual strategy)\b|\b(?:annual plan|annual strategy)\b.*?\b(?:close|complete)\b/i.test(lower)) return 'closed';
  if (/\barchive\b.*?\b(?:annual plan|annual strategy)\b|\b(?:annual plan|annual strategy)\b.*?\barchive\b/i.test(lower)) return 'archived';
  return null;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

function inferMonthNumber(content: string): number | null {
  const lower = content.toLowerCase();
  const targeted = new RegExp(`(?:to|into|in|for)\\s+(${MONTH_NAMES.join('|')})\\b`, 'gi');
  const targetedMatches = [...lower.matchAll(targeted)];
  const name = targetedMatches.at(-1)?.[1]
    || [...lower.matchAll(new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`, 'gi'))].at(-1)?.[1];
  if (name) return MONTH_NAMES.indexOf(name.toLowerCase() as (typeof MONTH_NAMES)[number]) + 1;
  const numeric = /\bmonth\s*(1[0-2]|[1-9])\b/i.exec(content);
  return numeric ? Number(numeric[1]) : null;
}

function monthName(month: number): string {
  return MONTH_NAMES[month - 1]
    ? `${MONTH_NAMES[month - 1][0].toUpperCase()}${MONTH_NAMES[month - 1].slice(1)}`
    : `Month ${month}`;
}

function resolveMonthlyItem(
  content: string,
  items: NonNullable<StitchiReadOnlyContext['annualPlanning']['currentPlan']>['monthlyItems'],
) {
  const lower = normalizeForMatch(content);
  const byTitle = items.find(item => lower.includes(normalizeForMatch(item.title)));
  if (byTitle) return byTitle;
  const sourceMonth = new RegExp(`(?:from|currently in)\\s+(${MONTH_NAMES.join('|')})\\b`, 'i').exec(content)?.[1];
  if (sourceMonth) {
    const month = MONTH_NAMES.indexOf(sourceMonth.toLowerCase() as (typeof MONTH_NAMES)[number]) + 1;
    const candidates = items.filter(item => item.month === month);
    if (candidates.length === 1) return candidates[0];
  }
  return items.length === 1 ? items[0] : undefined;
}

function extractPortfolioItemTitle(content: string, revenueLineName: string, month: number): string {
  const explicit = extractLabelValue(content, ['title', 'initiative', 'product', 'event']);
  if (explicit) return explicit.slice(0, 220);
  const match = /(?:add|create|schedule|plan)\s+(?:a|an|the)?\s*([^.:\n]{2,160}?)(?:\s+(?:in|for)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|[.:\n]|$)/i.exec(content);
  return cleanText(match?.[1] || `${revenueLineName} initiative - ${monthName(month)}`).slice(0, 220);
}

function inferPortfolioPriority(lower: string): 'low' | 'medium' | 'high' | 'critical' {
  if (/critical|urgent|must win/i.test(lower)) return 'critical';
  if (/high priority|priority high|important/i.test(lower)) return 'high';
  if (/low priority|optional/i.test(lower)) return 'low';
  return 'medium';
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

function isStandaloneExceptionRequest(lower: string): boolean {
  return /(standalone|stand-alone|ad hoc|ad-hoc|one-off|unplanned exception|outside (?:the )?annual|not part of (?:the )?annual)/i.test(lower);
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
