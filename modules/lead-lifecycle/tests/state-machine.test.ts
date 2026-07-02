import { describe, it, expect } from 'vitest';
import { isValidLeadTransition, validateLeadTransition, LeadTransitionError, LEAD_TRANSITION_TABLE } from '../types';
import type { LeadStatus } from '../types';

describe('Lead Lifecycle State Machine', () => {
  describe('LEAD_TRANSITION_TABLE', () => {
    it('has all 12 statuses defined', () => {
      expect(Object.keys(LEAD_TRANSITION_TABLE)).toHaveLength(12);
    });

    it('new_lead can go to contacted and lost', () => {
      expect(LEAD_TRANSITION_TABLE.new_lead).toContain('contacted');
      expect(LEAD_TRANSITION_TABLE.new_lead).toContain('lost');
    });

    it('contacted can go to meeting_booked, follow_up_needed, lost', () => {
      expect(LEAD_TRANSITION_TABLE.contacted).toContain('meeting_booked');
      expect(LEAD_TRANSITION_TABLE.contacted).toContain('follow_up_needed');
      expect(LEAD_TRANSITION_TABLE.contacted).toContain('lost');
    });

    it('meeting_booked can go to meeting_attended, no_show, lost', () => {
      expect(LEAD_TRANSITION_TABLE.meeting_booked).toContain('meeting_attended');
      expect(LEAD_TRANSITION_TABLE.meeting_booked).toContain('no_show');
      expect(LEAD_TRANSITION_TABLE.meeting_booked).toContain('lost');
    });

    it('meeting_attended can go to purchased, follow_up_needed, lost', () => {
      expect(LEAD_TRANSITION_TABLE.meeting_attended).toContain('purchased');
      expect(LEAD_TRANSITION_TABLE.meeting_attended).toContain('follow_up_needed');
      expect(LEAD_TRANSITION_TABLE.meeting_attended).toContain('lost');
    });

    it('purchased can go to archived', () => {
      expect(LEAD_TRANSITION_TABLE.purchased).toContain('archived');
    });

    it('lost has no transitions (terminal)', () => {
      expect(LEAD_TRANSITION_TABLE.lost).toHaveLength(0);
    });

    it('archived has no transitions (terminal)', () => {
      expect(LEAD_TRANSITION_TABLE.archived).toHaveLength(0);
    });
  });

  describe('isValidLeadTransition', () => {
    it('allows new_lead -> contacted', () => {
      expect(isValidLeadTransition('new_lead', 'contacted')).toBe(true);
    });

    it('allows contacted -> meeting_booked', () => {
      expect(isValidLeadTransition('contacted', 'meeting_booked')).toBe(true);
    });

    it('allows meeting_booked -> meeting_attended', () => {
      expect(isValidLeadTransition('meeting_booked', 'meeting_attended')).toBe(true);
    });

    it('allows meeting_attended -> purchased', () => {
      expect(isValidLeadTransition('meeting_attended', 'purchased')).toBe(true);
    });

    it('blocks new_lead -> purchased', () => {
      expect(isValidLeadTransition('new_lead', 'purchased')).toBe(false);
    });

    it('blocks purchased -> non-archived statuses', () => {
      const nonArchivedStatuses = Object.keys(LEAD_TRANSITION_TABLE).filter(s => s !== 'archived') as LeadStatus[];
      for (const status of nonArchivedStatuses) {
        expect(isValidLeadTransition('purchased', status)).toBe(false);
      }
    });

    it('blocks lost -> anything', () => {
      const allStatuses = Object.keys(LEAD_TRANSITION_TABLE) as LeadStatus[];
      for (const status of allStatuses) {
        expect(isValidLeadTransition('lost', status)).toBe(false);
      }
    });
  });

  describe('validateLeadTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateLeadTransition('new_lead', 'contacted')).not.toThrow();
    });

    it('throws LeadTransitionError for invalid transition', () => {
      expect(() => validateLeadTransition('new_lead', 'purchased')).toThrow(LeadTransitionError);
    });

    it('error contains from and to statuses', () => {
      try {
        validateLeadTransition('new_lead', 'purchased');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LeadTransitionError);
        expect((err as LeadTransitionError).from).toBe('new_lead');
        expect((err as LeadTransitionError).to).toBe('purchased');
      }
    });
  });
});
