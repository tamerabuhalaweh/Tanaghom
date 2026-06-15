import { describe, it, expect } from 'vitest';
import { APPROVAL_DECISIONS, RISK_CATEGORIES, APPROVAL_SLA } from '../types';
import { APPROVAL_EVENTS } from '../events';

describe('Approval Types and Constants', () => {
  describe('Approval Decisions', () => {
    it('defines three decision types', () => {
      expect(APPROVAL_DECISIONS).toHaveLength(3);
      expect(APPROVAL_DECISIONS).toContain('approved');
      expect(APPROVAL_DECISIONS).toContain('rejected');
      expect(APPROVAL_DECISIONS).toContain('needs_changes');
    });
  });

  describe('Risk Categories', () => {
    it('defines three risk levels', () => {
      expect(RISK_CATEGORIES).toHaveLength(3);
      expect(RISK_CATEGORIES).toContain('low');
      expect(RISK_CATEGORIES).toContain('medium');
      expect(RISK_CATEGORIES).toContain('high');
    });
  });

  describe('SLA Configuration', () => {
    it('reminder at 24 hours', () => {
      expect(APPROVAL_SLA.reminderHours).toBe(24);
    });

    it('escalation at 48 hours', () => {
      expect(APPROVAL_SLA.escalationHours).toBe(48);
    });

    it('critical at 72 hours', () => {
      expect(APPROVAL_SLA.criticalHours).toBe(72);
    });

    it('deadline warning at 24 hours', () => {
      expect(APPROVAL_SLA.deadlineWarningHours).toBe(24);
    });
  });

  describe('Approval Events', () => {
    it('defines all event types', () => {
      expect(APPROVAL_EVENTS.SUBMITTED_FOR_APPROVAL).toBe('approval.submitted');
      expect(APPROVAL_EVENTS.APPROVAL_DECISION_RECORDED).toBe('approval.decision_recordd');
      expect(APPROVAL_EVENTS.ALL_APPROVALS_COLLECTED).toBe('approval.all_collected');
      expect(APPROVAL_EVENTS.APPROVAL_REMINDER_SENT).toBe('approval.reminder_sent');
      expect(APPROVAL_EVENTS.APPROVAL_ESCALATED).toBe('approval.escalated');
      expect(APPROVAL_EVENTS.APPROVAL_EXPIRED).toBe('approval.expired');
    });
  });
});
