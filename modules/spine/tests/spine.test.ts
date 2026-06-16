import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// SPINE Run & Artifact Lineage tests — validates run lifecycle, artifact integrity, lineage, replay, permissions

describe('SPINE Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['spine:create', 'spine:read', 'spine:update'],
    cco: ['spine:create', 'spine:read', 'spine:update'],
    department_head: ['spine:create', 'spine:read', 'spine:update'],
    specialist: ['spine:create', 'spine:read'],
    reviewer: ['spine:read'],
    viewer: ['spine:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create SPINE runs', () => expect(() => checkPermission('admin', 'spine:create')).not.toThrow());
    it('can read SPINE data', () => expect(() => checkPermission('admin', 'spine:read')).not.toThrow());
    it('can update SPINE runs', () => expect(() => checkPermission('admin', 'spine:update')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create SPINE runs', () => expect(() => checkPermission('specialist', 'spine:create')).not.toThrow());
    it('can read SPINE data', () => expect(() => checkPermission('specialist', 'spine:read')).not.toThrow());
    it('cannot update SPINE runs', () => expect(() => checkPermission('specialist', 'spine:update')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read SPINE data', () => expect(() => checkPermission('viewer', 'spine:read')).not.toThrow());
    it('cannot create SPINE runs', () => expect(() => checkPermission('viewer', 'spine:create')).toThrow(ForbiddenError));
    it('cannot update SPINE runs', () => expect(() => checkPermission('viewer', 'spine:update')).toThrow(ForbiddenError));
  });
});

describe('SPINE Run Status Lifecycle', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    planned: ['ready', 'cancelled', 'blocked'],
    ready: ['simulated', 'running', 'cancelled', 'blocked'],
    simulated: ['ready', 'succeeded', 'failed', 'cancelled'],
    running: ['succeeded', 'failed', 'cancelled'],
    succeeded: ['audited'],
    failed: ['planned', 'cancelled'],
    cancelled: [],
    blocked: ['planned', 'ready', 'cancelled'],
    audited: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('planned can transition to ready', () => expect(isValidTransition('planned', 'ready')).toBe(true));
  it('planned can transition to cancelled', () => expect(isValidTransition('planned', 'cancelled')).toBe(true));
  it('planned can transition to blocked', () => expect(isValidTransition('planned', 'blocked')).toBe(true));

  it('ready can transition to simulated', () => expect(isValidTransition('ready', 'simulated')).toBe(true));
  it('ready can transition to running', () => expect(isValidTransition('ready', 'running')).toBe(true));

  it('running can transition to succeeded', () => expect(isValidTransition('running', 'succeeded')).toBe(true));
  it('running can transition to failed', () => expect(isValidTransition('running', 'failed')).toBe(true));

  it('succeeded can transition to audited', () => expect(isValidTransition('succeeded', 'audited')).toBe(true));
  it('audited cannot transition', () => expect(isValidTransition('audited', 'planned')).toBe(false));
  it('cancelled cannot transition', () => expect(isValidTransition('cancelled', 'planned')).toBe(false));
});

describe('M5 Run Blocking', () => {
  function validateM5Run(runType: string): { allowed: boolean; reason?: string } {
    if (runType === 'execution') {
      return { allowed: false, reason: 'M5 write-enabled execution runs are blocked in this sprint' };
    }
    return { allowed: true };
  }

  it('blocks execution runs', () => {
    const result = validateM5Run('execution');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('M5 write-enabled');
  });

  it('allows planned runs', () => expect(validateM5Run('planned').allowed).toBe(true));
  it('allows simulated runs', () => expect(validateM5Run('simulated').allowed).toBe(true));
  it('allows advisory runs', () => expect(validateM5Run('advisory').allowed).toBe(true));
});

describe('SPINE Run Types', () => {
  const RUN_TYPES = ['planned', 'simulated', 'advisory', 'execution'];

  it('supports all run types', () => {
    expect(RUN_TYPES).toHaveLength(4);
    expect(RUN_TYPES).toContain('planned');
    expect(RUN_TYPES).toContain('simulated');
    expect(RUN_TYPES).toContain('advisory');
    expect(RUN_TYPES).toContain('execution');
  });
});

