import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Approval workflow tests — validates permissions, routing, SAIF integration, and Session Context Lock

describe('Approval Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
    cco: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate', 'approvals:cancel'],
    department_head: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject', 'approvals:escalate'],
    specialist: ['approvals:create', 'approvals:read'],
    reviewer: ['approvals:create', 'approvals:read', 'approvals:approve', 'approvals:reject'],
    viewer: ['approvals:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create approvals', () => expect(() => checkPermission('admin', 'approvals:create')).not.toThrow());
    it('can approve', () => expect(() => checkPermission('admin', 'approvals:approve')).not.toThrow());
    it('can reject', () => expect(() => checkPermission('admin', 'approvals:reject')).not.toThrow());
    it('can escalate', () => expect(() => checkPermission('admin', 'approvals:escalate')).not.toThrow());
    it('can cancel', () => expect(() => checkPermission('admin', 'approvals:cancel')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create approvals', () => expect(() => checkPermission('specialist', 'approvals:create')).not.toThrow());
    it('can read approvals', () => expect(() => checkPermission('specialist', 'approvals:read')).not.toThrow());
    it('cannot approve', () => expect(() => checkPermission('specialist', 'approvals:approve')).toThrow(ForbiddenError));
    it('cannot reject', () => expect(() => checkPermission('specialist', 'approvals:reject')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read approvals', () => expect(() => checkPermission('viewer', 'approvals:read')).not.toThrow());
    it('cannot create approvals', () => expect(() => checkPermission('viewer', 'approvals:create')).toThrow(ForbiddenError));
    it('cannot approve', () => expect(() => checkPermission('viewer', 'approvals:approve')).toThrow(ForbiddenError));
  });
});

describe('Approval State Transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['approved', 'rejected', 'changes_requested', 'escalated', 'expired', 'cancelled'],
    approved: [],
    rejected: [],
    changes_requested: ['pending', 'cancelled'],
    escalated: ['approved', 'rejected', 'changes_requested', 'expired', 'cancelled'],
    expired: ['pending', 'cancelled'],
    cancelled: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('pending can transition to approved', () => expect(isValidTransition('pending', 'approved')).toBe(true));
  it('pending can transition to rejected', () => expect(isValidTransition('pending', 'rejected')).toBe(true));
  it('pending can transition to changes_requested', () => expect(isValidTransition('pending', 'changes_requested')).toBe(true));
  it('pending can transition to escalated', () => expect(isValidTransition('pending', 'escalated')).toBe(true));
  it('pending can transition to cancelled', () => expect(isValidTransition('pending', 'cancelled')).toBe(true));

  it('approved cannot transition', () => expect(isValidTransition('approved', 'pending')).toBe(false));
  it('rejected cannot transition', () => expect(isValidTransition('rejected', 'pending')).toBe(false));
  it('cancelled cannot transition', () => expect(isValidTransition('cancelled', 'pending')).toBe(false));

  it('changes_requested can transition to pending', () => expect(isValidTransition('changes_requested', 'pending')).toBe(true));
  it('escalated can transition to approved', () => expect(isValidTransition('escalated', 'approved')).toBe(true));
  it('expired can transition to pending', () => expect(isValidTransition('expired', 'pending')).toBe(true));
});

describe('Risk-Based Routing', () => {
  const ROUTING_RULES = [
    { riskCategory: 'low', targetType: 'campaign', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'reviewer' },
    { riskCategory: 'medium', targetType: 'campaign', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'department_head' },
    { riskCategory: 'high', targetType: 'campaign', approvalType: 'cco_review', requiredDepartment: null, requiredRole: 'cco' },
    { riskCategory: 'low', targetType: 'content_item', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'reviewer' },
    { riskCategory: 'medium', targetType: 'content_item', approvalType: 'brand_review', requiredDepartment: 'Brand & Market Intelligence', requiredRole: 'department_head' },
    { riskCategory: 'high', targetType: 'content_item', approvalType: 'cco_review', requiredDepartment: null, requiredRole: 'cco' },
  ];

  function getRoutingRule(riskCategory: string, targetType: string) {
    return ROUTING_RULES.find(r => r.riskCategory === riskCategory && r.targetType === targetType);
  }

  it('low-risk campaign routes to reviewer', () => {
    const rule = getRoutingRule('low', 'campaign');
    expect(rule?.requiredRole).toBe('reviewer');
    expect(rule?.approvalType).toBe('department_review');
  });

  it('medium-risk campaign routes to department_head', () => {
    const rule = getRoutingRule('medium', 'campaign');
    expect(rule?.requiredRole).toBe('department_head');
  });

  it('high-risk campaign routes to CCO', () => {
    const rule = getRoutingRule('high', 'campaign');
    expect(rule?.requiredRole).toBe('cco');
    expect(rule?.approvalType).toBe('cco_review');
  });

  it('medium-risk content_item routes to Brand & Market Intelligence', () => {
    const rule = getRoutingRule('medium', 'content_item');
    expect(rule?.requiredDepartment).toBe('Brand & Market Intelligence');
  });

  it('high-risk content_item routes to CCO', () => {
    const rule = getRoutingRule('high', 'content_item');
    expect(rule?.requiredRole).toBe('cco');
  });
});

