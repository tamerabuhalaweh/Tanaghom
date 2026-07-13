import { auditLog } from '@shared/logging';
import { AppError } from '@shared/errors';
import { resolveUserLLMProvider } from '@modules/ai-provider/controller';
import { randomUUID } from 'crypto';
import type { LLMResponse } from '@shared/providers/llm-provider';
import { executeStitchiAction, isExecutableStitchiAction, requiresApprovalForAction } from './actions';
import { formatReadOnlyContextForPrompt, loadReadOnlyContext, type StitchiReadOnlyContext } from './context';
import { orchestrateStitchiMessage } from './orchestrator';
import { classifyStitchiProviderFailure, stitchiProviderUnavailableMessage } from './provider-failure';
import {
  checkStitchiPermission,
  canApproveStitchiActions,
} from './policy';
import * as repo from './repository';
import { sanitizeForStorage } from './redaction';
import { resumeStitchiActionApprovalWorkflow, startStitchiActionApprovalWorkflow } from './workflow';
import type {
  ActionDecisionInput,
  CreateActionRunInput,
  CreateConversationInput,
  CreateMessageInput,
  ListConversationInput,
  ReadOnlyAssistantRequestInput,
  StitchiReadOnlyAnswer,
  StitchiResponseStreamEvent,
} from './types';

export async function listConversations(
  role: string,
  tenantKey: string,
  userId: string,
  input: ListConversationInput,
) {
  checkStitchiPermission(role, 'stitchi:read');
  return repo.listConversations(tenantKey, userId, role, input);
}

export async function getConversation(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
) {
  checkStitchiPermission(role, 'stitchi:read');
  return repo.getConversation(tenantKey, userId, role, conversationId);
}

export async function createConversation(
  role: string,
  tenantKey: string,
  userId: string,
  input: CreateConversationInput,
) {
  checkStitchiPermission(role, 'stitchi:create_conversation');
  const conversation = await repo.createConversation(tenantKey, userId, input);
  auditLog(
    { actor: `user:${userId}`, action: 'stitchi_conversation_created', object_type: 'stitchi_conversation', object_id: conversation.id, result: 'success' },
    `Stitchi conversation created: ${conversation.title}`,
  );
  return conversation;
}

export async function archiveConversation(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
) {
  checkStitchiPermission(role, 'stitchi:create_conversation');
  const conversation = await repo.archiveConversation(tenantKey, userId, role, conversationId);
  auditLog(
    { actor: `user:${userId}`, action: 'stitchi_conversation_archived', object_type: 'stitchi_conversation', object_id: conversation.id, result: 'success' },
    `Stitchi conversation archived: ${conversation.title}`,
  );
  return conversation;
}

export async function listMessages(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
) {
  checkStitchiPermission(role, 'stitchi:read');
  return repo.listMessages(tenantKey, userId, role, conversationId);
}

export async function createMessage(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: CreateMessageInput,
) {
  checkStitchiPermission(role, 'stitchi:create_message');
  const message = await repo.createMessage(tenantKey, userId, role, conversationId, input);
  auditLog(
    { actor: `user:${userId}`, action: 'stitchi_user_message_created', object_type: 'stitchi_message', object_id: message.id, result: 'success' },
    'Stitchi user message saved',
  );
  return message;
}

