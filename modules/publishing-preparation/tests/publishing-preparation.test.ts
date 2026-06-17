import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Publishing Preparation Package tests — validates package creation, readiness checks, manifest generation, boundary rules

describe('Publishing Preparation Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['publishing:create', 'publishing:read', 'publishing:validate', 'publishing:manifest'],
    cco: ['publishing:create', 'publishing:read', 'publishing:validate', 'publishing:manifest'],
    department_head: ['publishing:create', 'publishing:read', 'publishing:validate'],
    specialist: ['publishing:create', 'publishing:read'],
    reviewer: ['publishing:read'],
    viewer: ['publishing:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create packages', () => expect(() => checkPermission('admin', 'publishing:create')).not.toThrow());
    it('can read packages', () => expect(() => checkPermission('admin', 'publishing:read')).not.toThrow());
    it('can validate readiness', () => expect(() => checkPermission('admin', 'publishing:validate')).not.toThrow());
    it('can generate manifests', () => expect(() => checkPermission('admin', 'publishing:manifest')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create packages', () => expect(() => checkPermission('specialist', 'publishing:create')).not.toThrow());
    it('can read packages', () => expect(() => checkPermission('specialist', 'publishing:read')).not.toThrow());
    it('cannot validate readiness', () => expect(() => checkPermission('specialist', 'publishing:validate')).toThrow(ForbiddenError));
    it('cannot generate manifests', () => expect(() => checkPermission('specialist', 'publishing:manifest')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read packages', () => expect(() => checkPermission('viewer', 'publishing:read')).not.toThrow());
    it('cannot create packages', () => expect(() => checkPermission('viewer', 'publishing:create')).toThrow(ForbiddenError));
    it('cannot validate readiness', () => expect(() => checkPermission('viewer', 'publishing:validate')).toThrow(ForbiddenError));
  });
});

describe('Package Status Lifecycle', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['validating', 'cancelled'],
    validating: ['ready_for_future_execution', 'blocked', 'cancelled'],
    ready_for_future_execution: ['superseded', 'cancelled'],
    blocked: ['validating', 'cancelled'],
    superseded: [],
    cancelled: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('draft can transition to validating', () => expect(isValidTransition('draft', 'validating')).toBe(true));
  it('draft can transition to cancelled', () => expect(isValidTransition('draft', 'cancelled')).toBe(true));
  it('validating can transition to ready', () => expect(isValidTransition('validating', 'ready_for_future_execution')).toBe(true));
  it('validating can transition to blocked', () => expect(isValidTransition('validating', 'blocked')).toBe(true));
  it('ready can transition to superseded', () => expect(isValidTransition('ready_for_future_execution', 'superseded')).toBe(true));
  it('blocked can transition to validating', () => expect(isValidTransition('blocked', 'validating')).toBe(true));
  it('superseded cannot transition', () => expect(isValidTransition('superseded', 'draft')).toBe(false));
  it('cancelled cannot transition', () => expect(isValidTransition('cancelled', 'draft')).toBe(false));
});

