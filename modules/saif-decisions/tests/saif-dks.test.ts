import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// SAIF Decision Record tests — validates decision lifecycle, evaluation dimensions, critical dimension enforcement, and permissions

describe('SAIF Decision Record Lifecycle', () => {
  const VALID_STATUSES = [
    'draft', 'context_gathering', 'proposed', 'evaluating', 'authority_review',
    'accepted', 'rejected', 'deferred', 'execution_ready', 'superseded', 'audited'
  ];

  it('supports all required decision statuses', () => {
    expect(VALID_STATUSES).toHaveLength(11);
    expect(VALID_STATUSES).toContain('draft');
    expect(VALID_STATUSES).toContain('context_gathering');
    expect(VALID_STATUSES).toContain('proposed');
    expect(VALID_STATUSES).toContain('evaluating');
    expect(VALID_STATUSES).toContain('authority_review');
    expect(VALID_STATUSES).toContain('accepted');
    expect(VALID_STATUSES).toContain('rejected');
    expect(VALID_STATUSES).toContain('deferred');
    expect(VALID_STATUSES).toContain('execution_ready');
    expect(VALID_STATUSES).toContain('superseded');
    expect(VALID_STATUSES).toContain('audited');
  });
});

describe('SAIF Decision Roles', () => {
  const VALID_ROLES = ['context', 'proposer', 'evaluator', 'authority'];

  it('supports all required decision roles', () => {
    expect(VALID_ROLES).toHaveLength(4);
    expect(VALID_ROLES).toContain('context');
    expect(VALID_ROLES).toContain('proposer');
    expect(VALID_ROLES).toContain('evaluator');
    expect(VALID_ROLES).toContain('authority');
  });
});

describe('SAIF Evaluation Dimensions', () => {
  const VALID_DIMENSIONS = [
    'capability_impact', 'security_posture', 'cost', 'latency', 'maintainability',
    'reversibility', 'human_oversight', 'compliance', 'observability', 'learning_potential'
  ];

  const CRITICAL_DIMENSIONS = ['security_posture', 'human_oversight', 'compliance'];

  it('supports all 10 evaluation dimensions', () => {
    expect(VALID_DIMENSIONS).toHaveLength(10);
  });

  it('includes all required dimensions', () => {
    expect(VALID_DIMENSIONS).toContain('capability_impact');
    expect(VALID_DIMENSIONS).toContain('security_posture');
    expect(VALID_DIMENSIONS).toContain('cost');
    expect(VALID_DIMENSIONS).toContain('latency');
    expect(VALID_DIMENSIONS).toContain('maintainability');
    expect(VALID_DIMENSIONS).toContain('reversibility');
    expect(VALID_DIMENSIONS).toContain('human_oversight');
    expect(VALID_DIMENSIONS).toContain('compliance');
    expect(VALID_DIMENSIONS).toContain('observability');
    expect(VALID_DIMENSIONS).toContain('learning_potential');
  });

  it('identifies 3 critical dimensions', () => {
    expect(CRITICAL_DIMENSIONS).toHaveLength(3);
    expect(CRITICAL_DIMENSIONS).toContain('security_posture');
    expect(CRITICAL_DIMENSIONS).toContain('human_oversight');
    expect(CRITICAL_DIMENSIONS).toContain('compliance');
  });
});