export async function generateReadOnlyAssistantResponse(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: ReadOnlyAssistantRequestInput,
): Promise<StitchiReadOnlyAnswer> {
  checkStitchiPermission(role, 'stitchi:create_message');
  const conversation = await repo.getConversation(tenantKey, userId, role, conversationId);
  const userMessage = await repo.createMessage(tenantKey, userId, role, conversationId, {
    content: input.content,
    metadata: {
      ...input.metadata,
      mode: 'read_only',
      requestedEventId: input.eventId,
    },
  });
  const context = await loadReadOnlyContext(tenantKey, conversation, input.eventId, role);

  try {
    const provider = await resolveUserLLMProvider(userId);
    const status = provider.getStatus();
    const response = await provider.generate(buildReadOnlyPrompt(input.content, context), {
      systemPrompt: READ_ONLY_SYSTEM_PROMPT,
      maxTokens: 750,
      temperature: 0.2,
      timeoutMs: 30000,
    });
    const assistantMessage = await repo.createAssistantMessage(
      tenantKey,
      userId,
      role,
      conversationId,
      normalizeAssistantText(response.text),
      {
        mode: 'read_only',
        writesExecuted: false,
        externalExecution: 'blocked',
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        selectedEventId: context.selectedEvent?.id || null,
        contextShape: summarizeContextShape(context),
      },
    );
    auditLog(
      { actor: `user:${userId}`, action: 'stitchi_read_only_response_created', object_type: 'stitchi_message', object_id: assistantMessage.id, result: 'success' },
      'Stitchi read-only assistant response generated',
    );
    return {
      userMessage,
      assistantMessage,
      provider: {
        status: 'used',
        name: status.name,
        type: response.provider,
        model: response.model,
      },
      safety: READ_ONLY_SAFETY,
    };
  } catch (err) {
    if (isMissingProviderError(err)) {
      const assistantMessage = await repo.createAssistantMessage(
        tenantKey,
        userId,
        role,
        conversationId,
        'I can help once your AI model is connected. Open AI Settings, choose Gemma, DeepSeek, OpenAI, or Claude, save your key, then send this request again. I did not change any event, lead, KPI, CRM, or scheduling data.',
        {
          mode: 'read_only',
          writesExecuted: false,
          externalExecution: 'blocked',
          providerRequired: true,
          selectedEventId: context.selectedEvent?.id || null,
          contextShape: summarizeContextShape(context),
        },
      );
      return {
        userMessage,
        assistantMessage,
        provider: {
          status: 'required',
          name: 'Customer AI model required',
          type: 'none',
          model: null,
        },
        safety: READ_ONLY_SAFETY,
      };
    }
    if (classifyStitchiProviderFailure(err) === 'unavailable') {
      const assistantMessage = await repo.createAssistantMessage(
        tenantKey,
        userId,
        role,
        conversationId,
        stitchiProviderUnavailableMessage(),
        {
          mode: 'read_only',
          writesExecuted: false,
          externalExecution: 'blocked',
          providerUnavailable: true,
          selectedEventId: context.selectedEvent?.id || null,
          contextShape: summarizeContextShape(context),
        },
      );
      auditLog(
        { actor: `user:${userId}`, action: 'stitchi_provider_unavailable', object_type: 'stitchi_message', object_id: assistantMessage.id, result: 'failure' },
        'Stitchi AI provider was unavailable; no system data was changed',
      );
      return {
        userMessage,
        assistantMessage,
        provider: {
          status: 'unavailable',
          name: 'AI connection unavailable',
          type: 'none',
          model: null,
        },
        safety: READ_ONLY_SAFETY,
      };
    }
    throw err;
  }
}

export async function* streamReadOnlyAssistantResponse(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: ReadOnlyAssistantRequestInput,
): AsyncGenerator<StitchiResponseStreamEvent> {
  checkStitchiPermission(role, 'stitchi:create_message');
  yield { type: 'started', conversationId, mode: 'read_only' };

  const conversation = await repo.getConversation(tenantKey, userId, role, conversationId);
  const userMessage = await repo.createMessage(tenantKey, userId, role, conversationId, {
    content: input.content,
    metadata: {
      ...input.metadata,
      mode: 'read_only',
      requestedEventId: input.eventId,
      streamed: true,
    },
  });
  yield { type: 'user_message_saved', message: userMessage };

  const context = await loadReadOnlyContext(tenantKey, conversation, input.eventId, role);
  const contextShape = summarizeContextShape(context);
  yield {
    type: 'context_loaded',
    selectedEventId: context.selectedEvent?.id || null,
    contextShape,
  };

  try {
    const provider = await resolveUserLLMProvider(userId);
    const status = provider.getStatus();
    const prompt = buildReadOnlyPrompt(input.content, context);
    let finalText = '';
    let finalResponse: LLMResponse | null = null;

    for await (const event of provider.streamGenerate(prompt, {
      systemPrompt: READ_ONLY_SYSTEM_PROMPT,
      maxTokens: 750,
      temperature: 0.2,
      timeoutMs: 30000,
    })) {
      if (event.type === 'token') {
        finalText += event.text;
        yield event;
      } else {
        finalResponse = event.response;
      }
    }

    const response = finalResponse || {
      text: finalText,
      model: status.model,
      provider: status.type,
    };
    const assistantMessage = await repo.createAssistantMessage(
      tenantKey,
      userId,
      role,
      conversationId,
      normalizeAssistantText(response.text || finalText),
      {
        mode: 'read_only',
        streamed: true,
        writesExecuted: false,
        externalExecution: 'blocked',
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        selectedEventId: context.selectedEvent?.id || null,
        contextShape,
      },
    );
    auditLog(
      { actor: `user:${userId}`, action: 'stitchi_read_only_stream_created', object_type: 'stitchi_message', object_id: assistantMessage.id, result: 'success' },
      'Stitchi streamed read-only assistant response generated',
    );
    yield {
      type: 'completed',
      answer: {
        userMessage,
        assistantMessage,
        provider: {
          status: 'used',
          name: status.name,
          type: response.provider,
          model: response.model,
        },
        safety: READ_ONLY_SAFETY,
      },
    };
  } catch (err) {
    if (isMissingProviderError(err)) {
      const assistantMessage = await repo.createAssistantMessage(
        tenantKey,
        userId,
        role,
        conversationId,
        'I can help once your AI model is connected. Open AI Settings, choose Gemma, DeepSeek, OpenAI, or Claude, save your key, then send this request again. I did not change any event, lead, KPI, CRM, or scheduling data.',
        {
          mode: 'read_only',
          streamed: true,
          writesExecuted: false,
          externalExecution: 'blocked',
          providerRequired: true,
          selectedEventId: context.selectedEvent?.id || null,
          contextShape,
        },
      );
      yield { type: 'provider_required', message: assistantMessage };
      yield {
        type: 'completed',
        answer: {
          userMessage,
          assistantMessage,
          provider: {
            status: 'required',
            name: 'Customer AI model required',
            type: 'none',
            model: null,
          },
          safety: READ_ONLY_SAFETY,
        },
      };
      return;
    }
    if (classifyStitchiProviderFailure(err) === 'unavailable') {
      const assistantMessage = await repo.createAssistantMessage(
        tenantKey,
        userId,
        role,
        conversationId,
        stitchiProviderUnavailableMessage(),
        {
          mode: 'read_only',
          streamed: true,
          writesExecuted: false,
          externalExecution: 'blocked',
          providerUnavailable: true,
          selectedEventId: context.selectedEvent?.id || null,
          contextShape,
        },
      );
      auditLog(
        { actor: `user:${userId}`, action: 'stitchi_provider_unavailable', object_type: 'stitchi_message', object_id: assistantMessage.id, result: 'failure' },
        'Stitchi streaming AI provider was unavailable; no system data was changed',
      );
      yield { type: 'provider_unavailable', message: assistantMessage };
      yield {
        type: 'completed',
        answer: {
          userMessage,
          assistantMessage,
          provider: {
            status: 'unavailable',
            name: 'AI connection unavailable',
            type: 'none',
            model: null,
          },
          safety: READ_ONLY_SAFETY,
        },
      };
      return;
    }
    throw err;
  }
}

