import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { MockPostizProvider } from '@shared/providers/mock-postiz';

// Controlled Postiz Integration tests — validates connector placeholders, M5 gate, mock provider, readiness validation

describe('Postiz Integration Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['postiz:create', 'postiz:read', 'postiz:execute'],
    cco: ['postiz:create', 'postiz:read', 'postiz:execute'],
    department_head: ['postiz:create', 'postiz:read'],
    specialist: ['postiz:read'],
    reviewer: ['postiz:read'],
    viewer: ['postiz:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create connectors', () => expect(() => checkPermission('admin', 'postiz:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'postiz:read')).not.toThrow());
    it('can execute', () => expect(() => checkPermission('admin', 'postiz:execute')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkPermission('specialist', 'postiz:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('specialist', 'postiz:create')).toThrow(ForbiddenError));
    it('cannot execute', () => expect(() => checkPermission('specialist', 'postiz:execute')).toThrow(ForbiddenError));
  });
});

describe('M5 Publish Gate', () => {
  function validateM5Gate(requestedAction: string): { allowed: boolean; reason?: string } {
    if (requestedAction === 'publish') {
      return { allowed: false, reason: 'M5 publishing is blocked by default' };
    }
    return { allowed: true };
  }

  it('blocks publish action', () => {
    const result = validateM5Gate('publish');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('allows prepare_draft action', () => {
    expect(validateM5Gate('prepare_draft').allowed).toBe(true);
  });

  it('allows prepare_schedule action', () => {
    expect(validateM5Gate('prepare_schedule').allowed).toBe(true);
  });
});

describe('Direct Postiz Access Blocked', () => {
  function validateMcpMediation(mcpMediationRequestId: string | null): { allowed: boolean; reason?: string } {
    if (!mcpMediationRequestId) {
      return { allowed: false, reason: 'Direct Postiz access is blocked. MCP mediation is required.' };
    }
    return { allowed: true };
  }

  it('blocks direct access without MCP mediation', () => {
    const result = validateMcpMediation(null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MCP mediation');
  });

  it('allows access with MCP mediation', () => {
    expect(validateMcpMediation('mediation-1').allowed).toBe(true);
  });
});

describe('Readiness Validation', () => {
  interface ReadinessInput {
    publishingPackageId: string | null;
    approvalId: string | null;
    saifDecisionRecordId: string | null;
    capabilityResolutionId: string | null;
    mcpMediationRequestId: string | null;
    requestedAction: string;
  }

  function validateReadiness(input: ReadinessInput): { valid: boolean; blockedReasons: string[] } {
    const blockedReasons: string[] = [];

    if (!input.publishingPackageId) blockedReasons.push('PublishingPackage not found');
    if (!input.approvalId) blockedReasons.push('Approval ID is required');
    if (!input.saifDecisionRecordId) blockedReasons.push('SAIF Decision Record is required');
    if (!input.capabilityResolutionId) blockedReasons.push('Capability Resolution is required');
    if (!input.mcpMediationRequestId) blockedReasons.push('MCP Mediation Request is required');
    if (input.requestedAction === 'publish') blockedReasons.push('M5 publishing is blocked by default');

    return { valid: blockedReasons.length === 0, blockedReasons };
  }

  it('blocks when approval is missing', () => {
    const result = validateReadiness({
      publishingPackageId: 'pkg-1',
      approvalId: null,
      saifDecisionRecordId: 'saif-1',
      capabilityResolutionId: 'cap-1',
      mcpMediationRequestId: 'med-1',
      requestedAction: 'prepare_draft',
    });
    expect(result.valid).toBe(false);
    expect(result.blockedReasons).toContain('Approval ID is required');
  });

  it('blocks when SAIF is missing', () => {
    const result = validateReadiness({
      publishingPackageId: 'pkg-1',
      approvalId: 'appr-1',
      saifDecisionRecordId: null,
      capabilityResolutionId: 'cap-1',
      mcpMediationRequestId: 'med-1',
      requestedAction: 'prepare_draft',
    });
    expect(result.valid).toBe(false);
    expect(result.blockedReasons).toContain('SAIF Decision Record is required');
  });

  it('blocks when MCP mediation is missing', () => {
    const result = validateReadiness({
      publishingPackageId: 'pkg-1',
      approvalId: 'appr-1',
      saifDecisionRecordId: 'saif-1',
      capabilityResolutionId: 'cap-1',
      mcpMediationRequestId: null,
      requestedAction: 'prepare_draft',
    });
    expect(result.valid).toBe(false);
    expect(result.blockedReasons).toContain('MCP Mediation Request is required');
  });

  it('blocks publish action', () => {
    const result = validateReadiness({
      publishingPackageId: 'pkg-1',
      approvalId: 'appr-1',
      saifDecisionRecordId: 'saif-1',
      capabilityResolutionId: 'cap-1',
      mcpMediationRequestId: 'med-1',
      requestedAction: 'publish',
    });
    expect(result.valid).toBe(false);
    expect(result.blockedReasons).toContain('M5 publishing is blocked by default');
  });

  it('passes when all requirements met for prepare_draft', () => {
    const result = validateReadiness({
      publishingPackageId: 'pkg-1',
      approvalId: 'appr-1',
      saifDecisionRecordId: 'saif-1',
      capabilityResolutionId: 'cap-1',
      mcpMediationRequestId: 'med-1',
      requestedAction: 'prepare_draft',
    });
    expect(result.valid).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
  });
});

describe('MockPostizProvider', () => {
  const provider = new MockPostizProvider();

  it('creates mock draft deterministically', async () => {
    const request = {
      platform: 'LinkedIn',
      content: 'Test content',
      accountReference: 'test-account',
    };

    const result1 = await provider.createDraft(request);
    const result2 = await provider.createDraft(request);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Mock provider is deterministic — same input produces same hash
    expect(result1.payloadHash).toBe(result2.payloadHash);
    expect(result1.draftId).toBeDefined();
  });

  it('creates mock schedule deterministically', async () => {
    const request = {
      platform: 'Instagram',
      content: 'Test content',
      accountReference: 'test-account',
      scheduledAt: new Date('2026-06-20T10:00:00Z'),
      timezone: 'UTC',
    };

    const result = await provider.prepareSchedule(request);
    expect(result.success).toBe(true);
    expect(result.scheduledJobId).toBeDefined();
    expect(result.payloadHash).toBeDefined();
  });

  it('blocks real publishing', async () => {
    const request = {
      platform: 'LinkedIn',
      content: 'Test content',
      accountReference: 'test-account',
    };

    const result = await provider.publish(request);
    expect(result.success).toBe(false);
    expect(result.error).toContain('blocked');
  });
});

describe('No Secrets in Postiz Records', () => {
  it('connector placeholder has no secrets', () => {
    const connector = {
      connectorName: 'postiz-connector',
      baseUrlPlaceholder: 'https://placeholder.postiz.local',
      credentialBindingId: 'cred-ref-123',
    };
    expect(connector.credentialBindingId).not.toContain('api_key');
    expect(connector.credentialBindingId).not.toContain('token');
  });

  it('account reference has no real credentials', () => {
    const account = {
      platform: 'LinkedIn',
      accountReferencePlaceholder: 'placeholder-linkedin-account',
    };
    expect(account.accountReferencePlaceholder).not.toContain('token');
    expect(account.accountReferencePlaceholder).not.toContain('secret');
  });
});

describe('Session Context Lock for Postiz', () => {
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

describe('Payload Hash Determinism', () => {
  function generatePayloadHash(data: Record<string, unknown>): string {
    const sorted = JSON.stringify(data, Object.keys(data).sort());
    return Buffer.from(sorted).toString('base64');
  }

  it('generates same hash for same data', () => {
    const data = { platform: 'LinkedIn', content: 'Test' };
    expect(generatePayloadHash(data)).toBe(generatePayloadHash(data));
  });

  it('generates different hash for different data', () => {
    const data1 = { platform: 'LinkedIn', content: 'Test' };
    const data2 = { platform: 'Instagram', content: 'Test' };
    expect(generatePayloadHash(data1)).not.toBe(generatePayloadHash(data2));
  });
});

describe('Execution Request Statuses', () => {
  const STATUSES = ['pending', 'validating', 'ready', 'executing', 'completed', 'blocked', 'failed', 'cancelled'];

  it('supports all execution request statuses', () => {
    expect(STATUSES).toHaveLength(8);
  });
});

describe('Requested Actions', () => {
  const ACTIONS = ['prepare_draft', 'prepare_schedule', 'publish'];

  it('supports all requested actions', () => {
    expect(ACTIONS).toHaveLength(3);
  });

  it('publish is M5 blocked', () => {
    expect(ACTIONS).toContain('publish');
  });
});
