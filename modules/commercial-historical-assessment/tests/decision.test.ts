import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decideFinding } from '../repository';

const txMocks = vi.hoisted(() => ({
  commercialHistoricalAssessmentFinding: {
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  commercialLearningSet: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  commercialHistoricalAssessmentRun: {
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  auditRecord: { create: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

describe('historical assessment review completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.$transaction.mockImplementation(async callback => callback(txMocks));
    txMocks.commercialHistoricalAssessmentFinding.findFirst.mockResolvedValue({
      id: 'finding-1',
      tenant_key: 'tenant-a',
      assessment_run: { id: 'run-1', title: 'Annual assessment', status: 'generated' },
    });
    txMocks.commercialHistoricalAssessmentFinding.update.mockResolvedValue({ id: 'finding-1' });
    txMocks.commercialHistoricalAssessmentRun.findUniqueOrThrow.mockResolvedValue({ id: 'run-1' });
  });

  it('archives a completed review when every finding was rejected', async () => {
    txMocks.commercialHistoricalAssessmentFinding.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await decideFinding('tenant-a', 'approver-1', 'finding-1', { decision: 'rejected', reason: 'Not supported enough' });

    expect(txMocks.commercialLearningSet.updateMany).toHaveBeenCalledWith({
      where: { assessment_run_id: 'run-1' },
      data: { status: 'archived' },
    });
    expect(txMocks.commercialHistoricalAssessmentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'archived', approved_at: null },
    });
  });

  it('marks the run approved only when at least one finding is approved', async () => {
    txMocks.commercialHistoricalAssessmentFinding.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    txMocks.commercialLearningSet.upsert.mockResolvedValue({ id: 'learning-1' });

    await decideFinding('tenant-a', 'approver-1', 'finding-1', { decision: 'approved' });

    expect(txMocks.commercialHistoricalAssessmentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'approved' }),
    });
    expect(txMocks.commercialLearningSet.updateMany).not.toHaveBeenCalled();
  });
});
