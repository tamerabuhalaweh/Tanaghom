import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' }) },
  eventProblem: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'problem-1', tenant_key: 'tenant-a', event_id: 'event-1', status: 'open' }),
    update: vi.fn().mockResolvedValue({ id: 'problem-1', tenant_key: 'tenant-a', event_id: 'event-1' }),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));

import * as repo from '../repository';

describe('Event Problem Log tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists problems scoped to tenant', async () => {
    await repo.listProblems('tenant-a');
    expect(prismaMocks.eventProblem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('lists problems scoped to tenant and event', async () => {
    await repo.listProblems('tenant-a', 'event-1');
    expect(prismaMocks.eventProblem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }),
    }));
  });

  it('getProblemById scopes to tenant', async () => {
    prismaMocks.eventProblem.findFirst.mockResolvedValue(null);
    await expect(repo.getProblemById('tenant-a', 'problem-1')).rejects.toThrow();
    expect(prismaMocks.eventProblem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'problem-1' }),
    }));
  });

  it('createProblem verifies event ownership', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createProblem('tenant-a', 'user-1', {
      eventId: 'event-1',
      title: 'Test',
      category: 'ads',
    })).rejects.toThrow();
  });

  it('transitionProblem scopes to tenant', async () => {
    prismaMocks.eventProblem.findFirst.mockResolvedValue(null);
    await expect(repo.transitionProblem('tenant-a', 'problem-1', 'resolved', 'user-1', 'Fixed')).rejects.toThrow();
  });

  it('dashboard scopes to tenant', async () => {
    await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(prismaMocks.eventProblem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }),
    }));
  });
});