export async function orchestrateUserMessage(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: ReadOnlyAssistantRequestInput,
) {
  return orchestrateStitchiMessage(role, tenantKey, userId, conversationId, input);
}

export async function listActionRuns(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
) {
  checkStitchiPermission(role, 'stitchi:read');
  return repo.listActionRuns(tenantKey, userId, role, conversationId);
}

export async function createActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  conversationId: string,
  input: CreateActionRunInput,
) {
  checkStitchiPermission(role, 'stitchi:create_action');
  const normalizedInput = isExecutableStitchiAction(input.actionType)
    ? { ...input, requiresApproval: requiresApprovalForAction(input.actionType), langGraphThreadId: input.langGraphThreadId || `stitchi-action-${randomUUID()}` }
    : input;
  const actionRun = await repo.createActionRun(tenantKey, userId, role, conversationId, normalizedInput);
  if (isExecutableStitchiAction(actionRun.actionType) && actionRun.requiresApproval && actionRun.langGraphThreadId) {
    await startStitchiActionApprovalWorkflow({
      threadId: actionRun.langGraphThreadId,
      tenantKey,
      userId,
      conversationId,
      actionRunId: actionRun.id,
      actionType: actionRun.actionType,
      inputSummary: summarizeActionPayload(actionRun.inputPayload),
    });
  }
  auditLog(
    { actor: `user:${userId}`, action: 'stitchi_action_run_created', object_type: 'stitchi_action_run', object_id: actionRun.id, result: 'success' },
    `Stitchi action proposal created: ${actionRun.actionType}`,
  );
  return actionRun;
}

export async function approveActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  actionRunId: string,
  input: ActionDecisionInput,
) {
  checkStitchiPermission(role, 'stitchi:approve_action');
  if (!canApproveStitchiActions(role)) {
    checkStitchiPermission(role, 'stitchi:approve_action');
  }
  const result = await repo.decideActionRun(tenantKey, userId, role, actionRunId, 'approved', input);
  if (result.actionRun.langGraphThreadId) {
    await resumeStitchiActionApprovalWorkflow({
      threadId: result.actionRun.langGraphThreadId,
      tenantKey,
      userId,
      decision: 'approved',
      notes: input.notes,
    });
  }
  return result;
}

