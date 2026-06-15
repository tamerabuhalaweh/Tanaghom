import { describe, it, expect } from 'vitest';
import { ROUTING_RULES, CONTENT_TYPE_ROUTES, APPROVAL_SLA } from '../types';

describe('Approval Routing Rules', () => {
  describe('Risk-based routing', () => {
    it('low risk requires 1 approver', () => {
      expect(ROUTING_RULES.low).toHaveLength(1);
      expect(ROUTING_RULES.low[0].department).toBe('Acquisition');
      expect(ROUTING_RULES.low[0].required).toBe(true);
    });

    it('medium risk requires 2 approvers', () => {
      expect(ROUTING_RULES.medium).toHaveLength(2);
      const departments = ROUTING_RULES.medium.map((r) => r.department);
      expect(departments).toContain('Acquisition');
      expect(departments).toContain('Brand & Positioning');
    });

    it('high risk requires 3 approvers including CCO', () => {
      expect(ROUTING_RULES.high).toHaveLength(3);
      const departments = ROUTING_RULES.high.map((r) => r.department);
      expect(departments).toContain('CCO');
      expect(departments).toContain('Brand & Positioning');
      expect(departments).toContain('Acquisition');
    });

    it('high risk CCO approval is required', () => {
      const ccoRoute = ROUTING_RULES.high.find((r) => r.department === 'CCO');
      expect(ccoRoute).toBeDefined();
      expect(ccoRoute!.required).toBe(true);
      expect(ccoRoute!.role).toBe('cco');
    });
  });

  describe('Content type routing', () => {
    it('announcements require CCO approval', () => {
      const routes = CONTENT_TYPE_ROUTES.announcement;
      expect(routes).toBeDefined();
      const ccoRoute = routes.find((r) => r.department === 'CCO');
      expect(ccoRoute).toBeDefined();
      expect(ccoRoute!.required).toBe(true);
    });

    it('campaigns route to Conversion & Closing', () => {
      const routes = CONTENT_TYPE_ROUTES.campaign;
      expect(routes).toBeDefined();
      const conversionRoute = routes.find((r) => r.department === 'Conversion & Closing');
      expect(conversionRoute).toBeDefined();
      expect(conversionRoute!.required).toBe(true);
    });

    it('thought leadership routes to Brand & Positioning', () => {
      const routes = CONTENT_TYPE_ROUTES.thought_leadership;
      expect(routes).toBeDefined();
      const brandRoute = routes.find((r) => r.department === 'Brand & Positioning');
      expect(brandRoute).toBeDefined();
      expect(brandRoute!.required).toBe(true);
    });
  });

  describe('SLA Configuration', () => {
    it('reminder after 24 hours', () => {
      expect(APPROVAL_SLA.reminderHours).toBe(24);
    });

    it('escalation after 48 hours', () => {
      expect(APPROVAL_SLA.escalationHours).toBe(48);
    });

    it('critical after 72 hours', () => {
      expect(APPROVAL_SLA.criticalHours).toBe(72);
    });
  });
});
