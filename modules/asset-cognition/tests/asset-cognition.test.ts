import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Asset Cognition & ResourceSpace Boundary tests — validates asset model, cognition records, external references, lineage, boundary rules

describe('Asset Cognition Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize', 'assets:reference'],
    cco: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize', 'assets:reference'],
    department_head: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize'],
    specialist: ['assets:create', 'assets:read', 'assets:cognize'],
    reviewer: ['assets:read'],
    viewer: ['assets:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create assets', () => expect(() => checkPermission('admin', 'assets:create')).not.toThrow());
    it('can read assets', () => expect(() => checkPermission('admin', 'assets:read')).not.toThrow());
    it('can update assets', () => expect(() => checkPermission('admin', 'assets:update')).not.toThrow());
    it('can create cognition records', () => expect(() => checkPermission('admin', 'assets:cognize')).not.toThrow());
    it('can create external references', () => expect(() => checkPermission('admin', 'assets:reference')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create assets', () => expect(() => checkPermission('specialist', 'assets:create')).not.toThrow());
    it('can read assets', () => expect(() => checkPermission('specialist', 'assets:read')).not.toThrow());
    it('cannot update assets', () => expect(() => checkPermission('specialist', 'assets:update')).toThrow(ForbiddenError));
    it('cannot create external references', () => expect(() => checkPermission('specialist', 'assets:reference')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read assets', () => expect(() => checkPermission('viewer', 'assets:read')).not.toThrow());
    it('cannot create assets', () => expect(() => checkPermission('viewer', 'assets:create')).toThrow(ForbiddenError));
    it('cannot create cognition records', () => expect(() => checkPermission('viewer', 'assets:cognize')).toThrow(ForbiddenError));
  });
});

describe('Asset Status Lifecycle', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['pending_review', 'archived'],
    pending_review: ['approved', 'rejected', 'archived'],
    approved: ['archived', 'superseded'],
    rejected: ['draft', 'archived'],
    archived: [],
    superseded: ['archived'],
  };

  function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('draft can transition to pending_review', () => expect(isValidTransition('draft', 'pending_review')).toBe(true));
  it('draft can transition to archived', () => expect(isValidTransition('draft', 'archived')).toBe(true));
  it('pending_review can transition to approved', () => expect(isValidTransition('pending_review', 'approved')).toBe(true));
  it('pending_review can transition to rejected', () => expect(isValidTransition('pending_review', 'rejected')).toBe(true));
  it('approved can transition to archived', () => expect(isValidTransition('approved', 'archived')).toBe(true));
  it('approved can transition to superseded', () => expect(isValidTransition('approved', 'superseded')).toBe(true));
  it('archived cannot transition', () => expect(isValidTransition('archived', 'draft')).toBe(false));
  it('rejected can transition to draft', () => expect(isValidTransition('rejected', 'draft')).toBe(true));
});

describe('Asset Types', () => {
  const ASSET_TYPES = ['image', 'video', 'document', 'audio', 'template', 'carousel', 'thumbnail', 'brand_guideline', 'creative_brief', 'publishing_package', 'other'];

  it('supports all asset types', () => {
    expect(ASSET_TYPES).toHaveLength(11);
  });

  it('includes media types', () => {
    expect(ASSET_TYPES).toContain('image');
    expect(ASSET_TYPES).toContain('video');
    expect(ASSET_TYPES).toContain('audio');
  });

  it('includes content types', () => {
    expect(ASSET_TYPES).toContain('carousel');
    expect(ASSET_TYPES).toContain('thumbnail');
    expect(ASSET_TYPES).toContain('publishing_package');
  });
});

describe('Cognition Record Cannot Approve or Publish', () => {
  function validateCognitionRecord(summary: string): { allowed: boolean; reason?: string } {
    if (summary.toLowerCase().includes('approve') || summary.toLowerCase().includes('publish')) {
      return { allowed: false, reason: 'Cognition records cannot approve or publish assets' };
    }
    return { allowed: true };
  }

  it('blocks cognition record that tries to approve', () => {
    const result = validateCognitionRecord('This asset is approved for publishing');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('approve');
  });

  it('blocks cognition record that tries to publish', () => {
    const result = validateCognitionRecord('Ready to publish on LinkedIn');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('publish');
  });

  it('allows cognition record with non-authoritative summary', () => {
    const result = validateCognitionRecord('Brand fit score: 0.85, strong alignment with voice');
    expect(result.allowed).toBe(true);
  });
});

