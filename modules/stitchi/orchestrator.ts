import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { AppError } from '@shared/errors';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
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
  const context = await loadReadOnlyContext(state.tenantKey, conversation, state.eventId);
  return {
    context,
    eventId: state.eventId || conversation.eventId || context.selectedEvent?.id || undefined,
  };
}

function classifyNode(state: typeof orchestrationState.State) {
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
  const proposal = deriveActionProposal(state.content, state.eventId);
  if (proposal) return { actionProposal: proposal };
  return {};
}

async function respondNode(state: typeof orchestrationState.State) {
  if (state.actionProposal) {
    const threadId = `stitchi-orchestrated-action-${randomUUID()}`;
    const actionRun = await repo.createActionRun(state.tenantKey, state.userId, state.role, state.conversationId, {
      actionType: state.actionProposal.actionType,
      inputPayload: state.actionProposal.inputPayload,
      previewPayload: state.actionProposal.previewPayload,
      requiresApproval: true,
      riskLevel: state.actionProposal.riskLevel,
      langGraphThreadId: threadId,
    });
    await startStitchiActionApprovalWorkflow({
      threadId,
      tenantKey: state.tenantKey,
      userId: state.userId,
      conversationId: state.conversationId,
      actionRunId: actionRun.id,
      actionType: actionRun.actionType,
      inputSummary: state.actionProposal.previewPayload,
    });
    return {
      actionRun,
      status: 'action_proposed' as const,
      assistantText: [
        `I prepared this for review: ${state.actionProposal.reason}.`,
        'No data has been changed yet.',
        'A manager must approve it before Tanaghum executes the internal update.',
      ].join('\n'),
    };
  }

  if (state.status === 'blocked') return {};

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

  const result = await orchestrationGraph.invoke({
    role,
    tenantKey,
    userId,
    conversationId,
    content: input.content,
    eventId: input.eventId,
    status: 'answered',
  }, {
    configurable: { thread_id: threadId },
  });

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

function deriveActionProposal(content: string, eventId?: string): ActionProposal | null {
  const commercialProposal = deriveCommercialCenterActionProposal(content);
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

function deriveCommercialCenterActionProposal(content: string): ActionProposal | null {
  const lower = content.toLowerCase();
  if (!/(commercial|revenue line|business line|online course|b2b|platinum|trainer network|loyalty|community|three-year|quarterly|department|ØªØ¬Ø§Ø±ÙŠ|Ø¯ÙˆØ±Ø©|Ø§ÙŠØ±Ø§Ø¯)/i.test(lower)) {
    return null;
  }

  const revenueLineType = inferRevenueLineType(lower);
  const revenueLineId = extractUuidAfter(lower, 'revenue line') || extractUuidAfter(lower, 'revenueLineId');
  const title = firstSentence(content, 'Commercial plan');

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

function inferRevenueLineType(lower: string): 'live_event' | 'online_course' | 'b2b' | 'platinum_elite' | 'certified_trainer_network' | 'loyalty_community' {
  if (/(online course|course|ÙƒÙˆØ±Ø³|Ø¯ÙˆØ±Ø©)/i.test(lower)) return 'online_course';
  if (/(b2b|corporate|company|enterprise|business user)/i.test(lower)) return 'b2b';
  if (/(platinum|elite|premium|vip)/i.test(lower)) return 'platinum_elite';
  if (/(trainer|certified trainer|network|Ù…Ø¯Ø±Ø¨)/i.test(lower)) return 'certified_trainer_network';
  if (/(loyalty|community|retention|referral|Ù…Ø¬ØªÙ…Ø¹)/i.test(lower)) return 'loyalty_community';
  return 'live_event';
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
