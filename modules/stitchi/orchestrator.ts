import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { AppError } from '@shared/errors';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import type { CommercialRevenueLineType } from '@modules/commercial-command-center/types';
import { formatReadOnlyContextForPrompt, loadReadOnlyContext, type StitchiReadOnlyContext } from './context';
import { checkStitchiPermission } from './policy';
import * as repo from './repository';
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
}

interface FollowUpResponse {
  kind: 'follow_up';
  assistantText: string;
}

type CommercialDerivation = ActionProposal | FollowUpResponse | null;

export interface StitchiOrchestrationResult {
  userMessage: StitchiMessageSummary;
  assistantMessage: StitchiMessageSummary;
  actionRun: StitchiActionRunSummary | null;
  status: OrchestrationStatus;
  provider: {
    status: 'used' | 'required' | 'not_needed';
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

function classifyNode(state: typeof orchestrationState.State): Partial<typeof orchestrationState.State> {
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
  const proposal = deriveActionProposal(state.content, state.eventId, state.context, state.metadata);
  if (isFollowUpResponse(proposal)) {
    return {
      status: 'answered' as const,
      assistantText: proposal.assistantText,
    };
  }
  if (proposal) return { actionProposal: proposal };
  return {};
}

function isFollowUpResponse(value: ActionProposal | FollowUpResponse | null): value is FollowUpResponse {
  return Boolean(value && 'kind' in value && value.kind === 'follow_up');
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

  try {
    const provider = await resolveUserLLMProvider(state.userId);
    const providerStatus = provider.getStatus();
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

  if (!result.actionRun && !result.actionProposal && !result.assistantText) {
    const conversation = await repo.getConversation(tenantKey, userId, role, conversationId);
    const context = await loadReadOnlyContext(tenantKey, conversation, input.eventId, role);
    const fallbackEventId = input.eventId || conversation.eventId || context.selectedEvent?.id || undefined;
    const fallbackProposal = deriveActionProposal(input.content, fallbackEventId, context, input.metadata);
    if (isFollowUpResponse(fallbackProposal)) {
      result = {
        ...result,
        context,
        eventId: fallbackEventId,
        status: 'answered',
        assistantText: fallbackProposal.assistantText,
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
        providerType: 'none',
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
      status: result.providerType === 'none' ? 'required' : result.providerType ? 'used' : 'not_needed',
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

function deriveActionProposal(
  content: string,
  eventId?: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): ActionProposal | FollowUpResponse | null {
  const commercialProposal = deriveCommercialCenterActionProposalV2(content, context, metadata);
  if (commercialProposal) return commercialProposal;
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

function deriveCommercialCenterActionProposalV2(
  content: string,
  context?: StitchiReadOnlyContext,
  metadata?: Record<string, unknown>,
): CommercialDerivation {
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
        externalExecution: 'blocked',
      },
      riskLevel: 'medium',
      reason: 'update a commercial planning record',
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
            title,
            objective: extractedPlan.objective,
            audience: extractedPlan.audience,
            budgetTarget: extractedPlan.budgetTarget,
            revenueTarget: extractedPlan.revenueTarget,
            strategySummary: extractedPlan.strategySummary,
            actionPlan: extractedPlan.actionPlan,
            status: 'draft',
          },
        },
        previewPayload: {
          revenueLineId: null,
          revenueLineName: revenueLine.name,
          revenueLineSetup: 'will be configured before saving this plan',
          title,
          stage,
          objective: extractedPlan.objective,
          audience: extractedPlan.audience,
          budgetTarget: extractedPlan.budgetTarget,
          revenueTarget: extractedPlan.revenueTarget,
          actionPlan: extractedPlan.actionPlan,
          linkedEventId: extractedPlan.linkedEventId || null,
          linkedEventName: extractedPlan.linkedEventName || null,
          approvalRequired: true,
          externalExecution: 'blocked',
        },
        riskLevel: 'medium',
        reason: `configure ${revenueLine.name} and create a commercial plan`,
      };
    }

    return {
      actionType: 'create_commercial_plan',
      inputPayload: {
        revenueLineId,
        linkedEventId: extractedPlan.linkedEventId ?? undefined,
        horizon: inferCommercialHorizon(lower),
        stage,
        title,
        objective: extractedPlan.objective,
        audience: extractedPlan.audience,
        budgetTarget: extractedPlan.budgetTarget,
        revenueTarget: extractedPlan.revenueTarget,
        strategySummary: extractedPlan.strategySummary,
        actionPlan: extractedPlan.actionPlan,
        status: 'draft',
      },
      previewPayload: {
        revenueLineId,
        revenueLineName: revenueLine.name,
        title,
        stage,
        objective: extractedPlan.objective,
        audience: extractedPlan.audience,
        budgetTarget: extractedPlan.budgetTarget,
        revenueTarget: extractedPlan.revenueTarget,
        actionPlan: extractedPlan.actionPlan,
        linkedEventId: extractedPlan.linkedEventId || null,
        linkedEventName: extractedPlan.linkedEventName || null,
        approvalRequired: true,
        externalExecution: 'blocked',
      },
      riskLevel: 'medium',
      reason: `create a commercial plan for ${revenueLine.name}`,
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

type ResolvedRevenueLine = {
  id: string | null;
  type: CommercialRevenueLineType;
  name: string;
  status: string;
};

type ExtractedCommercialPlan = {
  objective: string | null;
  audience: string | null;
  budgetTarget: number | null;
  revenueTarget: number | null;
  actionPlan: string | null;
  strategySummary: string | null;
  linkedEventId: string | null;
  linkedEventName: string | null;
};

function isCommercialCenterRequest(lower: string, metadata?: Record<string, unknown>): boolean {
  if (typeof metadata?.revenueLineId === 'string' || typeof metadata?.revenueLineType === 'string') return true;
  return /(commercial|revenue line|business line|online course|online courses|course|courses|b2b|platinum|trainer network|loyalty|community|three-year|quarterly|department|leadership course|course launch|commercial plan)/i.test(lower);
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
  const budgetTarget = extractMoneyValue(content, ['budget target', 'budget', 'spend target']);
  const revenueTarget = extractMoneyValue(content, ['revenue target', 'sales target', 'target revenue']);
  const actionPlan = extractLabelValue(content, ['action plan', 'plan', 'next actions']);
  const linkedEvent = inferLinkedEvent(content, context);
  return {
    objective,
    audience,
    budgetTarget,
    revenueTarget,
    actionPlan,
    strategySummary: cleanText(content),
    linkedEventId: linkedEvent?.id || null,
    linkedEventName: linkedEvent?.name || null,
  };
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

function inferRevenueLineType(lower: string): 'live_event' | 'online_course' | 'b2b' | 'platinum_elite' | 'certified_trainer_network' | 'loyalty_community' {
  if (/(online course|course|ÙƒÙˆØ±Ø³|Ø¯ÙˆØ±Ø©)/i.test(lower)) return 'online_course';
  if (/(b2b|corporate|company|enterprise|business user)/i.test(lower)) return 'b2b';
  if (/(platinum|elite|premium|vip)/i.test(lower)) return 'platinum_elite';
  if (/(trainer|certified trainer|network|Ù…Ø¯Ø±Ø¨)/i.test(lower)) return 'certified_trainer_network';
  if (/(loyalty|community|retention|referral|Ù…Ø¬ØªÙ…Ø¹)/i.test(lower)) return 'loyalty_community';
  return 'live_event';
}

function inferExplicitRevenueLineType(lower: string): ReturnType<typeof inferRevenueLineType> | undefined {
  if (/(live event|events|event campaign|on stage|workshop|camp)/i.test(lower)) return 'live_event';
  if (/(online course|online courses|course|courses|leadership course)/i.test(lower)) return 'online_course';
  if (/(b2b|corporate|company|enterprise|business user)/i.test(lower)) return 'b2b';
  if (/(platinum|elite|premium|vip)/i.test(lower)) return 'platinum_elite';
  if (/(certified trainer|trainer network)/i.test(lower)) return 'certified_trainer_network';
  if (/(loyalty|community|retention|referral)/i.test(lower)) return 'loyalty_community';
  return undefined;
}

function revenueLineLabel(type: ReturnType<typeof inferRevenueLineType>): string {
  const labels: Record<ReturnType<typeof inferRevenueLineType>, string> = {
    live_event: 'Live Events',
    online_course: 'Online Courses',
    b2b: 'B2B',
    platinum_elite: 'Platinum Elite',
    certified_trainer_network: 'Certified Trainer Network',
    loyalty_community: 'Loyalty & Community',
  };
  return labels[type];
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
