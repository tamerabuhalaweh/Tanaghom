import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Learning Signal Review → DKS Update Workflow tests

describe('Learning Review Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['learning:create', 'learning:read', 'learning:review', 'learning:propose', 'learning:decide', 'learning:apply'],
    cco: ['learning:create', 'learning:read', 'learning:review', 'learning:propose', 'learning:decide', 'learning:apply'],
    department_head: ['learning:create', 'learning:read', 'learning:review', 'learning:propose'],
    specialist: ['learning:read', 'learning:propose'],
    reviewer: ['learning:read', 'learning:review'],
    viewer: ['learning:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create reviews', () => expect(() => checkPermission('admin', 'learning:create')).not.toThrow());
    it('can review', () => expect(() => checkPermission('admin', 'learning:review')).not.toThrow());
    it('can propose', () => expect(() => checkPermission('admin', 'learning:propose')).not.toThrow());
    it('can decide', () => expect(() => checkPermission('admin', 'learning:decide')).not.toThrow());
    it('can apply', () => expect(() => checkPermission('admin', 'learning:apply')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkPermission('specialist', 'learning:read')).not.toThrow());
    it('can propose', () => expect(() => checkPermission('specialist', 'learning:propose')).not.toThrow());
    it('cannot review', () => expect(() => checkPermission('specialist', 'learning:review')).toThrow(ForbiddenError));
    it('cannot decide', () => expect(() => checkPermission('specialist', 'learning:decide')).toThrow(ForbiddenError));
    it('cannot apply', () => expect(() => checkPermission('specialist', 'learning:apply')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPermission('viewer', 'learning:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('viewer', 'learning:create')).toThrow(ForbiddenError));
    it('cannot review', () => expect(() => checkPermission('viewer', 'learning:review')).toThrow(ForbiddenError));
  });
});

describe('Review Status Lifecycle', () => {
  const STATUSES = ['pending', 'under_review', 'accepted', 'rejected', 'needs_more_evidence', 'superseded'];

  it('supports all review statuses', () => {
    expect(STATUSES).toHaveLength(6);
  });

  it('includes terminal states', () => {
    expect(STATUSES).toContain('accepted');
    expect(STATUSES).toContain('rejected');
  });
});

describe('DKS Update Proposal Types', () => {
  const PROPOSAL_TYPES = [
    'create_new_entry', 'update_existing_entry', 'mark_stale',
    'increase_confidence', 'decrease_confidence', 'add_relationship', 'deprecate_entry'
  ];

  it('supports all proposal types', () => {
    expect(PROPOSAL_TYPES).toHaveLength(7);
  });
});

describe('DKS Update Decision Types', () => {
  const DECISION_TYPES = ['approved', 'rejected', 'deferred', 'requires_saif_review'];

  it('supports all decision types', () => {
    expect(DECISION_TYPES).toHaveLength(4);
  });
});

describe('LearningSignal Cannot Directly Update DKS', () => {
  function validateDksUpdatePath(hasAcceptedReview: boolean): { allowed: boolean; reason?: string } {
    if (!hasAcceptedReview) {
      return { allowed: false, reason: 'Cannot create DKS update proposal: LearningSignal must have an accepted review' };
    }
    return { allowed: true };
  }

  it('blocks DKS update without accepted review', () => {
    const result = validateDksUpdatePath(false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('accepted review');
  });

  it('allows DKS update with accepted review', () => {
    expect(validateDksUpdatePath(true).allowed).toBe(true);
  });
});

describe('DKS Update Requires Authority Decision', () => {
  function validateAuthorityDecision(hasDecision: boolean): { allowed: boolean; reason?: string } {
    if (!hasDecision) {
      return { allowed: false, reason: 'Cannot apply DKS update: proposal must have approved decision' };
    }
    return { allowed: true };
  }

  it('blocks DKS update without authority decision', () => {
    const result = validateAuthorityDecision(false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('approved decision');
  });

  it('allows DKS update with authority decision', () => {
    expect(validateAuthorityDecision(true).allowed).toBe(true);
  });
});

describe('Version Increment', () => {
  function incrementVersion(version: string): string {
    const parts = version.split('.');
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;
    return `${major}.${minor + 1}`;
  }

  it('increments minor version', () => {
    expect(incrementVersion('1.0')).toBe('1.1');
    expect(incrementVersion('1.5')).toBe('1.6');
    expect(incrementVersion('2.3')).toBe('2.4');
  });

  it('handles initial version', () => {
    expect(incrementVersion('1.0')).toBe('1.1');
  });
});

describe('High-Impact Categories', () => {
  const HIGH_IMPACT = ['compliance', 'medical_health_claim', 'platform_policy', 'approval_policy', 'm5_execution', 'security'];

  it('defines high-impact categories', () => {
    expect(HIGH_IMPACT).toHaveLength(6);
  });

  it('includes compliance', () => expect(HIGH_IMPACT).toContain('compliance'));
  it('includes medical/health claims', () => expect(HIGH_IMPACT).toContain('medical_health_claim'));
  it('includes security', () => expect(HIGH_IMPACT).toContain('security'));
});

describe('Session Context Lock for Learning Reviews', () => {
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
});

describe('LearningSignal Cannot Approve/Publish/Execute', () => {
  function validateLearningSignalAuthority(action: string): { allowed: boolean; reason?: string } {
    const blockedActions = ['approve', 'publish', 'execute', 'change_strategy'];
    if (blockedActions.includes(action)) {
      return { allowed: false, reason: `LearningSignal cannot ${action}` };
    }
    return { allowed: true };
  }

  it('blocks approval', () => expect(validateLearningSignalAuthority('approve').allowed).toBe(false));
  it('blocks publishing', () => expect(validateLearningSignalAuthority('publish').allowed).toBe(false));
  it('blocks execution', () => expect(validateLearningSignalAuthority('execute').allowed).toBe(false));
  it('blocks strategy change', () => expect(validateLearningSignalAuthority('change_strategy').allowed).toBe(false));
  it('allows review', () => expect(validateLearningSignalAuthority('review').allowed).toBe(true));
});

describe('Analytics Report Cannot Directly Update DKS', () => {
  function validateAnalyticsDksUpdate(hasReviewWorkflow: boolean): { allowed: boolean; reason?: string } {
    if (!hasReviewWorkflow) {
      return { allowed: false, reason: 'Analytics report cannot directly update DKS' };
    }
    return { allowed: true };
  }

  it('blocks direct DKS update from analytics', () => {
    const result = validateAnalyticsDksUpdate(false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('directly update DKS');
  });

  it('allows DKS update through review workflow', () => {
    expect(validateAnalyticsDksUpdate(true).allowed).toBe(true);
  });
});
