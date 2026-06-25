import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { prisma } from '@shared/database';

export const postIdeaSchema = z.object({
  id: z.string(),
  title: z.string(),
  hook: z.string(),
  platform: z.string(),
  format: z.string(),
  hashtags: z.array(z.string()),
  estimatedReach: z.enum(['low', 'medium', 'high']),
  rationale: z.string(),
});

export type PostIdea = z.infer<typeof postIdeaSchema>;

export interface IdeaWorkflowStartResult {
  threadId: string;
  status: 'awaiting_human_selection';
  ideas: PostIdea[];
  interrupt: unknown;
}

export interface IdeaWorkflowResumeResult {
  threadId: string;
  status: 'selected' | 'rejected';
  selectedIdeaId?: string;
  reviewerNotes?: string;
  ideas: PostIdea[];
}

const ideaWorkflowState = Annotation.Root({
  goal: Annotation<string>,
  audience: Annotation<string>,
  ideas: Annotation<PostIdea[]>,
  selectedIdeaId: Annotation<string | undefined>,
  reviewerNotes: Annotation<string | undefined>,
  status: Annotation<'awaiting_human_selection' | 'selected' | 'rejected'>,
});

function selectIdeaNode(state: typeof ideaWorkflowState.State) {
  const decision = interrupt({
    action: 'select_post_idea',
    instruction: 'Human must select one generated idea before it becomes a campaign.',
    goal: state.goal,
    audience: state.audience,
    ideas: state.ideas,
    safety: {
      externalExecution: 'Blocked',
      m5: 'Disabled',
      sourceOfTruth: 'STITCH backend workflow',
    },
  });

  const parsed = z.object({
    action: z.enum(['select', 'reject']),
    ideaId: z.string().optional(),
    notes: z.string().optional(),
  }).parse(decision);

  if (parsed.action === 'reject') {
    return {
      status: 'rejected' as const,
      selectedIdeaId: undefined,
      reviewerNotes: parsed.notes || 'Human rejected generated ideas.',
    };
  }

  if (!parsed.ideaId || !state.ideas.some((idea) => idea.id === parsed.ideaId)) {
    throw new Error('Selected idea does not exist in this workflow.');
  }

  return {
    status: 'selected' as const,
    selectedIdeaId: parsed.ideaId,
    reviewerNotes: parsed.notes || 'Human selected idea for campaign conversion.',
  };
}

const checkpointer = new MemorySaver();

const ideaSelectionGraph = new StateGraph(ideaWorkflowState)
  .addNode('selectIdea', selectIdeaNode)
  .addEdge(START, 'selectIdea')
  .addEdge('selectIdea', END)
  .compile({ checkpointer });

export async function startIdeaSelectionWorkflow(input: {
  threadId: string;
  tenantKey: string;
  humanUserId: string;
  goal: string;
  audience: string;
  ideas: PostIdea[];
}): Promise<IdeaWorkflowStartResult> {
  const result = await ideaSelectionGraph.invoke({
    goal: input.goal,
    audience: input.audience,
    ideas: input.ideas,
    status: 'awaiting_human_selection',
  }, {
    configurable: { thread_id: input.threadId },
  });
  const interruptPayload = getInterruptValue(result);
  if (isDurableWorkflowStoreAvailable()) {
    await prisma.langGraphWorkflow.upsert({
      where: { thread_id: input.threadId },
      create: {
        thread_id: input.threadId,
        tenant_key: input.tenantKey,
        workflow_type: 'commercial_social_post_idea_selection',
        status: 'interrupted',
        human_user_id: input.humanUserId,
        checkpoint_strategy: 'langgraph_interrupt_with_database_state_snapshot',
        state_snapshot: {
          goal: input.goal,
          audience: input.audience,
          ideas: input.ideas,
          status: 'awaiting_human_selection',
        },
        interrupt_payload: toJsonObject(interruptPayload),
      },
      update: {
        status: 'interrupted',
        state_snapshot: {
          goal: input.goal,
          audience: input.audience,
          ideas: input.ideas,
          status: 'awaiting_human_selection',
        },
        interrupt_payload: toJsonObject(interruptPayload),
      },
    });
  }

  return {
    threadId: input.threadId,
    status: 'awaiting_human_selection',
    ideas: input.ideas,
    interrupt: interruptPayload,
  };
}

export async function resumeIdeaSelectionWorkflow(input: {
  threadId: string;
  action: 'select' | 'reject';
  ideaId?: string;
  notes?: string;
}): Promise<IdeaWorkflowResumeResult> {
  const durableWorkflow = isDurableWorkflowStoreAvailable()
    ? await prisma.langGraphWorkflow.findUnique({ where: { thread_id: input.threadId } })
    : null;
  if (durableWorkflow) {
    const snapshot = durableWorkflow.state_snapshot as Record<string, unknown>;
    const ideas = z.array(postIdeaSchema).parse(snapshot.ideas);
    if (input.action === 'select') {
      if (!input.ideaId || !ideas.some((idea) => idea.id === input.ideaId)) {
        throw new Error('Selected idea does not exist in this workflow.');
      }
    }
    const result: IdeaWorkflowResumeResult = {
      threadId: input.threadId,
      status: input.action === 'select' ? 'selected' : 'rejected',
      selectedIdeaId: input.action === 'select' ? input.ideaId : undefined,
      reviewerNotes: input.notes || (input.action === 'select' ? 'Human selected idea for campaign conversion.' : 'Human rejected generated ideas.'),
      ideas,
    };
    await prisma.langGraphWorkflow.update({
      where: { thread_id: input.threadId },
      data: {
        status: 'completed',
        result_payload: toJsonObject(result),
        completed_at: new Date(),
      },
    });
    return result;
  }

  const result = await ideaSelectionGraph.invoke(new Command({
    resume: {
      action: input.action,
      ideaId: input.ideaId,
      notes: input.notes,
    },
  }), {
    configurable: { thread_id: input.threadId },
  });
  const status = z.enum(['selected', 'rejected']).parse(result.status);

  return {
    threadId: input.threadId,
    status,
    selectedIdeaId: result.selectedIdeaId,
    reviewerNotes: result.reviewerNotes,
    ideas: result.ideas,
  };
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

function toJsonObject(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function isDurableWorkflowStoreAvailable(): boolean {
  return process.env.NODE_ENV !== 'test' && Boolean(process.env.DATABASE_URL);
}