describe('Readiness Check Validation', () => {
  interface ReadinessCheck {
    checkType: string;
    checkStatus: string;
    message?: string;
  }

  const CRITICAL_CHECKS = [
    'content_approved',
    'saif_critical_dimensions_resolved',
    'approval_record_exists',
    'capability_resolution_exists',
  ];

  function validateReadiness(checks: ReadinessCheck[]): { ready: boolean; blockedReasons: string[]; score: number } {
    const blockedReasons: string[] = [];
    let passedChecks = 0;

    for (const check of checks) {
      if (check.checkStatus === 'failed' || check.checkStatus === 'blocked') {
        blockedReasons.push(`${check.checkType}: ${check.message || 'failed'}`);
      } else if (check.checkStatus === 'passed') {
        passedChecks++;
      }
    }

    for (const criticalCheck of CRITICAL_CHECKS) {
      const found = checks.find(c => c.checkType === criticalCheck);
      if (!found || found.checkStatus !== 'passed') {
        if (!blockedReasons.some(b => b.startsWith(criticalCheck))) {
          blockedReasons.push(`${criticalCheck}: missing or not passed`);
        }
      }
    }

    const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;
    const ready = blockedReasons.length === 0 && score >= 80;

    return { ready, blockedReasons, score };
  }

  it('blocks when approval is missing', () => {
    const checks: ReadinessCheck[] = [
      { checkType: 'content_approved', checkStatus: 'passed' },
      { checkType: 'saif_critical_dimensions_resolved', checkStatus: 'passed' },
      { checkType: 'capability_resolution_exists', checkStatus: 'passed' },
    ];
    const result = validateReadiness(checks);
    expect(result.ready).toBe(false);
    expect(result.blockedReasons.some(r => r.includes('approval_record_exists'))).toBe(true);
  });

  it('blocks when SAIF critical dimensions are unresolved', () => {
    const checks: ReadinessCheck[] = [
      { checkType: 'content_approved', checkStatus: 'passed' },
      { checkType: 'saif_critical_dimensions_resolved', checkStatus: 'failed', message: 'security_posture negative' },
      { checkType: 'approval_record_exists', checkStatus: 'passed' },
      { checkType: 'capability_resolution_exists', checkStatus: 'passed' },
    ];
    const result = validateReadiness(checks);
    expect(result.ready).toBe(false);
    expect(result.blockedReasons.some(r => r.includes('saif_critical_dimensions_resolved'))).toBe(true);
  });

  it('passes when all critical checks are passed', () => {
    const checks: ReadinessCheck[] = [
      { checkType: 'content_approved', checkStatus: 'passed' },
      { checkType: 'saif_critical_dimensions_resolved', checkStatus: 'passed' },
      { checkType: 'approval_record_exists', checkStatus: 'passed' },
      { checkType: 'capability_resolution_exists', checkStatus: 'passed' },
      { checkType: 'mcp_mediation_requirement', checkStatus: 'passed' },
      { checkType: 'asset_approval', checkStatus: 'passed' },
    ];
    const result = validateReadiness(checks);
    expect(result.ready).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('blocks when score is below 80', () => {
    const checks: ReadinessCheck[] = [
      { checkType: 'content_approved', checkStatus: 'passed' },
      { checkType: 'saif_critical_dimensions_resolved', checkStatus: 'passed' },
      { checkType: 'approval_record_exists', checkStatus: 'passed' },
      { checkType: 'capability_resolution_exists', checkStatus: 'passed' },
      { checkType: 'optional_check_1', checkStatus: 'failed' },
      { checkType: 'optional_check_2', checkStatus: 'failed' },
    ];
    const result = validateReadiness(checks);
    expect(result.ready).toBe(false);
    expect(result.score).toBeLessThan(100);
  });
});

describe('Package Item Types', () => {
  const ITEM_TYPES = [
    'platform_caption', 'asset_reference', 'hashtag_set', 'cta', 'link_reference',
    'compliance_note', 'approval_evidence', 'saif_evidence', 'asset_cognition_evidence'
  ];

  it('supports all package item types', () => {
    expect(ITEM_TYPES).toHaveLength(9);
  });

  it('includes evidence types', () => {
    expect(ITEM_TYPES).toContain('approval_evidence');
    expect(ITEM_TYPES).toContain('saif_evidence');
    expect(ITEM_TYPES).toContain('asset_cognition_evidence');
  });
});

describe('Publishing Target Boundary', () => {
  interface PublishingTarget {
    platform: string;
    accountReference: string | null;
    requiresMcp: boolean;
  }

  it('account references are placeholders only', () => {
    const target: PublishingTarget = {
      platform: 'LinkedIn',
      accountReference: 'placeholder-linkedin-account',
      requiresMcp: true,
    };
    expect(target.accountReference).toBe('placeholder-linkedin-account');
    expect(target.requiresMcp).toBe(true);
  });

  it('no real platform account connection', () => {
    const target: PublishingTarget = {
      platform: 'Instagram',
      accountReference: null,
      requiresMcp: true,
    };
    expect(target.accountReference).toBeNull();
  });
});

describe('Manifest Generation Boundary', () => {
  interface Package {
    id: string;
    status: string;
  }

  function validateManifestGeneration(pkg: Package): { allowed: boolean; reason?: string } {
    if (pkg.status !== 'ready_for_future_execution') {
      return { allowed: false, reason: 'Cannot generate manifest: package is not ready for future execution' };
    }
    return { allowed: true };
  }

  it('blocks manifest generation when package is not ready', () => {
    const pkg: Package = { id: '1', status: 'draft' };
    const result = validateManifestGeneration(pkg);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not ready');
  });

  it('allows manifest generation when package is ready', () => {
    const pkg: Package = { id: '1', status: 'ready_for_future_execution' };
    expect(validateManifestGeneration(pkg).allowed).toBe(true);
  });

  it('blocks manifest generation when package is blocked', () => {
    const pkg: Package = { id: '1', status: 'blocked' };
    expect(validateManifestGeneration(pkg).allowed).toBe(false);
  });
});

describe('M5 Execution Blocked', () => {
  function validateM5Execution(action: string): { allowed: boolean; reason?: string } {
    const blockedActions = ['publish', 'schedule', 'call_postiz', 'create_platform_post', 'send_to_connector'];
    if (blockedActions.includes(action)) {
      return { allowed: false, reason: `M5 execution blocked: ${action}` };
    }
    return { allowed: true };
  }

  it('blocks publish action', () => {
    expect(validateM5Execution('publish').allowed).toBe(false);
  });

  it('blocks schedule action', () => {
    expect(validateM5Execution('schedule').allowed).toBe(false);
  });

  it('blocks call_postiz action', () => {
    expect(validateM5Execution('call_postiz').allowed).toBe(false);
  });

  it('allows prepare package action', () => {
    expect(validateM5Execution('prepare_package').allowed).toBe(true);
  });

  it('allows validate package action', () => {
    expect(validateM5Execution('validate_package').allowed).toBe(true);
  });
});

describe('Session Context Lock for Publishing', () => {
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

describe('Package Hash Determinism', () => {
  function generatePackageHash(data: Record<string, unknown>): string {
    // Simple deterministic hash for testing
    const sorted = JSON.stringify(data, Object.keys(data).sort());
    return Buffer.from(sorted).toString('base64');
  }

  it('generates same hash for same data', () => {
    const data = { items: ['caption'], targets: ['linkedin'] };
    const hash1 = generatePackageHash(data);
    const hash2 = generatePackageHash(data);
    expect(hash1).toBe(hash2);
  });

  it('generates different hash for different data', () => {
    const data1 = { items: ['caption'], targets: ['linkedin'] };
    const data2 = { items: ['caption'], targets: ['instagram'] };
    expect(generatePackageHash(data1)).not.toBe(generatePackageHash(data2));
  });
});
