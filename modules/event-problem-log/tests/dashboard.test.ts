import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  eventProblem: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Event Problem Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty dashboard when no problems exist', async () => {
    const result = await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(result.totalProblems).toBe(0);
    expect(result.openProblems).toBe(0);
    expect(result.criticalOpen).toBe(0);
    expect(result.topBlockers).toHaveLength(0);
  });

  it('calculates correct totals', async () => {
    prismaMocks.eventProblem.findMany.mockResolvedValue([
      { id: 'p1', title: 'Problem 1', severity: 'critical', status: 'open', category: 'ads', owner_role: 'marketing_manager' },
      { id: 'p2', title: 'Problem 2', severity: 'high', status: 'investigating', category: 'sales', owner_role: 'sales_manager' },
      { id: 'p3', title: 'Problem 3', severity: 'medium', status: 'resolved', category: 'content', owner_role: null },
      { id: 'p4', title: 'Problem 4', severity: 'low', status: 'dismissed', category: 'other', owner_role: null },
    ]);

    const result = await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(result.totalProblems).toBe(4);
    expect(result.openProblems).toBe(2);
    expect(result.criticalOpen).toBe(1);
    expect(result.bySeverity.critical).toBe(1);
    expect(result.bySeverity.high).toBe(1);
    expect(result.byStatus.open).toBe(1);
    expect(result.byStatus.investigating).toBe(1);
    expect(result.byStatus.resolved).toBe(1);
    expect(result.byCategory.ads).toBe(1);
    expect(result.byCategory.sales).toBe(1);
  });

  it('top blockers sorted by severity', async () => {
    prismaMocks.eventProblem.findMany.mockResolvedValue([
      { id: 'p1', title: 'Low problem', severity: 'low', status: 'open', category: 'other', owner_role: null },
      { id: 'p2', title: 'Critical problem', severity: 'critical', status: 'open', category: 'ads', owner_role: 'marketing_manager' },
      { id: 'p3', title: 'High problem', severity: 'high', status: 'investigating', category: 'sales', owner_role: 'sales_manager' },
    ]);

    const result = await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(result.topBlockers).toHaveLength(3);
    expect(result.topBlockers[0].severity).toBe('critical');
    expect(result.topBlockers[1].severity).toBe('high');
    expect(result.topBlockers[2].severity).toBe('low');
  });

  it('top blockers limited to 5', async () => {
    const problems = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`, title: `Problem ${i}`, severity: 'medium', status: 'open', category: 'content', owner_role: null,
    }));
    prismaMocks.eventProblem.findMany.mockResolvedValue(problems);

    const result = await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(result.topBlockers).toHaveLength(5);
  });

  it('only open and investigating count as blockers', async () => {
    prismaMocks.eventProblem.findMany.mockResolvedValue([
      { id: 'p1', title: 'Resolved critical', severity: 'critical', status: 'resolved', category: 'ads', owner_role: null },
      { id: 'p2', title: 'Open low', severity: 'low', status: 'open', category: 'other', owner_role: null },
    ]);

    const result = await repo.getProblemDashboard('tenant-a', 'event-1');
    expect(result.openProblems).toBe(1);
    expect(result.criticalOpen).toBe(0);
    expect(result.topBlockers).toHaveLength(1);
    expect(result.topBlockers[0].id).toBe('p2');
  });
});