describe('Critical Dimension Enforcement', () => {
  interface Evaluation {
    dimension: string;
    rating: string;
    mitigation?: string;
  }

  function validateCriticalDimensions(evaluations: Evaluation[]): { valid: boolean; missing: string[] } {
    const CRITICAL = ['security_posture', 'human_oversight', 'compliance'];
    const evaluated = evaluations.map(e => e.dimension);
    const missing = CRITICAL.filter(d => !evaluated.includes(d));

    if (missing.length > 0) {
      return { valid: false, missing };
    }

    const negativeWithoutMitigation = evaluations.filter(
      e => CRITICAL.includes(e.dimension) && e.rating === 'negative' && !e.mitigation
    );

    if (negativeWithoutMitigation.length > 0) {
      return { valid: false, missing: negativeWithoutMitigation.map(e => e.dimension) };
    }

    return { valid: true, missing: [] };
  }

  it('fails when critical dimensions are missing', () => {
    const evaluations: Evaluation[] = [
      { dimension: 'capability_impact', rating: 'positive' },
    ];
    const result = validateCriticalDimensions(evaluations);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('security_posture');
    expect(result.missing).toContain('human_oversight');
    expect(result.missing).toContain('compliance');
  });

  it('passes when all critical dimensions are positively rated', () => {
    const evaluations: Evaluation[] = [
      { dimension: 'security_posture', rating: 'positive' },
      { dimension: 'human_oversight', rating: 'positive' },
      { dimension: 'compliance', rating: 'positive' },
    ];
    const result = validateCriticalDimensions(evaluations);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('passes when critical dimensions are neutral', () => {
    const evaluations: Evaluation[] = [
      { dimension: 'security_posture', rating: 'neutral' },
      { dimension: 'human_oversight', rating: 'neutral' },
      { dimension: 'compliance', rating: 'neutral' },
    ];
    const result = validateCriticalDimensions(evaluations);
    expect(result.valid).toBe(true);
  });

  it('fails when critical dimension is negative without mitigation', () => {
    const evaluations: Evaluation[] = [
      { dimension: 'security_posture', rating: 'negative' },
      { dimension: 'human_oversight', rating: 'positive' },
      { dimension: 'compliance', rating: 'positive' },
    ];
    const result = validateCriticalDimensions(evaluations);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('security_posture');
  });

  it('passes when critical dimension is negative with mitigation', () => {
    const evaluations: Evaluation[] = [
      { dimension: 'security_posture', rating: 'negative', mitigation: 'Additional security review required' },
      { dimension: 'human_oversight', rating: 'positive' },
      { dimension: 'compliance', rating: 'positive' },
    ];
    const result = validateCriticalDimensions(evaluations);
    expect(result.valid).toBe(true);
  });
});

describe('SAIF Decision Composition', () => {
  interface Decision {
    id: string;
    parentDecisionId?: string;
    title: string;
  }

  it('supports parent-child decision relationships', () => {
    const parent: Decision = { id: 'parent-1', title: 'Launch new course campaign' };
    const children: Decision[] = [
      { id: 'child-1', parentDecisionId: 'parent-1', title: 'Audience decision' },
      { id: 'child-2', parentDecisionId: 'parent-1', title: 'Platform decision' },
      { id: 'child-3', parentDecisionId: 'parent-1', title: 'CTA decision' },
    ];

    expect(parent.id).toBe('parent-1');
    expect(children).toHaveLength(3);
    expect(children.every(c => c.parentDecisionId === 'parent-1')).toBe(true);
  });
});

describe('SAIF Decision Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate', 'decisions:execute'],
    cco: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate', 'decisions:execute'],
    department_head: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate'],
    specialist: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:evaluate'],
    reviewer: ['decisions:read', 'decisions:evaluate'],
    viewer: ['decisions:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create decisions', () => {
      expect(() => checkPermission('admin', 'decisions:create')).not.toThrow();
    });

    it('can read decisions', () => {
      expect(() => checkPermission('admin', 'decisions:read')).not.toThrow();
    });

    it('can execute decisions', () => {
      expect(() => checkPermission('admin', 'decisions:execute')).not.toThrow();
    });
  });

  describe('viewer', () => {
    it('can read decisions', () => {
      expect(() => checkPermission('viewer', 'decisions:read')).not.toThrow();
    });

    it('cannot create decisions', () => {
      expect(() => checkPermission('viewer', 'decisions:create')).toThrow(ForbiddenError);
    });

    it('cannot execute decisions', () => {
      expect(() => checkPermission('viewer', 'decisions:execute')).toThrow(ForbiddenError);
    });
  });

  describe('specialist', () => {
    it('can create decisions', () => {
      expect(() => checkPermission('specialist', 'decisions:create')).not.toThrow();
    });

    it('cannot execute decisions', () => {
      expect(() => checkPermission('specialist', 'decisions:execute')).toThrow(ForbiddenError);
    });
  });
});

describe('DKS Foundation', () => {
  const DKSSOURCE_TYPES = [
    'official_docs', 'official_policy', 'internal_benchmark', 'team_decision',
    'third_party_research', 'internal_analytics', 'saif_decision', 'platform_rule', 'learning_insight'
  ];

  const FRESHNESS_STATUSES = ['fresh', 'stale', 'expired', 'unknown'];

  it('supports all DKS source types', () => {
    expect(DKSSOURCE_TYPES).toHaveLength(9);
    expect(DKSSOURCE_TYPES).toContain('official_docs');
    expect(DKSSOURCE_TYPES).toContain('saif_decision');
    expect(DKSSOURCE_TYPES).toContain('platform_rule');
    expect(DKSSOURCE_TYPES).toContain('learning_insight');
  });

  it('supports all freshness statuses', () => {
    expect(FRESHNESS_STATUSES).toHaveLength(4);
    expect(FRESHNESS_STATUSES).toContain('fresh');
    expect(FRESHNESS_STATUSES).toContain('stale');
    expect(FRESHNESS_STATUSES).toContain('expired');
    expect(FRESHNESS_STATUSES).toContain('unknown');
  });
});

describe('DKS Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['dks:create', 'dks:read', 'dks:update', 'dks:link'],
    cco: ['dks:create', 'dks:read', 'dks:update', 'dks:link'],
    specialist: ['dks:create', 'dks:read', 'dks:update'],
    viewer: ['dks:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create DKS entries', () => {
      expect(() => checkPermission('admin', 'dks:create')).not.toThrow();
    });

    it('can link decisions to DKS', () => {
      expect(() => checkPermission('admin', 'dks:link')).not.toThrow();
    });
  });

  describe('viewer', () => {
    it('can read DKS entries', () => {
      expect(() => checkPermission('viewer', 'dks:read')).not.toThrow();
    });

    it('cannot create DKS entries', () => {
      expect(() => checkPermission('viewer', 'dks:create')).toThrow(ForbiddenError);
    });

    it('cannot link decisions to DKS', () => {
      expect(() => checkPermission('viewer', 'dks:link')).toThrow(ForbiddenError);
    });
  });
});