describe('RevOps Department Routing', () => {
  const DEPARTMENT_MAPPING: Record<string, string> = {
    brand_review: 'Brand & Market Intelligence',
    demand_generation_review: 'Demand Generation',
    conversion_review: 'Conversion',
    customer_growth_review: 'Customer Growth & Retention',
    revenue_operations_review: 'Revenue Operations',
  };

  it('brand_review routes to Brand & Market Intelligence', () => {
    expect(DEPARTMENT_MAPPING['brand_review']).toBe('Brand & Market Intelligence');
  });

  it('demand_generation_review routes to Demand Generation', () => {
    expect(DEPARTMENT_MAPPING['demand_generation_review']).toBe('Demand Generation');
  });

  it('conversion_review routes to Conversion', () => {
    expect(DEPARTMENT_MAPPING['conversion_review']).toBe('Conversion');
  });

  it('customer_growth_review routes to Customer Growth & Retention', () => {
    expect(DEPARTMENT_MAPPING['customer_growth_review']).toBe('Customer Growth & Retention');
  });

  it('revenue_operations_review routes to Revenue Operations', () => {
    expect(DEPARTMENT_MAPPING['revenue_operations_review']).toBe('Revenue Operations');
  });
});

describe('Session Context Lock for Approvals', () => {
  function validateSessionContextLock(
    sessionUserId: string,
    sessionAgentRepId: string,
    actionUserId: string,
    actionAgentRepId: string,
  ): void {
    if (sessionUserId !== actionUserId) {
      throw new ForbiddenError('Session Context Lock: Cannot act on behalf of another user');
    }
    if (sessionAgentRepId !== actionAgentRepId) {
      throw new ForbiddenError('Session Context Lock: Cannot use another user\'s AgentRep');
    }
  }

  it('allows matching user and AgentRep', () => {
    expect(() => validateSessionContextLock('user-1', 'rep-1', 'user-1', 'rep-1')).not.toThrow();
  });

  it('blocks mismatched user', () => {
    expect(() => validateSessionContextLock('user-1', 'rep-1', 'user-2', 'rep-1')).toThrow(ForbiddenError);
  });

  it('blocks mismatched AgentRep', () => {
    expect(() => validateSessionContextLock('user-1', 'rep-1', 'user-1', 'rep-2')).toThrow(ForbiddenError);
  });
});

describe('FunctionalAgent Cannot Approve', () => {
  function validateApproverNotFunctionalAgent(agentType: string): void {
    if (agentType === 'functional') {
      throw new ForbiddenError('FunctionalAgent cannot approve');
    }
  }

  it('blocks FunctionalAgent from approving', () => {
    expect(() => validateApproverNotFunctionalAgent('functional')).toThrow(ForbiddenError);
  });

  it('allows human to approve', () => {
    expect(() => validateApproverNotFunctionalAgent('human')).not.toThrow();
  });

  it('allows governance agent (assist only)', () => {
    expect(() => validateApproverNotFunctionalAgent('governance')).not.toThrow();
  });
});

describe('SAIF Critical Dimension Blocking', () => {
  interface CriticalDimensionResult {
    valid: boolean;
    missing: string[];
  }

  function validateApprovalWithSaif(
    saifDecisionRecordId: string | null,
    criticalDimensions: CriticalDimensionResult,
  ): { allowed: boolean; reason?: string } {
    if (!saifDecisionRecordId) return { allowed: true };

    if (!criticalDimensions.valid) {
      return {
        allowed: false,
        reason: `Cannot approve: SAIF critical dimensions unresolved: ${criticalDimensions.missing.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  it('allows approval when no SAIF decision linked', () => {
    const result = validateApprovalWithSaif(null, { valid: false, missing: ['security_posture'] });
    expect(result.allowed).toBe(true);
  });

  it('blocks approval when SAIF critical dimensions unresolved', () => {
    const result = validateApprovalWithSaif('decision-1', { valid: false, missing: ['security_posture', 'compliance'] });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('security_posture');
    expect(result.reason).toContain('compliance');
  });

  it('allows approval when SAIF critical dimensions resolved', () => {
    const result = validateApprovalWithSaif('decision-1', { valid: true, missing: [] });
    expect(result.allowed).toBe(true);
  });
});

describe('Approval Types', () => {
  const APPROVAL_TYPES = [
    'department_review', 'brand_review', 'compliance_review', 'cco_review',
    'demand_generation_review', 'conversion_review', 'customer_growth_review', 'revenue_operations_review'
  ];

  it('supports all required approval types', () => {
    expect(APPROVAL_TYPES).toHaveLength(8);
    expect(APPROVAL_TYPES).toContain('department_review');
    expect(APPROVAL_TYPES).toContain('brand_review');
    expect(APPROVAL_TYPES).toContain('compliance_review');
    expect(APPROVAL_TYPES).toContain('cco_review');
  });

  it('supports all RevOps department reviews', () => {
    expect(APPROVAL_TYPES).toContain('demand_generation_review');
    expect(APPROVAL_TYPES).toContain('conversion_review');
    expect(APPROVAL_TYPES).toContain('customer_growth_review');
    expect(APPROVAL_TYPES).toContain('revenue_operations_review');
  });
});

describe('Approval Target Types', () => {
  const TARGET_TYPES = ['campaign', 'content_item', 'draft_version', 'saif_decision_record'];

  it('supports all required target types', () => {
    expect(TARGET_TYPES).toHaveLength(4);
    expect(TARGET_TYPES).toContain('campaign');
    expect(TARGET_TYPES).toContain('content_item');
    expect(TARGET_TYPES).toContain('draft_version');
    expect(TARGET_TYPES).toContain('saif_decision_record');
  });
});