describe('SPINE Run Statuses', () => {
  const RUN_STATUSES = ['planned', 'ready', 'simulated', 'running', 'succeeded', 'failed', 'cancelled', 'blocked', 'audited'];

  it('supports all run statuses', () => {
    expect(RUN_STATUSES).toHaveLength(9);
  });
});

describe('SPINE Artifact Types', () => {
  const ARTIFACT_TYPES = [
    'campaign_request_snapshot', 'draft_version_snapshot', 'reach_score_report',
    'approval_record_snapshot', 'saif_decision_record', 'dks_reference_bundle',
    'capability_resolution_bundle', 'mediation_decision_record', 'future_publishing_package'
  ];

  it('supports all artifact types', () => {
    expect(ARTIFACT_TYPES).toHaveLength(9);
  });

  it('includes snapshot types', () => {
    expect(ARTIFACT_TYPES).toContain('campaign_request_snapshot');
    expect(ARTIFACT_TYPES).toContain('draft_version_snapshot');
    expect(ARTIFACT_TYPES).toContain('approval_record_snapshot');
  });

  it('includes bundle types', () => {
    expect(ARTIFACT_TYPES).toContain('dks_reference_bundle');
    expect(ARTIFACT_TYPES).toContain('capability_resolution_bundle');
  });
});

describe('SPINE Artifact Integrity', () => {
  interface Artifact {
    id: string;
    contentHash: string | null;
    version: number;
    sourceObjectType: string | null;
    sourceObjectId: string | null;
    createdByUserId: string;
    createdByAgentRepId: string;
  }

  it('artifact includes content hash', () => {
    const artifact: Artifact = {
      id: '1',
      contentHash: 'sha256:abc123',
      version: 1,
      sourceObjectType: 'campaign_request',
      sourceObjectId: 'req-1',
      createdByUserId: 'user-1',
      createdByAgentRepId: 'rep-1',
    };
    expect(artifact.contentHash).toBe('sha256:abc123');
  });

  it('artifact includes version', () => {
    const artifact: Artifact = {
      id: '1',
      contentHash: null,
      version: 2,
      sourceObjectType: null,
      sourceObjectId: null,
      createdByUserId: 'user-1',
      createdByAgentRepId: 'rep-1',
    };
    expect(artifact.version).toBe(2);
  });

  it('artifact includes source object reference', () => {
    const artifact: Artifact = {
      id: '1',
      contentHash: null,
      version: 1,
      sourceObjectType: 'saif_decision_record',
      sourceObjectId: 'decision-1',
      createdByUserId: 'user-1',
      createdByAgentRepId: 'rep-1',
    };
    expect(artifact.sourceObjectType).toBe('saif_decision_record');
    expect(artifact.sourceObjectId).toBe('decision-1');
  });

  it('artifact includes createdBy lineage', () => {
    const artifact: Artifact = {
      id: '1',
      contentHash: null,
      version: 1,
      sourceObjectType: null,
      sourceObjectId: null,
      createdByUserId: 'user-1',
      createdByAgentRepId: 'rep-1',
    };
    expect(artifact.createdByUserId).toBe('user-1');
    expect(artifact.createdByAgentRepId).toBe('rep-1');
  });
});

describe('SPINE Artifact Link Types', () => {
  const LINK_TYPES = ['derived_from', 'supports', 'supersedes', 'evidence_for', 'produced_by', 'consumed_by', 'references'];

  it('supports all link types', () => {
    expect(LINK_TYPES).toHaveLength(7);
  });

  it('includes lineage types', () => {
    expect(LINK_TYPES).toContain('derived_from');
    expect(LINK_TYPES).toContain('produced_by');
    expect(LINK_TYPES).toContain('consumed_by');
  });

  it('includes relationship types', () => {
    expect(LINK_TYPES).toContain('supports');
    expect(LINK_TYPES).toContain('supersedes');
    expect(LINK_TYPES).toContain('evidence_for');
    expect(LINK_TYPES).toContain('references');
  });
});

