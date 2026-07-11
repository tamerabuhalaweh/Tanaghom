import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  observabilityEvent: { findFirst: vi.fn(), findMany: vi.fn() },
  auditRecord: { findMany: vi.fn() },
  learningSignal: { findMany: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import { getTenantEventById, listAuditRecords, listEvents, listLearningSignals } from '../repository';

describe('observability tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.user.findMany.mockResolvedValue([{ id: 'user-a', agent_reps: [{ id: 'rep-a' }] }]);
    prismaMocks.observabilityEvent.findMany.mockResolvedValue([]);
    prismaMocks.auditRecord.findMany.mockResolvedValue([]);
    prismaMocks.learningSignal.findMany.mockResolvedValue([]);
  });

  it('scopes audit records to tenant user and AgentRep identities', async () => {
    await listAuditRecords({ tenantKey: 'tenant-a', targetObjectId: 'object-a' });

    expect(prismaMocks.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a' },
    }));
    expect(prismaMocks.auditRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        target_object_id: 'object-a',
        OR: [
          { human_user_id: { in: ['user-a'] } },
          { agent_rep_id: { in: ['rep-a'] } },
        ],
      }),
    }));
  });

  it('scopes observability events to tenant identities', async () => {
    await listEvents({ tenantKey: 'tenant-a', eventCategory: 'campaign' });

    expect(prismaMocks.observabilityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        event_category: 'campaign',
        OR: [
          { human_user_id: { in: ['user-a'] } },
          { agent_rep_id: { in: ['rep-a'] } },
        ],
      }),
    }));
  });

  it('returns not found for an event outside the tenant identity scope', async () => {
    prismaMocks.observabilityEvent.findFirst.mockResolvedValue(null);

    await expect(getTenantEventById('event-b', 'tenant-a')).rejects.toThrow('ObservabilityEvent');
    expect(prismaMocks.observabilityEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'event-b' }),
    }));
  });

  it('limits learning signals to tenant-scoped source records', async () => {
    prismaMocks.auditRecord.findMany.mockResolvedValueOnce([{ id: 'audit-a' }]);
    prismaMocks.observabilityEvent.findMany.mockResolvedValueOnce([{ id: 'event-a' }]);

    await listLearningSignals({ tenantKey: 'tenant-a' });

    expect(prismaMocks.learningSignal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { source_audit_record_id: { in: ['audit-a'] } },
          { source_event_id: { in: ['event-a'] } },
        ],
      },
    }));
  });
});
