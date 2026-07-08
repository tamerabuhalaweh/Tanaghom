import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { canApproveStitchiActions, canViewTenantConversations } from './policy';
import { redactText, toStoredJson } from './redaction';
import type {
  ActionDecisionInput,
  CreateActionRunInput,
  CreateConversationInput,
  CreateMessageInput,
  ListConversationInput,
  StitchiActionApprovalSummary,
  StitchiActionRunSummary,
  StitchiConversationSummary,
  StitchiMessageSummary,
  StitchiMessageRole,
} from './types';

type ConversationRow = {
  id: string;
  tenant_key: string;
  user_id: string;
  event_id: string | null;
  title: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  tenant_key: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata: unknown;
  created_at: Date;
};

type ActionRunRow = {
  id: string;
  tenant_key: string;
  conversation_id: string;
  user_id: string;
  action_type: string;
  status: string;
  input_payload: unknown;
  preview_payload: unknown;
  result_payload: unknown;
  requires_approval: boolean;
  risk_level: string;
  audit_record_id: string | null;
  langgraph_thread_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

type ApprovalRow = {
  id: string;
  tenant_key: string;
  action_run_id: string;
  approver_user_id: string;
  decision: string;
  notes: string | null;
  created_at: Date;
};

function scopedUserId(role: string, userId: string, includeTenant?: boolean): string | undefined {
  return includeTenant && canViewTenantConversations(role) ? undefined : userId;
}

export async function listConversations(
  tenantKey: string,
  userId: string,
  role: string,
  input: ListConversationInput,
): Promise<StitchiConversationSummary[]> {
  const where: Prisma.StitchiConversationWhereInput = { tenant_key: tenantKey };
  const ownerScope = scopedUserId(role, userId, input.includeTenant);
  if (ownerScope) where.user_id = ownerScope;
  if (input.status) where.status = input.status;
  if (input.eventId) where.event_id = input.eventId;

  const conversations = await prisma.stitchiConversation.findMany({
    where,
    orderBy: { updated_at: 'desc' },
  });
  return conversations.map(mapConversation);
}

export async function getConversation(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
): Promise<StitchiConversationSummary> {
  const where: Prisma.StitchiConversationWhereInput = {
    id: conversationId,
    tenant_key: tenantKey,
  };
  const ownerScope = scopedUserId(role, userId, canViewTenantConversations(role));
  if (ownerScope) where.user_id = ownerScope;
  const conversation = await prisma.stitchiConversation.findFirst({ where });
  if (!conversation) throw new NotFoundError('StitchiConversation', conversationId);
  return mapConversation(conversation);
}

export async function createConversation(
  tenantKey: string,
  userId: string,
  input: CreateConversationInput,
): Promise<StitchiConversationSummary> {
  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({
      where: { id: input.eventId, tenant_key: tenantKey },
      select: { id: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
  }

  const conversation = await prisma.stitchiConversation.create({
    data: {
      tenant_key: tenantKey,
      user_id: userId,
      event_id: input.eventId,
      title: redactText(input.title),
    },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_conversation_created',
    userId,
    targetObjectType: 'stitchi_conversation',
    targetObjectId: conversation.id,
    reason: 'Stitchi conversation created',
  });

  return mapConversation(conversation);
}

export async function archiveConversation(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
): Promise<StitchiConversationSummary> {
  await getConversation(tenantKey, userId, role, conversationId);
  const conversation = await prisma.stitchiConversation.update({
    where: { id: conversationId },
    data: { status: 'archived' },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_conversation_archived',
    userId,
    targetObjectType: 'stitchi_conversation',
    targetObjectId: conversationId,
    reason: 'Stitchi conversation archived',
  });

  return mapConversation(conversation);
}

export async function listMessages(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
): Promise<StitchiMessageSummary[]> {
  await getConversation(tenantKey, userId, role, conversationId);
  const messages = await prisma.stitchiMessage.findMany({
    where: { tenant_key: tenantKey, conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
  });
  return messages.map(mapMessage);
}

export async function createMessage(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
  input: CreateMessageInput,
): Promise<StitchiMessageSummary> {
  await getConversation(tenantKey, userId, role, conversationId);
  const message = await createStoredMessage(tenantKey, conversationId, 'user', input.content, input.metadata);

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_user_message_created',
    userId,
    targetObjectType: 'stitchi_message',
    targetObjectId: message.id,
    reason: 'User message saved for Stitchi conversation',
  });

  return mapMessage(message);
}

export async function createAssistantMessage(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<StitchiMessageSummary> {
  await getConversation(tenantKey, userId, role, conversationId);
  const message = await createStoredMessage(tenantKey, conversationId, 'assistant', content, metadata);

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_assistant_message_created',
    userId,
    targetObjectType: 'stitchi_message',
    targetObjectId: message.id,
    reason: 'Read-only Stitchi assistant response saved',
  });

  return mapMessage(message);
}

export async function listActionRuns(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
): Promise<StitchiActionRunSummary[]> {
  await getConversation(tenantKey, userId, role, conversationId);
  const runs = await prisma.stitchiActionRun.findMany({
    where: { tenant_key: tenantKey, conversation_id: conversationId },
    orderBy: { created_at: 'desc' },
  });
  return runs.map(mapActionRun);
}

export async function createActionRun(
  tenantKey: string,
  userId: string,
  role: string,
  conversationId: string,
  input: CreateActionRunInput,
): Promise<StitchiActionRunSummary> {
  await getConversation(tenantKey, userId, role, conversationId);
  const status = input.requiresApproval ? 'awaiting_approval' : 'proposed';
  const run = await prisma.stitchiActionRun.create({
    data: {
      tenant_key: tenantKey,
      conversation_id: conversationId,
      user_id: userId,
      action_type: input.actionType,
      status,
      input_payload: toStoredJson(input.inputPayload) as Prisma.InputJsonValue,
      preview_payload: input.previewPayload ? toStoredJson(input.previewPayload) as Prisma.InputJsonValue : undefined,
      requires_approval: input.requiresApproval,
      risk_level: input.riskLevel,
      langgraph_thread_id: input.langGraphThreadId,
    },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_action_run_created',
    userId,
    targetObjectType: 'stitchi_action_run',
    targetObjectId: run.id,
    reason: `Stitchi action proposal created: ${input.actionType}`,
  });

  return mapActionRun(run);
}

export async function getActionRun(
  tenantKey: string,
  userId: string,
  role: string,
  actionRunId: string,
): Promise<StitchiActionRunSummary> {
  return getActionRunForDecision(tenantKey, userId, role, actionRunId);
}

export async function decideActionRun(
  tenantKey: string,
  userId: string,
  role: string,
  actionRunId: string,
  decision: 'approved' | 'rejected',
  input: ActionDecisionInput,
): Promise<{ actionRun: StitchiActionRunSummary; approval: StitchiActionApprovalSummary }> {
  const run = await getActionRunForDecision(tenantKey, userId, role, actionRunId);
  if (!['proposed', 'awaiting_approval'].includes(run.status)) {
    throw new ValidationError(`Stitchi action cannot be ${decision} from status ${run.status}`);
  }

  const [updatedRun, approval] = await prisma.$transaction([
    prisma.stitchiActionRun.update({
      where: { id: actionRunId },
      data: {
        status: decision,
        completed_at: decision === 'rejected' ? new Date() : undefined,
      },
    }),
    prisma.stitchiActionApproval.create({
      data: {
        tenant_key: tenantKey,
        action_run_id: actionRunId,
        approver_user_id: userId,
        decision,
        notes: input.notes ? redactText(input.notes) : undefined,
      },
    }),
  ]);

  await createAudit({
    auditType: 'stitchi',
    action: decision === 'approved' ? 'stitchi_action_approved' : 'stitchi_action_rejected',
    userId,
    targetObjectType: 'stitchi_action_run',
    targetObjectId: actionRunId,
    reason: input.notes ? redactText(input.notes) : `Stitchi action ${decision}`,
  });

  return { actionRun: mapActionRun(updatedRun), approval: mapApproval(approval) };
}

export async function cancelActionRun(
  tenantKey: string,
  userId: string,
  role: string,
  actionRunId: string,
  input: ActionDecisionInput,
): Promise<StitchiActionRunSummary> {
  const run = await getActionRunForDecision(tenantKey, userId, role, actionRunId);
  if (['completed', 'failed', 'cancelled', 'rejected'].includes(run.status)) {
    throw new ValidationError(`Stitchi action cannot be cancelled from status ${run.status}`);
  }

  const updatedRun = await prisma.stitchiActionRun.update({
    where: { id: actionRunId },
    data: { status: 'cancelled', completed_at: new Date() },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_action_cancelled',
    userId,
    targetObjectType: 'stitchi_action_run',
    targetObjectId: actionRunId,
    reason: input.notes ? redactText(input.notes) : 'Stitchi action cancelled',
  });

  return mapActionRun(updatedRun);
}

export async function markActionRunRunning(
  tenantKey: string,
  userId: string,
  role: string,
  actionRunId: string,
): Promise<StitchiActionRunSummary> {
  const run = await getActionRunForDecision(tenantKey, userId, role, actionRunId);
  if (run.status !== 'approved') {
    throw new ValidationError(`Stitchi action cannot execute from status ${run.status}`);
  }
  const updatedRun = await prisma.stitchiActionRun.update({
    where: { id: actionRunId },
    data: { status: 'running' },
  });
  return mapActionRun(updatedRun);
}

export async function completeActionRun(
  tenantKey: string,
  userId: string,
  actionRunId: string,
  resultPayload: Record<string, unknown>,
): Promise<StitchiActionRunSummary> {
  const updatedRun = await prisma.stitchiActionRun.update({
    where: { id: actionRunId },
    data: {
      status: 'completed',
      result_payload: toStoredJson(resultPayload) as Prisma.InputJsonValue,
      completed_at: new Date(),
    },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_action_completed',
    userId,
    targetObjectType: 'stitchi_action_run',
    targetObjectId: actionRunId,
    reason: `Stitchi action completed in tenant ${tenantKey}`,
  });

  return mapActionRun(updatedRun);
}

export async function failActionRun(
  userId: string,
  actionRunId: string,
  errorMessage: string,
): Promise<StitchiActionRunSummary> {
  const updatedRun = await prisma.stitchiActionRun.update({
    where: { id: actionRunId },
    data: {
      status: 'failed',
      result_payload: toStoredJson({ error: errorMessage }) as Prisma.InputJsonValue,
      completed_at: new Date(),
    },
  });

  await createAudit({
    auditType: 'stitchi',
    action: 'stitchi_action_failed',
    userId,
    targetObjectType: 'stitchi_action_run',
    targetObjectId: actionRunId,
    reason: errorMessage,
  });

  return mapActionRun(updatedRun);
}

async function getActionRunForDecision(
  tenantKey: string,
  userId: string,
  role: string,
  actionRunId: string,
): Promise<StitchiActionRunSummary> {
  const run = await prisma.stitchiActionRun.findFirst({
    where: { id: actionRunId, tenant_key: tenantKey },
    include: { conversation: { select: { user_id: true } } },
  });
  if (!run) throw new NotFoundError('StitchiActionRun', actionRunId);
  if (!canViewTenantConversations(role) && !canApproveStitchiActions(role) && run.conversation.user_id !== userId) {
    throw new NotFoundError('StitchiActionRun', actionRunId);
  }
  return mapActionRun(run);
}

async function createAudit(input: {
  auditType: string;
  action: string;
  userId: string;
  targetObjectType: string;
  targetObjectId: string;
  reason: string;
}) {
  return prisma.auditRecord.create({
    data: {
      audit_type: input.auditType,
      action: input.action,
      result: 'success',
      human_user_id: input.userId,
      target_object_type: input.targetObjectType,
      target_object_id: input.targetObjectId,
      reason: input.reason,
    },
  });
}

function createStoredMessage(
  tenantKey: string,
  conversationId: string,
  role: StitchiMessageRole,
  content: string,
  metadata: Record<string, unknown> | undefined,
): Promise<MessageRow> {
  return prisma.stitchiMessage.create({
    data: {
      tenant_key: tenantKey,
      conversation_id: conversationId,
      role,
      content: redactText(content),
      metadata: toStoredJson(metadata) as Prisma.InputJsonValue,
    },
  });
}

function mapConversation(c: ConversationRow): StitchiConversationSummary {
  return {
    id: c.id,
    tenantKey: c.tenant_key,
    userId: c.user_id,
    eventId: c.event_id,
    title: c.title,
    status: c.status as StitchiConversationSummary['status'],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function mapMessage(m: MessageRow): StitchiMessageSummary {
  return {
    id: m.id,
    tenantKey: m.tenant_key,
    conversationId: m.conversation_id,
    role: m.role as StitchiMessageSummary['role'],
    content: m.content,
    metadata: m.metadata,
    createdAt: m.created_at,
  };
}

function mapActionRun(a: ActionRunRow): StitchiActionRunSummary {
  return {
    id: a.id,
    tenantKey: a.tenant_key,
    conversationId: a.conversation_id,
    userId: a.user_id,
    actionType: a.action_type,
    status: a.status as StitchiActionRunSummary['status'],
    inputPayload: a.input_payload,
    previewPayload: a.preview_payload,
    resultPayload: a.result_payload,
    requiresApproval: a.requires_approval,
    riskLevel: a.risk_level as StitchiActionRunSummary['riskLevel'],
    auditRecordId: a.audit_record_id,
    langGraphThreadId: a.langgraph_thread_id,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    completedAt: a.completed_at,
  };
}

function mapApproval(a: ApprovalRow): StitchiActionApprovalSummary {
  return {
    id: a.id,
    tenantKey: a.tenant_key,
    actionRunId: a.action_run_id,
    approverUserId: a.approver_user_id,
    decision: a.decision as StitchiActionApprovalSummary['decision'],
    notes: a.notes,
    createdAt: a.created_at,
  };
}
