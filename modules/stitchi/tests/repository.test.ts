import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  stitchiConversation: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  stitchiMessage: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
  stitchiActionRun: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  stitchiActionApproval: {
    create: vi.fn(),
  },
  commercialEvent: {
    findFirst: vi.fn(),
  },
  auditRecord: {
    create: vi.fn(),
  },
  $transaction: vi.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { NotFoundError, ValidationError } from '@shared/errors';
import * as repo from '../repository';

const now = new Date('2026-07-08T12:00:00Z');

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    tenant_key: 'tenant-a',
    user_id: 'user-1',
    event_id: null,
    title: 'Plan my event',
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    tenant_key: 'tenant-a',
    conversation_id: 'conversation-1',
    role: 'user',
    content: 'Hello',
    metadata: {},
    created_at: now,
    ...overrides,
  };
}

function actionRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    tenant_key: 'tenant-a',
    conversation_id: 'conversation-1',
    user_id: 'user-1',
    action_type: 'draft_event_strategy',
    status: 'awaiting_approval',
    input_payload: {},
    preview_payload: null,
    result_payload: null,
    requires_approval: true,
    risk_level: 'medium',
    audit_record_id: null,
    langgraph_thread_id: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    conversation: { user_id: 'user-1' },
    ...overrides,
  };
}

function approval(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval-1',
    tenant_key: 'tenant-a',
    action_run_id: 'action-1',
    approver_user_id: 'manager-1',
    decision: 'approved',
    notes: null,
    created_at: now,
    ...overrides,
  };
}

describe('Stitchi repository foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.auditRecord.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('lists conversations scoped to tenant and current user by default', async () => {
    await repo.listConversations('tenant-a', 'user-1', 'marketing_manager', {});
    expect(prismaMocks.stitchiConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', user_id: 'user-1' },
    }));
  });

  it('allows admin tenant-wide listing only when explicitly requested', async () => {
    await repo.listConversations('tenant-a', 'admin-1', 'admin', { includeTenant: true });
    expect(prismaMocks.stitchiConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a' },
    }));
  });

  it('validates event ownership before creating an event-linked conversation', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createConversation('tenant-a', 'user-1', {
      title: 'Plan event',
      eventId: '00000000-0000-0000-0000-000000000001',
    })).rejects.toThrow(NotFoundError);
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '00000000-0000-0000-0000-000000000001', tenant_key: 'tenant-a' },
    }));
  });

  it('creates a tenant-scoped conversation and audit record', async () => {
    prismaMocks.stitchiConversation.create.mockResolvedValue(conversation());
    const result = await repo.createConversation('tenant-a', 'user-1', { title: 'Plan event' });
    expect(result.tenantKey).toBe('tenant-a');
    expect(prismaMocks.stitchiConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenant_key: 'tenant-a', user_id: 'user-1', title: 'Plan event' }),
    }));
    expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'stitchi_conversation_created', target_object_id: 'conversation-1' }),
    }));
  });

  it('hides conversations from other users inside the same tenant for non-admin roles', async () => {
    prismaMocks.stitchiConversation.findFirst.mockResolvedValue(null);
    await expect(repo.getConversation('tenant-a', 'user-2', 'social_media_manager', 'conversation-1')).rejects.toThrow(NotFoundError);
    expect(prismaMocks.stitchiConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'conversation-1', tenant_key: 'tenant-a', user_id: 'user-2' },
    }));
  });

  it('redacts secrets from stored message content and metadata', async () => {
    prismaMocks.stitchiConversation.findFirst.mockResolvedValue(conversation());
    prismaMocks.stitchiMessage.create.mockImplementation(async ({ data }) => message(data));
    await repo.createMessage('tenant-a', 'user-1', 'marketing_manager', 'conversation-1', {
      content: 'please use api key sk_live_123456789',
      metadata: { apiKey: 'raw-secret', nested: { accessToken: 'token-secret', safe: 'ok' } },
    });
    expect(prismaMocks.stitchiMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: expect.not.stringContaining('sk_live_123456789'),
        metadata: expect.objectContaining({
          apiKey: '[redacted]',
          nested: expect.objectContaining({ accessToken: '[redacted]', safe: 'ok' }),
        }),
      }),
    }));
  });

  it('creates assistant messages through the same redacted tenant-scoped storage path', async () => {
    prismaMocks.stitchiConversation.findFirst.mockResolvedValue(conversation());
    prismaMocks.stitchiMessage.create.mockImplementation(async ({ data }) => message({ ...data, role: 'assistant' }));

    const result = await repo.createAssistantMessage(
      'tenant-a',
      'user-1',
      'marketing_manager',
      'conversation-1',
      'Use authorization Bearer abcdefghijklmnop',
      { mode: 'read_only', provider: 'gemma', apiKey: 'must-not-store' },
    );

    expect(result.role).toBe('assistant');
    expect(prismaMocks.stitchiMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_key: 'tenant-a',
        conversation_id: 'conversation-1',
        role: 'assistant',
        content: expect.not.stringContaining('abcdefghijklmnop'),
        metadata: expect.objectContaining({ apiKey: '[redacted]', provider: 'gemma' }),
      }),
    }));
    expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'stitchi_assistant_message_created' }),
    }));
  });

  it('creates action proposals without executing business work', async () => {
    prismaMocks.stitchiConversation.findFirst.mockResolvedValue(conversation());
    prismaMocks.stitchiActionRun.create.mockImplementation(async ({ data }) => actionRun(data));
    const run = await repo.createActionRun('tenant-a', 'user-1', 'marketing_manager', 'conversation-1', {
      actionType: 'draft_event_strategy',
      inputPayload: { objective: 'launch event', apiKey: 'raw-secret' },
      requiresApproval: true,
      riskLevel: 'medium',
    });
    expect(run.status).toBe('awaiting_approval');
    expect(prismaMocks.stitchiActionRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'awaiting_approval',
        input_payload: expect.objectContaining({ objective: 'launch event', apiKey: '[redacted]' }),
      }),
    }));
    expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'stitchi_action_run_created' }),
    }));
  });

  it('approves only proposed or awaiting-approval actions', async () => {
    prismaMocks.stitchiActionRun.findFirst.mockResolvedValue(actionRun({ status: 'completed' }));
    await expect(repo.decideActionRun('tenant-a', 'manager-1', 'marketing_manager', 'action-1', 'approved', {}))
      .rejects.toThrow(ValidationError);
  });

  it('records approval decision and audit evidence', async () => {
    prismaMocks.stitchiActionRun.findFirst.mockResolvedValue(actionRun());
    prismaMocks.stitchiActionRun.update.mockResolvedValue(actionRun({ status: 'approved' }));
    prismaMocks.stitchiActionApproval.create.mockResolvedValue(approval());

    const result = await repo.decideActionRun('tenant-a', 'manager-1', 'marketing_manager', 'action-1', 'approved', {
      notes: 'Approved after review',
    });

    expect(result.actionRun.status).toBe('approved');
    expect(prismaMocks.stitchiActionApproval.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ decision: 'approved', approver_user_id: 'manager-1' }),
    }));
    expect(prismaMocks.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'stitchi_action_approved' }),
    }));
  });

  it('does not allow a non-admin user to decide another user conversation action', async () => {
    prismaMocks.stitchiActionRun.findFirst.mockResolvedValue(actionRun({ conversation: { user_id: 'user-1' } }));
    await expect(repo.decideActionRun('tenant-a', 'user-2', 'sales_manager', 'action-1', 'approved', {}))
      .rejects.toThrow(NotFoundError);
  });
});