export async function rejectActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  actionRunId: string,
  input: ActionDecisionInput,
) {
  checkStitchiPermission(role, 'stitchi:approve_action');
  const result = await repo.decideActionRun(tenantKey, userId, role, actionRunId, 'rejected', input);
  if (result.actionRun.langGraphThreadId) {
    await resumeStitchiActionApprovalWorkflow({
      threadId: result.actionRun.langGraphThreadId,
      tenantKey,
      userId,
      decision: 'rejected',
      notes: input.notes,
    });
  }
  return result;
}

export async function cancelActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  actionRunId: string,
  input: ActionDecisionInput,
) {
  checkStitchiPermission(role, 'stitchi:cancel_action');
  return repo.cancelActionRun(tenantKey, userId, role, actionRunId, input);
}

export async function executeApprovedActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  actionRunId: string,
) {
  checkStitchiPermission(role, 'stitchi:execute_action');
  const run = await repo.getActionRun(tenantKey, userId, role, actionRunId);
  if (!isExecutableStitchiAction(run.actionType)) {
    throw new AppError(`Stitchi action ${run.actionType} is not executable by the backend registry.`, 400, 'STITCHI_ACTION_UNSUPPORTED');
  }
  await repo.markActionRunRunning(tenantKey, userId, role, actionRunId);
  try {
    const executed = await executeStitchiAction({
      role,
      tenantKey,
      userId,
      actionType: run.actionType,
      inputPayload: run.inputPayload,
    });
    const actionRun = await repo.completeActionRun(tenantKey, userId, actionRunId, {
      objectType: executed.objectType,
      objectId: executed.objectId,
      result: executed.result,
      externalExecution: 'blocked',
      executedThrough: 'tanaghum_domain_service',
    });
    auditLog(
      { actor: `user:${userId}`, action: 'stitchi_action_executed', object_type: executed.objectType, object_id: executed.objectId, result: 'success' },
      `Stitchi executed ${run.actionType}`,
    );
    return { actionRun, executed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stitchi action execution failed';
    const actionRun = await repo.failActionRun(userId, actionRunId, message);
    throw Object.assign(err instanceof Error ? err : new Error(message), { actionRun });
  }
}

export async function approveAndExecuteActionRun(
  role: string,
  tenantKey: string,
  userId: string,
  actionRunId: string,
  input: ActionDecisionInput,
) {
  const approval = await approveActionRun(role, tenantKey, userId, actionRunId, input);
  const execution = await executeApprovedActionRun(role, tenantKey, userId, actionRunId);
  return {
    approval,
    actionRun: execution.actionRun,
    executed: execution.executed,
  };
}

const READ_ONLY_SYSTEM_PROMPT = [
  'You are Stitchi, Tanaghum\'s read-only operating assistant.',
  'Answer in clear business language for a sales or marketing manager.',
  'Use only the supplied context. If data is missing, say what must be connected or imported.',
  'Do not claim you created, updated, approved, scheduled, messaged, called, synced, or executed anything.',
  'Do not expose IDs unless the user specifically needs them.',
  'End with 1-3 practical next steps.',
].join('\n');

const READ_ONLY_SAFETY = {
  mode: 'read_only',
  writesExecuted: false,
  externalExecution: 'blocked',
  actionProposalsCreated: 0,
} as const;

function buildReadOnlyPrompt(userRequest: string, context: StitchiReadOnlyContext): string {
  return [
    `User request: ${userRequest}`,
    '',
    'Read-only Tanaghum context:',
    formatReadOnlyContextForPrompt(context),
  ].join('\n');
}

function normalizeAssistantText(text: string): string {
  const trimmed = text.trim();
  return trimmed || 'I could not produce a useful answer from the current context. No system data was changed.';
}

function isMissingProviderError(err: unknown): boolean {
  return err instanceof AppError && err.code === 'LLM_PROVIDER_REQUIRED';
}

function summarizeContextShape(context: {
  selectedEvent: unknown;
  recentEvents: unknown[];
  leadSummary: { total: number };
  kpiSummary: { records: number };
  riskSummary: { open: number };
  connectorSummary: { configuredCredentials: number; connectorJobs: number };
}) {
  return {
    selectedEventPresent: Boolean(context.selectedEvent),
    recentEvents: context.recentEvents.length,
    leads: context.leadSummary.total,
    kpiRecords: context.kpiSummary.records,
    openRisks: context.riskSummary.open,
    configuredCredentials: context.connectorSummary.configuredCredentials,
    connectorJobs: context.connectorSummary.connectorJobs,
  };
}

function summarizeActionPayload(payload: unknown): Record<string, unknown> {
  const sanitized = sanitizeForStorage(payload);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
}
