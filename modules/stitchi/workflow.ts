import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { prisma } from '@shared/database';

const actionApprovalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(5000).optional(),
});

const stitchiActionWorkflowState = Annotation.Root({
  tenantKey: Annotation<string>,
  conversationId: Annotation<string>,
  actionRunId: Annotation<string>,
  actionType: Annotation<string>,
  inputSummary: Annotation<Record<string, unknown>>,
  status: Annotation<'awaiting_human_approval' | 'approved' | 'rejected'>,
  reviewerNotes: Annotation<string | undefined>,
});

function humanApprovalNode(state: typeof stitchiActionWorkflowState.State) {
  const decision = interrupt({
    action: 'review_stitchi_action',
    instruction: 'Review this Stitchi action before any internal write is executed.',
    conversationId: state.conversationId,
    actionRunId: state.actionRunId,
    actionType: state.actionType,
    inputSummary: state.inputSummary,
    safety: {
      mode: 'approval_required',
      externalExecution: 'blocked',
      sourceOfTruth: 'Tanaghum backend domain services',
    },
  });
  const parsed = actionApprovalDecisionSchema.parse(decision);
  return {
    status: parsed.decision,
    reviewerNotes: parsed.notes,
  };
}

const checkpointer = new MemorySaver();

const stitchiActionApprovalGraph = new StateGraph(stitchiActionWorkflowState)
  .addNode('humanApproval', humanApprovalNode)
  .addEdge(START, 'humanApproval')
  .addEdge('humanApproval', END)
  .compile({ checkpointer });

export async function startStitchiActionApprovalWorkflow(input: {
  threadId: string;
  tenantKey: string;
  userId: string;
  conversationId: string;
  actionRunId: string;
  actionType: string;
  inputSummary: Record<string, unknown>;
}): Promise<{ threadId: string; status: 'awaiting_human_approval'; interrupt: unknown }> {
  const result = await stitchiActionApprovalGraph.invoke({
    tenantKey: input.tenantKey,
    conversationId: input.conversationId,
    actionRunId: input.actionRunId,
    actionType: input.actionType,
    inputSummary: input.inputSummary,
    status: 'awaiting_human_approval',
  }, {
    configurable: { thread_id: input.threadId },
  });
  const interruptPayload = getInterruptValue(result);
  await persistWorkflow({
    threadId: input.threadId,
    tenantKey: input.tenantKey,
    userId: input.userId,
    status: 'interrupted',
    stateSnapshot: {
      conversationId: input.conversationId,
      actionRunId: input.actionRunId,
      actionType: input.actionType,
      inputSummary: input.inputSummary,
      status: 'awaiting_human_approval',
    },
    interruptPayload,
  });
  return {
    threadId: input.threadId,
    status: 'awaiting_human_approval',
    interrupt: interruptPayload,
  };
}

export async function resumeStitchiActionApprovalWorkflow(input: {
  threadId: string;
  tenantKey: string;
  userId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}): Promise<{ threadId: string; status: 'approved' | 'rejected'; reviewerNotes?: string }> {
  const result = await stitchiActionApprovalGraph.invoke(new Command({
    resume: {
      decision: input.decision,
      notes: input.notes,
    },
  }), {
    configurable: { thread_id: input.threadId },
  });

  const status = z.enum(['approved', 'rejected']).parse(result.status);
  const output = {
    threadId: input.threadId,
    status,
    reviewerNotes: result.reviewerNotes,
  };

  await prisma.langGraphWorkflow.updateMany({
    where: { thread_id: input.threadId, tenant_key: input.tenantKey },
    data: {
      status: 'completed',
      result_payload: toJsonObject(output),
      completed_at: new Date(),
    },
  });

  return output;
}

function getInterruptValue(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined;
  const record = result as Record<string, unknown>;
  const interrupts = record.__interrupt__;
  if (!Array.isArray(interrupts) || interrupts.length === 0) return undefined;
  const first = interrupts[0];
  if (!first || typeof first !== 'object') return first;
  return (first as Record<string, unknown>).value ?? first;
}

async function persistWorkflow(input: {
  threadId: string;
  tenantKey: string;
  userId: string;
  status: 'interrupted' | 'running' | 'completed' | 'failed';
  stateSnapshot: Record<string, unknown>;
  interruptPayload: unknown;
}) {
  await prisma.langGraphWorkflow.upsert({
    where: { thread_id: input.threadId },
    create: {
      thread_id: input.threadId,
      tenant_key: input.tenantKey,
      workflow_type: 'stitchi_action_approval',
      status: input.status,
      human_user_id: input.userId,
      checkpoint_strategy: 'langgraph_interrupt_with_database_state_snapshot',
      state_snapshot: toJsonObject(input.stateSnapshot),
      interrupt_payload: toJsonObject(input.interruptPayload),
    },
    update: {
      status: input.status,
      state_snapshot: toJsonObject(input.stateSnapshot),
      interrupt_payload: toJsonObject(input.interruptPayload),
    },
  });
}

function toJsonObject(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}
