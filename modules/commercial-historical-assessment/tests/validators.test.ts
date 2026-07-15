import { describe, expect, it } from 'vitest';
import { validateAssessmentFindingDecision, validateAssessmentPreview, validateCreateAssessmentRun } from '../validators';

describe('historical assessment validators', () => {
  it('accepts a bounded historical scope and converts ISO dates', () => {
    const value = validateCreateAssessmentRun({
      title: '2025 course launch assessment',
      revenueLineId: '11111111-1111-4111-8111-111111111111',
      dateFrom: '2025-01-01T00:00:00.000Z',
      dateTo: '2025-12-31T23:59:59.999Z',
    });
    expect(value.dateFrom).toBeInstanceOf(Date);
    expect(value.dateTo).toBeInstanceOf(Date);
  });

  it('normalizes omitted scope lists and rejects unsupported channels', () => {
    const parsed = validateAssessmentPreview({
      dateFrom: '2025-01-01T00:00:00.000Z',
      dateTo: '2025-12-31T23:59:59.999Z',
    });
    expect(parsed.eventIds).toEqual([]);
    expect(parsed.campaignIds).toEqual([]);
    expect(parsed.channels).toEqual([]);

    expect(() => validateAssessmentPreview({
      dateFrom: '2025-01-01T00:00:00.000Z',
      dateTo: '2025-12-31T23:59:59.999Z',
      channels: ['unknown_network'],
    })).toThrow();
  });

  it('rejects reversed and excessive ranges', () => {
    expect(() => validateAssessmentPreview({ dateFrom: '2026-06-01', dateTo: '2026-01-01' })).toThrow();
    expect(() => validateAssessmentPreview({ dateFrom: '2019-01-01', dateTo: '2026-01-01' })).toThrow();
  });

  it('accepts only explicit approval or rejection decisions', () => {
    expect(validateAssessmentFindingDecision({ decision: 'approved', reason: 'Supported by verified results' }).decision).toBe('approved');
    expect(() => validateAssessmentFindingDecision({ decision: 'pending' })).toThrow();
  });
});
