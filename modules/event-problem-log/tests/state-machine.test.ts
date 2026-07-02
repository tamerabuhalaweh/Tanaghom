import { describe, it, expect } from 'vitest';
import { isValidProblemTransition, validateProblemTransition, ProblemTransitionError, PROBLEM_TRANSITION_TABLE } from '../types';
import type { ProblemStatus } from '../types';

describe('Event Problem State Machine', () => {
  describe('PROBLEM_TRANSITION_TABLE', () => {
    it('has all 4 statuses defined', () => {
      expect(Object.keys(PROBLEM_TRANSITION_TABLE)).toHaveLength(4);
    });

    it('open can go to investigating, resolved, dismissed', () => {
      expect(PROBLEM_TRANSITION_TABLE.open).toContain('investigating');
      expect(PROBLEM_TRANSITION_TABLE.open).toContain('resolved');
      expect(PROBLEM_TRANSITION_TABLE.open).toContain('dismissed');
    });

    it('investigating can go to open, resolved, dismissed', () => {
      expect(PROBLEM_TRANSITION_TABLE.investigating).toContain('open');
      expect(PROBLEM_TRANSITION_TABLE.investigating).toContain('resolved');
      expect(PROBLEM_TRANSITION_TABLE.investigating).toContain('dismissed');
    });

    it('resolved has no transitions (terminal)', () => {
      expect(PROBLEM_TRANSITION_TABLE.resolved).toHaveLength(0);
    });

    it('dismissed has no transitions (terminal)', () => {
      expect(PROBLEM_TRANSITION_TABLE.dismissed).toHaveLength(0);
    });
  });

  describe('isValidProblemTransition', () => {
    it('allows open → investigating', () => {
      expect(isValidProblemTransition('open', 'investigating')).toBe(true);
    });

    it('allows open → resolved', () => {
      expect(isValidProblemTransition('open', 'resolved')).toBe(true);
    });

    it('allows investigating → open', () => {
      expect(isValidProblemTransition('investigating', 'open')).toBe(true);
    });

    it('blocks resolved → anything', () => {
      const allStatuses = Object.keys(PROBLEM_TRANSITION_TABLE) as ProblemStatus[];
      for (const status of allStatuses) {
        expect(isValidProblemTransition('resolved', status)).toBe(false);
      }
    });

    it('blocks dismissed → anything', () => {
      const allStatuses = Object.keys(PROBLEM_TRANSITION_TABLE) as ProblemStatus[];
      for (const status of allStatuses) {
        expect(isValidProblemTransition('dismissed', status)).toBe(false);
      }
    });
  });

  describe('validateProblemTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateProblemTransition('open', 'investigating')).not.toThrow();
    });

    it('throws ProblemTransitionError for invalid transition', () => {
      expect(() => validateProblemTransition('resolved', 'open')).toThrow(ProblemTransitionError);
    });

    it('error contains from and to statuses', () => {
      try {
        validateProblemTransition('resolved', 'open');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProblemTransitionError);
        expect((err as ProblemTransitionError).from).toBe('resolved');
        expect((err as ProblemTransitionError).to).toBe('open');
      }
    });
  });
});
