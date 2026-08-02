import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, ValidationError } from '@shared/errors';

const repoMocks = vi.hoisted(() => ({
  getWeeklyWorkspace: vi.fn(),
  getWeeklyWorkItem: vi.fn(),
  createWeeklyWorkItem: vi.fn(),
  updateWeeklyWorkItem: vi.fn(),
  transitionWeeklyWorkItem: vi.fn(),
}));

vi.mock('../repository', () => repoMocks);

import * as service from '../service';

const user = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

function item(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-03T00:00:00.000Z');
  return {
    id: '00000000-0000-0000-0000-000000000010',
    commercialPlanId: '00000000-0000-0000-0000-000000000020',
    weekStartDate: '2026-08-03',
    weekEndDate: '2026-08-09',
    title: 'Launch campaign brief',
    businessOutcome: 'Brief approved for production',
    ownerUserId: user,
    ownerName: 'Assigned Specialist',
    ownerRole: 'specialist',
    startDate: '2026-08-03',
    dueDate: '2026-08-07',
    status: 'planned',
    priority: 'high',
    budgetGuardrail: 5000,
    currency: 'AED',
    linkType: null,
    linkObjectId: null,
    linkLabel: null,
    blockerReason: null,
    completionEvidence: null,
    revision: 1,
    createdByUserId: other,
    approvedByUserId: null,
    approvedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('weekly work service governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item());
    repoMocks.createWeeklyWorkItem.mockResolvedValue(item());
    repoMocks.updateWeeklyWorkItem.mockResolvedValue(item({ revision: 2 }));
    repoMocks.transitionWeeklyWorkItem.mockImplementation(async (_tenant, _actor, _plan, _item, input) => item({ status: input.targetStatus, revision: 2 }));
  });

  it('allows a manager to create weekly work', async () => {
    await expect(service.createWeeklyWorkItem('department_head', 'tenant-a', user, item().commercialPlanId, {
      weekStartDate: '2026-08-03',
      title: 'Launch campaign brief',
      businessOutcome: 'Brief approved for production',
      status: 'planned',
      priority: 'high',
    })).resolves.toMatchObject({ id: item().id });
  });

  it('blocks a specialist from creating weekly work directly', async () => {
    await expect(service.createWeeklyWorkItem('specialist', 'tenant-a', user, item().commercialPlanId, {
      weekStartDate: '2026-08-03',
      title: 'Launch campaign brief',
      businessOutcome: 'Brief approved for production',
      status: 'planned',
      priority: 'high',
    })).rejects.toThrow(ForbiddenError);
  });

  it('allows the assigned specialist to update their item', async () => {
    await expect(service.updateWeeklyWorkItem('specialist', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      title: 'Updated campaign brief',
    })).resolves.toMatchObject({ revision: 2 });
  });

  it('hides contributor updates from an unassigned specialist', async () => {
    await expect(service.updateWeeklyWorkItem('specialist', 'tenant-a', other, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      title: 'Unauthorized change',
    })).rejects.toThrow(ForbiddenError);
  });

  it('requires a blocker reason', async () => {
    await expect(service.transitionWeeklyWorkItem('specialist', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'blocked',
    })).rejects.toThrow(/blocker reason/);
  });

  it('requires completion evidence', async () => {
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item({ status: 'in_progress' }));
    await expect(service.transitionWeeklyWorkItem('specialist', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'completed',
    })).rejects.toThrow(/Completion evidence/);
  });

  it('allows a different CCO to approve submitted weekly work', async () => {
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item({ status: 'awaiting_approval', createdByUserId: other }));
    await expect(service.transitionWeeklyWorkItem('cco', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'ready',
      reason: 'Approved for this week',
    })).resolves.toMatchObject({ status: 'ready' });
  });

  it('prevents a CCO from approving their own item', async () => {
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item({ status: 'awaiting_approval', createdByUserId: user }));
    await expect(service.transitionWeeklyWorkItem('cco', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'ready',
      reason: 'Self approval',
    })).rejects.toThrow(ForbiddenError);
  });

  it('does not let a department head approve submitted weekly work', async () => {
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item({ status: 'awaiting_approval' }));
    await expect(service.transitionWeeklyWorkItem('department_head', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'ready',
      reason: 'Not the CCO',
    })).rejects.toThrow(ForbiddenError);
  });

  it('rejects unsupported status transitions', async () => {
    repoMocks.getWeeklyWorkItem.mockResolvedValue(item({ status: 'completed' }));
    await expect(service.transitionWeeklyWorkItem('department_head', 'tenant-a', user, item().commercialPlanId, item().id, {
      expectedRevision: 1,
      targetStatus: 'in_progress',
    })).rejects.toThrow(ValidationError);
  });
});