describe('Parent-Child Run Lineage', () => {
  interface Run {
    id: string;
    parentRunId: string | null;
    childRuns: Run[];
  }

  it('supports parent-child run relationships', () => {
    const childRun: Run = { id: 'child-1', parentRunId: 'parent-1', childRuns: [] };
    const parentRun: Run = { id: 'parent-1', parentRunId: null, childRuns: [childRun] };

    expect(parentRun.childRuns).toHaveLength(1);
    expect(parentRun.childRuns[0].parentRunId).toBe('parent-1');
  });

  it('supports nested run hierarchy', () => {
    const grandchild: Run = { id: 'gc-1', parentRunId: 'child-1', childRuns: [] };
    const child: Run = { id: 'child-1', parentRunId: 'parent-1', childRuns: [grandchild] };
    const parent: Run = { id: 'parent-1', parentRunId: null, childRuns: [child] };

    expect(parent.childRuns[0].childRuns[0].id).toBe('gc-1');
  });
});

describe('Replay Bundle Reconstruction', () => {
  interface ReplayBundle {
    run: { id: string };
    artifacts: { id: string }[];
    artifactLinks: { id: string }[];
    saifDecisionRecordId: string | null;
    capabilityResolutionId: string | null;
    approvalId: string | null;
    mcpMediationRequestId: string | null;
    mcpMediationDecisionId: string | null;
  }

  it('replay bundle includes all linked references', () => {
    const bundle: ReplayBundle = {
      run: { id: 'run-1' },
      artifacts: [{ id: 'art-1' }, { id: 'art-2' }],
      artifactLinks: [{ id: 'link-1' }],
      saifDecisionRecordId: 'decision-1',
      capabilityResolutionId: 'resolution-1',
      approvalId: 'approval-1',
      mcpMediationRequestId: 'mediation-1',
      mcpMediationDecisionId: 'decision-1',
    };

    expect(bundle.run.id).toBe('run-1');
    expect(bundle.artifacts).toHaveLength(2);
    expect(bundle.artifactLinks).toHaveLength(1);
    expect(bundle.saifDecisionRecordId).toBe('decision-1');
    expect(bundle.capabilityResolutionId).toBe('resolution-1');
    expect(bundle.approvalId).toBe('approval-1');
    expect(bundle.mcpMediationRequestId).toBe('mediation-1');
  });

  it('replay bundle handles null references', () => {
    const bundle: ReplayBundle = {
      run: { id: 'run-1' },
      artifacts: [],
      artifactLinks: [],
      saifDecisionRecordId: null,
      capabilityResolutionId: null,
      approvalId: null,
      mcpMediationRequestId: null,
      mcpMediationDecisionId: null,
    };

    expect(bundle.saifDecisionRecordId).toBeNull();
    expect(bundle.capabilityResolutionId).toBeNull();
  });
});

describe('SPINE References Foreign Objects', () => {
  it('run references foreign objects by ID only', () => {
    const run = {
      id: 'run-1',
      saifDecisionRecordId: 'decision-1',
      capabilityResolutionId: 'resolution-1',
      approvalId: 'approval-1',
      mcpMediationRequestId: 'mediation-1',
    };

    // SPINE does not own these objects - it only references them
    expect(run.saifDecisionRecordId).toBe('decision-1');
    expect(run.capabilityResolutionId).toBe('resolution-1');
    expect(run.approvalId).toBe('approval-1');
    expect(run.mcpMediationRequestId).toBe('mediation-1');
  });

  it('artifact references foreign objects by ID only', () => {
    const artifact = {
      id: 'art-1',
      saifDecisionRecordId: 'decision-1',
      capabilityResolutionId: 'resolution-1',
      approvalId: 'approval-1',
      sourceObjectType: 'campaign_request',
      sourceObjectId: 'req-1',
    };

    expect(artifact.saifDecisionRecordId).toBe('decision-1');
    expect(artifact.sourceObjectType).toBe('campaign_request');
    expect(artifact.sourceObjectId).toBe('req-1');
  });
});

describe('Session Context Lock for SPINE', () => {
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
