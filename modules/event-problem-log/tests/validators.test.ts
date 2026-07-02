import { describe, it, expect } from 'vitest';
import { ValidationError } from '@shared/errors';
import { validateCreateProblem, validateUpdateProblem, validateTransitionProblem } from '../validators';

const validEventId = '550e8400-e29b-41d4-a716-446655440000';

describe('event-problem-log/validators', () => {
  describe('validateCreateProblem', () => {
    it('accepts valid input', () => {
      const result = validateCreateProblem({
        eventId: validEventId,
        title: 'Ad spend high but conversion low',
        category: 'ads',
        severity: 'high',
        source: 'kpi_review',
      });
      expect(result.title).toBe('Ad spend high but conversion low');
      expect(result.category).toBe('ads');
      expect(result.severity).toBe('high');
    });

    it('rejects missing title', () => {
      expect(() => validateCreateProblem({ eventId: validEventId, category: 'ads' })).toThrow(ValidationError);
    });

    it('rejects invalid category', () => {
      expect(() => validateCreateProblem({ eventId: validEventId, title: 'Test', category: 'invalid' })).toThrow(ValidationError);
    });

    it('rejects invalid severity', () => {
      expect(() => validateCreateProblem({ eventId: validEventId, title: 'Test', category: 'ads', severity: 'invalid' })).toThrow(ValidationError);
    });

    it('accepts optional severity', () => {
      const result = validateCreateProblem({ eventId: validEventId, title: 'Test', category: 'content' });
      expect(result.severity).toBeUndefined();
    });
  });

  describe('validateUpdateProblem', () => {
    it('accepts partial update', () => {
      const result = validateUpdateProblem({ title: 'Updated title', severity: 'critical' });
      expect(result.title).toBe('Updated title');
      expect(result.severity).toBe('critical');
    });

    it('rejects invalid category', () => {
      expect(() => validateUpdateProblem({ category: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('validateTransitionProblem', () => {
    it('accepts valid transition', () => {
      const result = validateTransitionProblem({ toStatus: 'investigating' });
      expect(result.toStatus).toBe('investigating');
    });

    it('accepts with resolution notes', () => {
      const result = validateTransitionProblem({ toStatus: 'resolved', resolutionNotes: 'Fixed by adjusting ad targeting' });
      expect(result.resolutionNotes).toBe('Fixed by adjusting ad targeting');
    });

    it('rejects invalid status', () => {
      expect(() => validateTransitionProblem({ toStatus: 'invalid' })).toThrow(ValidationError);
    });
  });
});
