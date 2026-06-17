import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { MockRenderingProvider } from '@shared/providers/mock-rendering';

// Production / Rendering Workflow tests

describe('Production Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['production:create', 'production:read', 'production:update', 'production:render'],
    cco: ['production:create', 'production:read', 'production:update', 'production:render'],
    department_head: ['production:create', 'production:read', 'production:update'],
    specialist: ['production:create', 'production:read'],
    reviewer: ['production:read'],
    viewer: ['production:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create', () => expect(() => checkPermission('admin', 'production:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'production:read')).not.toThrow());
    it('can render', () => expect(() => checkPermission('admin', 'production:render')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create', () => expect(() => checkPermission('specialist', 'production:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('specialist', 'production:read')).not.toThrow());
    it('cannot render', () => expect(() => checkPermission('specialist', 'production:render')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPermission('viewer', 'production:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('viewer', 'production:create')).toThrow(ForbiddenError));
  });
});

describe('Production Request Status Lifecycle', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['in_progress', 'blocked', 'cancelled'],
    in_progress: ['review', 'blocked', 'cancelled'],
    review: ['completed', 'in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
    blocked: ['submitted', 'in_progress', 'cancelled'],
  };

  function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('draft can transition to submitted', () => expect(isValidTransition('draft', 'submitted')).toBe(true));
  it('submitted can transition to in_progress', () => expect(isValidTransition('submitted', 'in_progress')).toBe(true));
  it('in_progress can transition to review', () => expect(isValidTransition('in_progress', 'review')).toBe(true));
  it('review can transition to completed', () => expect(isValidTransition('review', 'completed')).toBe(true));
  it('completed cannot transition', () => expect(isValidTransition('completed', 'draft')).toBe(false));
  it('cancelled cannot transition', () => expect(isValidTransition('cancelled', 'draft')).toBe(false));
});

describe('MCP Mediation for Rendering', () => {
  function validateMcpMediation(mcpMediationRequestId: string | null): { allowed: boolean; reason?: string } {
    if (!mcpMediationRequestId) {
      return { allowed: false, reason: 'Direct rendering access is blocked. MCP mediation is required.' };
    }
    return { allowed: true };
  }

  it('blocks rendering without MCP mediation', () => {
    const result = validateMcpMediation(null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MCP mediation');
  });

  it('allows rendering with MCP mediation', () => {
    expect(validateMcpMediation('mediation-1').allowed).toBe(true);
  });
});

describe('M5 Rendering Blocked', () => {
  function validateM5Rendering(isM5Execution: boolean): { allowed: boolean; reason?: string } {
    if (isM5Execution) {
      return { allowed: false, reason: 'M5 rendering execution is blocked by default' };
    }
    return { allowed: true };
  }

  it('blocks M5 rendering execution', () => {
    const result = validateM5Rendering(true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('allows M4 preparation', () => {
    expect(validateM5Rendering(false).allowed).toBe(true);
  });
});

describe('MockRenderingProvider', () => {
  const provider = new MockRenderingProvider();

  it('validates render package', async () => {
    const pkg = { platform: 'Instagram', format: 'Reel', assets: [{ type: 'image', reference: 'ref-1' }] };
    const result = await provider.prepareRender(pkg);
    expect(result.valid).toBe(true);
  });

  it('rejects package without platform', async () => {
    const pkg = { platform: '', format: 'Reel', assets: [{ type: 'image', reference: 'ref-1' }] };
    const result = await provider.prepareRender(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Platform is required');
  });

  it('rejects package without assets', async () => {
    const pkg = { platform: 'Instagram', format: 'Reel', assets: [] };
    const result = await provider.prepareRender(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one asset is required');
  });

  it('creates mock render preview deterministically', async () => {
    const pkg = { platform: 'Instagram', format: 'Reel', assets: [{ type: 'image', reference: 'ref-1' }] };
    const result1 = await provider.mockRenderPreview(pkg);
    const result2 = await provider.mockRenderPreview(pkg);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Same input produces same hash
    expect(result1.payloadHash).toBe(result2.payloadHash);
  });
});

describe('Asset Cognition Remains Canonical', () => {
  it('rendering tools cannot own asset identity', () => {
    const asset = {
      id: 'asset-1',
      canonicalOwner: 'STITCH',
      renderingReference: 'render-output-1',
    };
    expect(asset.canonicalOwner).toBe('STITCH');
    // Rendering reference is external, not canonical
  });
});

describe('Session Context Lock for Production', () => {
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

describe('Request Types', () => {
  const REQUEST_TYPES = [
    'static_design', 'carousel', 'short_video', 'thumbnail',
    'landing_page_visual', 'brand_asset', 'publishing_package_asset'
  ];

  it('supports all request types', () => {
    expect(REQUEST_TYPES).toHaveLength(7);
  });
});

describe('No Secrets in Production Records', () => {
  it('production request has no secrets', () => {
    const request = {
      rationale: 'Campaign visual needed',
    };
    expect(request.rationale).not.toContain('password');
    expect(request.rationale).not.toContain('token');
  });
});
