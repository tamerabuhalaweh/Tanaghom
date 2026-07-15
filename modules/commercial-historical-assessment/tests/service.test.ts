import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAssessment } from '../service';

const repoMocks = vi.hoisted(() => ({
  startGeneration: vi.fn(),
  saveGeneratedFindings: vi.fn(),
  markGenerationFailed: vi.fn(),
  serializeAssessment: vi.fn((value: unknown) => value),
}));
const providerMocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  generate: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock('../repository', () => repoMocks);
vi.mock('@modules/ai-provider/controller', () => ({ resolveUserLLMProvider: providerMocks.resolve }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

const evidenceId = '11111111-1111-4111-8111-111111111111';

describe('historical assessment AI generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.startGeneration.mockResolvedValue({
      id: 'run-1',
      title: 'Historical assessment',
      date_from: new Date('2025-01-01'),
      date_to: new Date('2025-12-31'),
      evidence_summary: { completedEvents: 2 },
      missing_data: [],
      evidence: [{
        id: evidenceId,
        evidence_type: 'event_kpi',
        source_name: 'Course launch',
        metric_key: 'channel_performance',
        metric_value: 100,
        metric_unit: 'AED',
        observed_at: new Date('2025-06-01'),
        payload: { leads: 20, purchases: 5 },
      }],
    });
    providerMocks.getStatus.mockReturnValue({ type: 'gemma', model: 'gemma4-26b-a4b-canary' });
    providerMocks.resolve.mockResolvedValue({ generate: providerMocks.generate, getStatus: providerMocks.getStatus });
  });

  it('saves only structured, evidence-referenced AI findings', async () => {
    providerMocks.generate.mockResolvedValue({
      text: JSON.stringify({ findings: [{
        type: 'repeat',
        title: 'Repeat warm-audience launch pattern',
        summary: 'Verified outcomes show purchases from this launch.',
        recommendation: 'Reuse the proven warm-audience sequence.',
        confidence: 0.82,
        evidenceIds: [evidenceId],
      }] }),
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });
    repoMocks.saveGeneratedFindings.mockResolvedValue({ id: 'run-1', status: 'generated' });

    const result = await generateAssessment('department_head', 'tenant-a', 'user-1', 'run-1');

    expect(providerMocks.generate).toHaveBeenCalledWith(expect.stringContaining(evidenceId), expect.objectContaining({ temperature: 0.15 }));
    expect(repoMocks.saveGeneratedFindings).toHaveBeenCalledWith('tenant-a', 'user-1', 'run-1', expect.objectContaining({
      findings: [expect.objectContaining({ evidenceIds: [evidenceId], confidence: 0.82 })],
    }), expect.objectContaining({ type: 'gemma' }));
    expect(result).toMatchObject({ status: 'generated' });
  });

  it('records provider failure and does not claim generation completed', async () => {
    providerMocks.generate.mockRejectedValue(new Error('provider unavailable'));

    await expect(generateAssessment('department_head', 'tenant-a', 'user-1', 'run-1')).rejects.toThrow('provider unavailable');
    expect(repoMocks.markGenerationFailed).toHaveBeenCalledWith('tenant-a', 'run-1', expect.stringContaining('provider unavailable'));
    expect(repoMocks.saveGeneratedFindings).not.toHaveBeenCalled();
  });

  it('rejects malformed provider JSON and records a failed run', async () => {
    providerMocks.generate.mockResolvedValue({
      text: 'This is not structured JSON.',
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });

    await expect(generateAssessment('department_head', 'tenant-a', 'user-1', 'run-1')).rejects.toMatchObject({
      code: 'AI_ASSESSMENT_INVALID_RESPONSE',
    });
    expect(repoMocks.markGenerationFailed).toHaveBeenCalledWith('tenant-a', 'run-1', 'AI returned no valid assessment JSON');
    expect(repoMocks.saveGeneratedFindings).not.toHaveBeenCalled();
  });

  it('rejects partial findings that do not cite evidence', async () => {
    providerMocks.generate.mockResolvedValue({
      text: JSON.stringify({ findings: [{
        type: 'repeat',
        title: 'Incomplete provider finding',
        summary: 'A result without traceable evidence.',
        recommendation: 'Do something next.',
        confidence: 0.7,
      }] }),
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
    });

    await expect(generateAssessment('department_head', 'tenant-a', 'user-1', 'run-1')).rejects.toThrow();
    expect(repoMocks.markGenerationFailed).toHaveBeenCalledWith('tenant-a', 'run-1', expect.stringContaining('Assessment generation failed'));
    expect(repoMocks.saveGeneratedFindings).not.toHaveBeenCalled();
  });

  it('records provider timeouts without persisting findings', async () => {
    providerMocks.generate.mockRejectedValue(new Error('provider request timed out after 45000ms'));

    await expect(generateAssessment('department_head', 'tenant-a', 'user-1', 'run-1')).rejects.toThrow('timed out');
    expect(repoMocks.markGenerationFailed).toHaveBeenCalledWith('tenant-a', 'run-1', expect.stringContaining('timed out'));
    expect(repoMocks.saveGeneratedFindings).not.toHaveBeenCalled();
  });
});
