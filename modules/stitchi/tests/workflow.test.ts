import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  langGraphWorkflow: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import {
  resumeStitchiActionApprovalWorkflow,
  startStitchiActionApprovalWorkflow,
} from '../workflow';

describe('Stitchi LangGraph action approval workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.langGraphWorkflow.findFirst.mockResolvedValue(null);
    prismaMocks.langGraphWorkflow.upsert.mockResolvedValue({});
  });

  it('starts with a human approval interrupt and stores a durable snapshot', async () => {
    const result = await startStitchiActionApprovalWorkflow({
      threadId: 'thread-stitchi-action-1',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      conversationId: 'conversation-1',
      actionRunId: 'action-1',
      actionType: 'create_event_problem',
      inputSummary: { title: 'Follow-up delay' },
    });

    expect(result.status).toBe('awaiting_human_approval');
    expect(result.interrupt).toMatchObject({
      action: 'review_stitchi_action',
      actionRunId: 'action-1',
      actionType: 'create_event_problem',
    });
    expect(prismaMocks.langGraphWorkflow.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { thread_id: 'thread-stitchi-action-1' },
      create: expect.objectContaining({
        tenant_key: 'tenant-a',
        workflow_type: 'stitchi_action_approval',
        status: 'interrupted',
      }),
    }));
  });

  it('resumes the paused graph with the approval decision', async () => {
    await startStitchiActionApprovalWorkflow({
      threadId: 'thread-stitchi-action-2',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      conversationId: 'conversation-1',
      actionRunId: 'action-2',
      actionType: 'update_lead_status',
      inputSummary: { toStatus: 'contacted' },
    });

    const result = await resumeStitchiActionApprovalWorkflow({
      threadId: 'thread-stitchi-action-2',
      tenantKey: 'tenant-a',
      userId: 'manager-1',
      decision: 'approved',
      notes: 'Approved by manager',
    });

    expect(result).toMatchObject({
      threadId: 'thread-stitchi-action-2',
      status: 'approved',
      reviewerNotes: 'Approved by manager',
    });
    expect(prismaMocks.langGraphWorkflow.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { thread_id: 'thread-stitchi-action-2' },
      update: expect.objectContaining({ status: 'completed' }),
    }));
  });

  it('recovers approval from the durable decision when the in-memory checkpoint is unavailable', async () => {
    const result = await resumeStitchiActionApprovalWorkflow({
      threadId: 'thread-without-memory-checkpoint',
      tenantKey: 'tenant-a',
      userId: 'manager-1',
      decision: 'approved',
      notes: 'Approved after backend restart',
    });

    expect(result).toEqual({
      threadId: 'thread-without-memory-checkpoint',
      status: 'approved',
      reviewerNotes: 'Approved after backend restart',
    });
    expect(prismaMocks.langGraphWorkflow.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { thread_id: 'thread-without-memory-checkpoint' },
      create: expect.objectContaining({
        status: 'completed',
        checkpoint_strategy: 'database_state_snapshot_recovery',
      }),
      update: expect.objectContaining({ status: 'completed' }),
    }));
  });

  it('reuses a durable pending workflow instead of starting a second interrupt', async () => {
    prismaMocks.langGraphWorkflow.findFirst.mockResolvedValue({
      status: 'interrupted',
      interrupt_payload: { action: 'review_stitchi_action', actionRunId: 'action-3' },
    });

    const result = await startStitchiActionApprovalWorkflow({
      threadId: 'thread-stitchi-action-3',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      conversationId: 'conversation-1',
      actionRunId: 'action-3',
      actionType: 'prepare_ghl_operation',
      inputSummary: { type: 'contact_tags_update' },
    });

    expect(result).toEqual({
      threadId: 'thread-stitchi-action-3',
      status: 'awaiting_human_approval',
      interrupt: { action: 'review_stitchi_action', actionRunId: 'action-3' },
    });
    expect(prismaMocks.langGraphWorkflow.upsert).not.toHaveBeenCalled();
  });
});
