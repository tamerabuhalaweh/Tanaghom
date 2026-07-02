import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/database', () => ({
  prisma: {
    eventProblem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import * as service from '../service';

describe('List filters validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts valid severity filter', async () => {
    await expect(
      service.listProblems('admin', 'tenant-a', undefined, undefined, 'high'),
    ).resolves.toBeDefined();
  });

  it('accepts valid category filter', async () => {
    await expect(
      service.listProblems('admin', 'tenant-a', undefined, undefined, undefined, 'content'),
    ).resolves.toBeDefined();
  });

  it('accepts all filters combined', async () => {
    await expect(
      service.listProblems('admin', 'tenant-a', 'event-1', 'open', 'critical', 'ads'),
    ).resolves.toBeDefined();
  });

  it('accepts no filters', async () => {
    await expect(
      service.listProblems('admin', 'tenant-a'),
    ).resolves.toBeDefined();
  });
});