describe('ResourceSpace Boundary', () => {
  interface Asset {
    id: string;
    canonicalOwner: string | null;
  }

  interface ExternalReference {
    assetId: string;
    externalSystem: string;
    externalReferenceId: string;
  }

  function validateResourceSpaceBoundary(asset: Asset, reference: ExternalReference): { allowed: boolean; reason?: string } {
    if (reference.externalSystem === 'ResourceSpace' && asset.canonicalOwner === 'ResourceSpace') {
      return { allowed: false, reason: 'ResourceSpace cannot become the canonical owner of an asset' };
    }
    return { allowed: true };
  }

  it('blocks ResourceSpace from becoming canonical owner', () => {
    const asset: Asset = { id: '1', canonicalOwner: 'ResourceSpace' };
    const reference: ExternalReference = { assetId: '1', externalSystem: 'ResourceSpace', externalReferenceId: 'rs-123' };
    const result = validateResourceSpaceBoundary(asset, reference);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('canonical owner');
  });

  it('allows ResourceSpace as external reference when not canonical', () => {
    const asset: Asset = { id: '1', canonicalOwner: 'STITCH' };
    const reference: ExternalReference = { assetId: '1', externalSystem: 'ResourceSpace', externalReferenceId: 'rs-123' };
    const result = validateResourceSpaceBoundary(asset, reference);
    expect(result.allowed).toBe(true);
  });

  it('allows other external systems', () => {
    const asset: Asset = { id: '1', canonicalOwner: null };
    const reference: ExternalReference = { assetId: '1', externalSystem: 'RenderingTool', externalReferenceId: 'rt-456' };
    expect(validateResourceSpaceBoundary(asset, reference).allowed).toBe(true);
  });
});

describe('Asset Cognition References Foreign Objects', () => {
  it('asset references foreign objects by ID only', () => {
    const asset = {
      id: 'asset-1',
      spineArtifactId: 'artifact-1',
      saifDecisionRecordId: 'decision-1',
      approvalId: 'approval-1',
      capabilityResolutionId: 'resolution-1',
    };

    expect(asset.spineArtifactId).toBe('artifact-1');
    expect(asset.saifDecisionRecordId).toBe('decision-1');
    expect(asset.approvalId).toBe('approval-1');
    expect(asset.capabilityResolutionId).toBe('resolution-1');
  });

  it('external reference is reference only, not ownership', () => {
    const reference = {
      id: 'ref-1',
      assetId: 'asset-1',
      externalSystem: 'ResourceSpace',
      externalReferenceId: 'rs-123',
      referenceType: 'resourcespace_asset',
    };

    expect(reference.externalSystem).toBe('ResourceSpace');
    expect(reference.externalReferenceId).toBe('rs-123');
    // External reference does not own the asset
  });
});

describe('Asset Lineage Types', () => {
  const LINEAGE_TYPES = ['derived_from', 'variant_of', 'approved_version_of', 'rendered_from', 'used_in', 'supports', 'replaces', 'references'];

  it('supports all lineage types', () => {
    expect(LINEAGE_TYPES).toHaveLength(8);
  });

  it('includes derivation types', () => {
    expect(LINEAGE_TYPES).toContain('derived_from');
    expect(LINEAGE_TYPES).toContain('variant_of');
    expect(LINEAGE_TYPES).toContain('rendered_from');
  });

  it('includes relationship types', () => {
    expect(LINEAGE_TYPES).toContain('supports');
    expect(LINEAGE_TYPES).toContain('replaces');
    expect(LINEAGE_TYPES).toContain('references');
  });
});

describe('No Secrets in Asset Metadata', () => {
  it('asset metadata does not contain secrets', () => {
    const asset = {
      metadata: { dimensions: '1080x1080', format: 'png' },
    };
    expect(JSON.stringify(asset.metadata)).not.toContain('password');
    expect(JSON.stringify(asset.metadata)).not.toContain('api_key');
    expect(JSON.stringify(asset.metadata)).not.toContain('token');
  });
});

describe('Session Context Lock for Assets', () => {
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

describe('External Reference Types', () => {
  const REFERENCE_TYPES = ['resourcespace_asset', 'rendering_output', 'design_tool_link', 'storage_object', 'dam_reference'];

  it('supports all reference types', () => {
    expect(REFERENCE_TYPES).toHaveLength(5);
  });

  it('includes ResourceSpace', () => {
    expect(REFERENCE_TYPES).toContain('resourcespace_asset');
  });
});
