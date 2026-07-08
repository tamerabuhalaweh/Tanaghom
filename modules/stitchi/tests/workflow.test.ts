import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  langGraphWorkflow: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
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
    prismaMocks.langGraphWorkflow.upsert.mockResolvedValue({});
    prismaMocks.langGraphWorkflow.updateMany.mockResolvedValue({ count: 1 });
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
    expect(prismaMocks.langGraphWorkflow.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { thread_id: 'thread-stitchi-action-2', tenant_key: 'tenant-a' },
      data: expect.objectContaining({ status: 'completed' }),
    }));
  });
});
