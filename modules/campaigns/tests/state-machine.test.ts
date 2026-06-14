import { describe, it, expect } from 'vitest';
import { isValidTransition, validateTransition, StateTransitionError, TRANSITION_TABLE } from '../types';
import type { ContentState } from '../types';

describe('Content State Machine', () => {
  describe('TRANSITION_TABLE', () => {
    it('has all 15 states defined', () => {
      expect(Object.keys(TRANSITION_TABLE)).toHaveLength(15);
    });

    it('idea can go to drafting and rejected', () => {
      expect(TRANSITION_TABLE.idea).toContain('drafting');
      expect(TRANSITION_TABLE.idea).toContain('rejected');
      expect(TRANSITION_TABLE.idea).toHaveLength(2);
    });

    it('drafting can go to pending_review and failed', () => {
      expect(TRANSITION_TABLE.drafting).toContain('pending_review');
      expect(TRANSITION_TABLE.drafting).toContain('failed');
      expect(TRANSITION_TABLE.drafting).toHaveLength(2);
    });

    it('pending_review can go to approved, needs_edits, rejected, expired', () => {
      expect(TRANSITION_TABLE.pending_review).toContain('approved');
      expect(TRANSITION_TABLE.pending_review).toContain('needs_edits');
      expect(TRANSITION_TABLE.pending_review).toContain('rejected');
      expect(TRANSITION_TABLE.pending_review).toContain('expired');
      expect(TRANSITION_TABLE.pending_review).toHaveLength(4);
    });

    it('rejected has no transitions (terminal)', () => {
      expect(TRANSITION_TABLE.rejected).toHaveLength(0);
    });

    it('archived has no transitions (terminal)', () => {
      expect(TRANSITION_TABLE.archived).toHaveLength(0);
    });
  });

  describe('isValidTransition', () => {
    it('allows idea → drafting', () => {
      expect(isValidTransition('idea', 'drafting')).toBe(true);
    });

    it('allows idea → rejected', () => {
      expect(isValidTransition('idea', 'rejected')).toBe(true);
    });

    it('allows drafting → pending_review', () => {
      expect(isValidTransition('drafting', 'pending_review')).toBe(true);
    });

    it('allows pending_review → approved', () => {
      expect(isValidTransition('pending_review', 'approved')).toBe(true);
    });

    it('allows pending_review → needs_edits', () => {
      expect(isValidTransition('pending_review', 'needs_edits')).toBe(true);
    });

    it('allows approved → scheduled', () => {
      expect(isValidTransition('approved', 'scheduled')).toBe(true);
    });

    it('allows scheduled → published', () => {
      expect(isValidTransition('scheduled', 'published')).toBe(true);
    });

    it('allows published → analytics_pending', () => {
      expect(isValidTransition('published', 'analytics_pending')).toBe(true);
    });

    it('allows analytics_pending → analyzed', () => {
      expect(isValidTransition('analytics_pending', 'analyzed')).toBe(true);
    });

    it('allows analyzed → archived', () => {
      expect(isValidTransition('analyzed', 'archived')).toBe(true);
    });

    it('allows analyzed → recycle_candidate', () => {
      expect(isValidTransition('analyzed', 'recycle_candidate')).toBe(true);
    });

    it('allows recycle_candidate → idea', () => {
      expect(isValidTransition('recycle_candidate', 'idea')).toBe(true);
    });

    it('allows failed → scheduled (retry)', () => {
      expect(isValidTransition('failed', 'scheduled')).toBe(true);
    });

    it('allows failed → cancelled', () => {
      expect(isValidTransition('failed', 'cancelled')).toBe(true);
    });

    it('allows expired → drafting (re-draft)', () => {
      expect(isValidTransition('expired', 'drafting')).toBe(true);
    });

    it('allows cancelled → archived', () => {
      expect(isValidTransition('cancelled', 'archived')).toBe(true);
    });

    // Invalid transitions
    it('blocks idea → published', () => {
      expect(isValidTransition('idea', 'published')).toBe(false);
    });

    it('blocks idea → approved', () => {
      expect(isValidTransition('idea', 'approved')).toBe(false);
    });

    it('blocks drafting → approved', () => {
      expect(isValidTransition('drafting', 'approved')).toBe(false);
    });

    it('blocks drafting → published', () => {
      expect(isValidTransition('drafting', 'published')).toBe(false);
    });

    it('blocks pending_review → published', () => {
      expect(isValidTransition('pending_review', 'published')).toBe(false);
    });

    it('blocks approved → published', () => {
      expect(isValidTransition('approved', 'published')).toBe(false);
    });

    it('blocks published → idea', () => {
      expect(isValidTransition('published', 'idea')).toBe(false);
    });

    it('blocks rejected → anything', () => {
      const allStates = Object.keys(TRANSITION_TABLE) as ContentState[];
      for (const state of allStates) {
        expect(isValidTransition('rejected', state)).toBe(false);
      }
    });

    it('blocks archived → anything', () => {
      const allStates = Object.keys(TRANSITION_TABLE) as ContentState[];
      for (const state of allStates) {
        expect(isValidTransition('archived', state)).toBe(false);
      }
    });

    it('blocks any state → idea (except recycle_candidate)', () => {
      const statesExceptRecycle = Object.keys(TRANSITION_TABLE).filter(
        (s) => s !== 'recycle_candidate',
      ) as ContentState[];
      for (const state of statesExceptRecycle) {
        expect(isValidTransition(state, 'idea')).toBe(false);
      }
    });
  });

  describe('validateTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateTransition('idea', 'drafting')).not.toThrow();
    });

    it('throws StateTransitionError for invalid transition', () => {
      expect(() => validateTransition('idea', 'published')).toThrow(StateTransitionError);
    });

    it('error contains from and to states', () => {
      try {
        validateTransition('idea', 'published');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StateTransitionError);
        expect((err as StateTransitionError).from).toBe('idea');
        expect((err as StateTransitionError).to).toBe('published');
      }
    });
  });
});
