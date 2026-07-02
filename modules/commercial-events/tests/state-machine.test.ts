import { describe, it, expect } from 'vitest';
import {
  isValidEventTransition,
  validateEventTransition,
  EventTransitionError,
  EVENT_TRANSITION_TABLE,
} from '../types';
import type { CommercialEventStatus } from '../types';

describe('Commercial Event State Machine', () => {
  describe('EVENT_TRANSITION_TABLE', () => {
    it('has all 5 statuses defined', () => {
      expect(Object.keys(EVENT_TRANSITION_TABLE)).toHaveLength(5);
    });

    it('draft can go to planning and cancelled', () => {
      expect(EVENT_TRANSITION_TABLE.draft).toContain('planning');
      expect(EVENT_TRANSITION_TABLE.draft).toContain('cancelled');
      expect(EVENT_TRANSITION_TABLE.draft).toHaveLength(2);
    });

    it('planning can go to active and cancelled', () => {
      expect(EVENT_TRANSITION_TABLE.planning).toContain('active');
      expect(EVENT_TRANSITION_TABLE.planning).toContain('cancelled');
      expect(EVENT_TRANSITION_TABLE.planning).toHaveLength(2);
    });

    it('active can go to completed and cancelled', () => {
      expect(EVENT_TRANSITION_TABLE.active).toContain('completed');
      expect(EVENT_TRANSITION_TABLE.active).toContain('cancelled');
      expect(EVENT_TRANSITION_TABLE.active).toHaveLength(2);
    });

    it('completed has no transitions (terminal)', () => {
      expect(EVENT_TRANSITION_TABLE.completed).toHaveLength(0);
    });

    it('cancelled has no transitions (terminal)', () => {
      expect(EVENT_TRANSITION_TABLE.cancelled).toHaveLength(0);
    });
  });

  describe('isValidEventTransition', () => {
    it('allows draft → planning', () => {
      expect(isValidEventTransition('draft', 'planning')).toBe(true);
    });

    it('allows draft → cancelled', () => {
      expect(isValidEventTransition('draft', 'cancelled')).toBe(true);
    });

    it('allows planning → active', () => {
      expect(isValidEventTransition('planning', 'active')).toBe(true);
    });

    it('allows planning → cancelled', () => {
      expect(isValidEventTransition('planning', 'cancelled')).toBe(true);
    });

    it('allows active → completed', () => {
      expect(isValidEventTransition('active', 'completed')).toBe(true);
    });

    it('allows active → cancelled', () => {
      expect(isValidEventTransition('active', 'cancelled')).toBe(true);
    });

    it('blocks draft → active', () => {
      expect(isValidEventTransition('draft', 'active')).toBe(false);
    });

    it('blocks draft → completed', () => {
      expect(isValidEventTransition('draft', 'completed')).toBe(false);
    });

    it('blocks planning → completed', () => {
      expect(isValidEventTransition('planning', 'completed')).toBe(false);
    });

    it('blocks completed → anything', () => {
      const allStatuses = Object.keys(EVENT_TRANSITION_TABLE) as CommercialEventStatus[];
      for (const status of allStatuses) {
        expect(isValidEventTransition('completed', status)).toBe(false);
      }
    });

    it('blocks cancelled → anything', () => {
      const allStatuses = Object.keys(EVENT_TRANSITION_TABLE) as CommercialEventStatus[];
      for (const status of allStatuses) {
        expect(isValidEventTransition('cancelled', status)).toBe(false);
      }
    });
  });

  describe('validateEventTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateEventTransition('draft', 'planning')).not.toThrow();
    });

    it('throws EventTransitionError for invalid transition', () => {
      expect(() => validateEventTransition('draft', 'completed')).toThrow(EventTransitionError);
    });

    it('error contains from and to statuses', () => {
      try {
        validateEventTransition('draft', 'completed');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(EventTransitionError);
        expect((err as EventTransitionError).from).toBe('draft');
        expect((err as EventTransitionError).to).toBe('completed');
      }
    });
  });
});
