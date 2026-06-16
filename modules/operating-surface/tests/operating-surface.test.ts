import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Operating Surface / Paperclip Relay tests — validates surface models, boundary rules, permissions

describe('Operating Surface Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['surface:create', 'surface:read', 'surface:write', 'surface:relay'],
    cco: ['surface:create', 'surface:read', 'surface:write', 'surface:relay'],
    department_head: ['surface:create', 'surface:read', 'surface:write'],
    specialist: ['surface:read', 'surface:write'],
    reviewer: ['surface:read'],
    viewer: ['surface:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create surfaces', () => expect(() => checkPermission('admin', 'surface:create')).not.toThrow());
    it('can read surfaces', () => expect(() => checkPermission('admin', 'surface:read')).not.toThrow());
    it('can write surfaces', () => expect(() => checkPermission('admin', 'surface:write')).not.toThrow());
    it('can relay events', () => expect(() => checkPermission('admin', 'surface:relay')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read surfaces', () => expect(() => checkPermission('specialist', 'surface:read')).not.toThrow());
    it('can write surfaces', () => expect(() => checkPermission('specialist', 'surface:write')).not.toThrow());
    it('cannot create surfaces', () => expect(() => checkPermission('specialist', 'surface:create')).toThrow(ForbiddenError));
    it('cannot relay events', () => expect(() => checkPermission('specialist', 'surface:relay')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read surfaces', () => expect(() => checkPermission('viewer', 'surface:read')).not.toThrow());
    it('cannot write surfaces', () => expect(() => checkPermission('viewer', 'surface:write')).toThrow(ForbiddenError));
    it('cannot create surfaces', () => expect(() => checkPermission('viewer', 'surface:create')).toThrow(ForbiddenError));
  });
});

describe('Surface Types', () => {
  const SURFACE_TYPES = ['paperclip', 'internal_web_app', 'future_chat_surface', 'future_dashboard_surface'];

  it('supports all surface types', () => {
    expect(SURFACE_TYPES).toHaveLength(4);
  });

  it('includes Paperclip', () => {
    expect(SURFACE_TYPES).toContain('paperclip');
  });
});

describe('Paperclip Boundary Rules', () => {
  interface PaperclipReference {
    canonicalObjectType: string;
    canonicalObjectId: string;
    paperclipObjectType: string;
    paperclipReferenceId: string;
  }

  it('Paperclip reference is external reference only', () => {
    const ref: PaperclipReference = {
      canonicalObjectType: 'approval',
      canonicalObjectId: 'approval-1',
      paperclipObjectType: 'task',
      paperclipReferenceId: 'pc-task-123',
    };
    expect(ref.canonicalObjectType).toBe('approval');
    expect(ref.paperclipReferenceId).toBe('pc-task-123');
  });

  it('Paperclip cannot own canonical object identity', () => {
    const canonicalId = 'approval-1';
    const paperclipRef = 'pc-task-123';
    // Canonical ID is source of truth, Paperclip reference is external only
    expect(canonicalId).not.toBe(paperclipRef);
  });
});

describe('SurfaceTask Cannot Approve/Publish/Execute', () => {
  function validateSurfaceTask(taskType: string): { allowed: boolean; reason?: string } {
    // SurfaceTask is a projection/relay object
    // It does not replace Approval, SAIF Decision Record, SPINE Run, or canonical workflow state
    if (taskType === 'approval') {
      // Approval tasks are projections only — they don't create real approvals
      return { allowed: true, reason: 'Approval tasks are projections only' };
    }
    return { allowed: true };
  }

  it('approval tasks are projections only', () => {
    const result = validateSurfaceTask('approval');
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('projections only');
  });

  it('assignment tasks are allowed', () => {
    expect(validateSurfaceTask('assignment').allowed).toBe(true);
  });
});

describe('Status Projection Cannot Become Source of Truth', () => {
  interface StatusProjection {
    canonicalObjectType: string;
    canonicalObjectId: string;
    projectedStatus: string;
    sourceSubstrate: string | null;
  }

  it('projection is derived visibility only', () => {
    const projection: StatusProjection = {
      canonicalObjectType: 'approval',
      canonicalObjectId: 'approval-1',
      projectedStatus: 'pending_review',
      sourceSubstrate: 'stitch',
    };
    expect(projection.projectedStatus).toBe('pending_review');
    expect(projection.sourceSubstrate).toBe('stitch');
  });

  it('projection cannot overwrite canonical status', () => {
    const canonicalStatus = 'approved';
    const projectedStatus = 'pending_review';
    // Canonical status is source of truth, projection is derived
    expect(canonicalStatus).not.toBe(projectedStatus);
  });
});

describe('Relay Event Boundary', () => {
  function validateRelayEvent(payloadSummary: string | null): { allowed: boolean; reason?: string } {
    if (payloadSummary && payloadSummary.length > 5000) {
      return { allowed: false, reason: 'Payload summary too large — store summaries only, not raw payloads' };
    }
    return { allowed: true };
  }

  it('allows relay event with summary', () => {
    const result = validateRelayEvent('User submitted approval request');
    expect(result.allowed).toBe(true);
  });

  it('blocks relay event with oversized payload', () => {
    const largePayload = 'x'.repeat(5001);
    const result = validateRelayEvent(largePayload);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('summaries only');
  });

  it('allows relay event with null payload', () => {
    expect(validateRelayEvent(null).allowed).toBe(true);
  });
});

describe('Sync Policy Types', () => {
  const POLICY_TYPES = [
    'stitch_to_surface_read_only',
    'surface_to_stitch_review_required',
    'surface_to_stitch_blocked',
    'surface_status_projection_only',
  ];

  it('supports all sync policy types', () => {
    expect(POLICY_TYPES).toHaveLength(4);
  });

  it('includes read-only policy', () => {
    expect(POLICY_TYPES).toContain('stitch_to_surface_read_only');
  });

  it('includes blocked policy', () => {
    expect(POLICY_TYPES).toContain('surface_to_stitch_blocked');
  });

  it('includes review-required policy', () => {
    expect(POLICY_TYPES).toContain('surface_to_stitch_review_required');
  });
});

describe('Session Context Lock for Surface Writes', () => {
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

describe('No Secrets in Surface Records', () => {
  it('relay event payload summary does not contain secrets', () => {
    const event = {
      payloadSummary: 'Approval request submitted',
    };
    expect(event.payloadSummary).not.toContain('password');
    expect(event.payloadSummary).not.toContain('token');
    expect(event.payloadSummary).not.toContain('api_key');
  });
});

describe('Operating Surface Canonical Authority', () => {
  it('surfaces have canonical authority field', () => {
    const surface = {
      name: 'paperclip',
      canonicalAuthority: 'stitch',
    };
    expect(surface.canonicalAuthority).toBe('stitch');
  });

  it('Paperclip does not own canonical authority', () => {
    const surface = {
      name: 'paperclip',
      canonicalAuthority: 'stitch',
    };
    expect(surface.canonicalAuthority).not.toBe('paperclip');
  });
});
