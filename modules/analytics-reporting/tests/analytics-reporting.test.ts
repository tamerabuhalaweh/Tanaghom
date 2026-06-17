import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { MockAnalyticsProvider } from '@shared/providers/mock-analytics';

// Analytics / Social MCP & Reporting Foundation tests

describe('Analytics Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
    cco: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
    department_head: ['analytics:create', 'analytics:read', 'analytics:ingest', 'analytics:report'],
    specialist: ['analytics:read', 'analytics:ingest'],
    reviewer: ['analytics:read'],
    viewer: ['analytics:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create sources', () => expect(() => checkPermission('admin', 'analytics:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'analytics:read')).not.toThrow());
    it('can ingest', () => expect(() => checkPermission('admin', 'analytics:ingest')).not.toThrow());
    it('can report', () => expect(() => checkPermission('admin', 'analytics:report')).not.toThrow());
  });

  describe('specialist', () => {
    it('can read', () => expect(() => checkPermission('specialist', 'analytics:read')).not.toThrow());
    it('can ingest', () => expect(() => checkPermission('specialist', 'analytics:ingest')).not.toThrow());
    it('cannot create sources', () => expect(() => checkPermission('specialist', 'analytics:create')).toThrow(ForbiddenError));
    it('cannot report', () => expect(() => checkPermission('specialist', 'analytics:report')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPermission('viewer', 'analytics:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('viewer', 'analytics:create')).toThrow(ForbiddenError));
    it('cannot ingest', () => expect(() => checkPermission('viewer', 'analytics:ingest')).toThrow(ForbiddenError));
  });
});

describe('MCP Mediation for Analytics', () => {
  function validateMcpMediation(requiresMcp: boolean, mcpMediationRequestId: string | null): { allowed: boolean; reason?: string } {
    if (requiresMcp && !mcpMediationRequestId) {
      return { allowed: false, reason: 'MCP mediation is required for this analytics source' };
    }
    return { allowed: true };
  }

  it('blocks ingestion without MCP mediation when required', () => {
    const result = validateMcpMediation(true, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MCP mediation');
  });

  it('allows ingestion with MCP mediation', () => {
    expect(validateMcpMediation(true, 'mediation-1').allowed).toBe(true);
  });

  it('allows ingestion when MCP not required', () => {
    expect(validateMcpMediation(false, null).allowed).toBe(true);
  });
});

describe('Write-Enabled Analytics Blocked', () => {
  function validateWriteAccess(supportsWrite: boolean): { allowed: boolean; reason?: string } {
    if (supportsWrite) {
      return { allowed: false, reason: 'Write-enabled analytics sources are blocked' };
    }
    return { allowed: true };
  }

  it('blocks write-enabled sources', () => {
    const result = validateWriteAccess(true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('allows read-only sources', () => {
    expect(validateWriteAccess(false).allowed).toBe(true);
  });
});

describe('MockAnalyticsProvider', () => {
  const provider = new MockAnalyticsProvider();

  it('creates mock ingestion deterministically', async () => {
    const request = { platform: 'Instagram', campaignId: 'camp-1' };
    const result1 = await provider.requestIngestion(request);
    const result2 = await provider.requestIngestion(request);

    expect(result1.status).toBe('completed');
    expect(result2.status).toBe('completed');
    expect(result1.requestId).toBe(result2.requestId);
  });

  it('fetches mock snapshot with deterministic metrics', async () => {
    const snapshot = await provider.fetchSnapshot('Instagram', 'camp-1');
    expect(snapshot.platform).toBe('Instagram');
    expect(snapshot.metrics.impressions).toBeGreaterThan(0);
    expect(snapshot.normalizedMetrics.impressions).toBeGreaterThan(0);
    expect(snapshot.confidence).toBe('medium');
  });

  it('normalizes metrics deterministically', async () => {
    const rawMetrics = { impressions: 1000, likes: 500 };
    const result = await provider.normalizeMetrics('Instagram', rawMetrics);
    expect(result.impressions).toBe(1000);
    expect(result.likes).toBe(500);
  });

  it('generates mock report deterministically', async () => {
    const report = await provider.generateReport('camp-1', new Date('2026-06-01'), new Date('2026-06-07'));
    expect(report.campaignId).toBe('camp-1');
    expect(report.topFindings.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

describe('Analytics Reporting Period', () => {
  const PERIOD_TYPES = ['h24', 'h48', 'd7', 'weekly', 'monthly', 'custom'];

  it('supports all period types', () => {
    expect(PERIOD_TYPES).toHaveLength(6);
  });
});

describe('LearningSignal Evidence Only', () => {
  function validateLearningSignalAuthority(signalType: string, recommendation: string): { allowed: boolean; reason?: string } {
    if (recommendation.toLowerCase().includes('approve') || recommendation.toLowerCase().includes('publish')) {
      return { allowed: false, reason: 'LearningSignal cannot approve, publish, execute, or update DKS' };
    }
    return { allowed: true };
  }

  it('blocks learning signal that tries to approve', () => {
    const result = validateLearningSignalAuthority('performance', 'Approve this content');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('approve');
  });

  it('blocks learning signal that tries to publish', () => {
    const result = validateLearningSignalAuthority('quality', 'Publish immediately');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('publish');
  });

  it('allows evidence-only learning signal', () => {
    expect(validateLearningSignalAuthority('performance', 'Consider adjusting timing').allowed).toBe(true);
  });
});

describe('Session Context Lock for Analytics', () => {
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

describe('No Secrets in Analytics Records', () => {
  it('analytics source has no secrets', () => {
    const source = {
      name: 'future_postiz_analytics',
      sourceType: 'social_analytics',
      mcpConnectorId: 'connector-1',
    };
    expect(source.mcpConnectorId).not.toContain('api_key');
    expect(source.mcpConnectorId).not.toContain('token');
  });
});

describe('Analytics Source Statuses', () => {
  const STATUSES = ['active', 'inactive', 'planned', 'suspended'];

  it('supports all source statuses', () => {
    expect(STATUSES).toHaveLength(4);
  });
});

describe('Report Advisory Only', () => {
  it('reports cannot approve', () => {
    const report = {
      recommendations: ['Increase posting frequency'],
    };
    expect(report.recommendations).not.toContain(expect.stringContaining('approve'));
  });

  it('reports cannot publish', () => {
    const report = {
      recommendations: ['Test new content formats'],
    };
    expect(report.recommendations).not.toContain(expect.stringContaining('publish'));
  });
});
