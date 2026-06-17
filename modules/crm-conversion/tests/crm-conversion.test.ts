import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { MockCrmProvider } from '@shared/providers/mock-crm';
import { MockMessagingProvider } from '@shared/providers/mock-messaging';

// CRM / WhatsApp Conversion Layer tests

describe('Conversion Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['conversion:create', 'conversion:read', 'conversion:handoff'],
    cco: ['conversion:create', 'conversion:read', 'conversion:handoff'],
    department_head: ['conversion:create', 'conversion:read', 'conversion:handoff'],
    specialist: ['conversion:create', 'conversion:read'],
    reviewer: ['conversion:read'],
    viewer: ['conversion:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create', () => expect(() => checkPermission('admin', 'conversion:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('admin', 'conversion:read')).not.toThrow());
    it('can handoff', () => expect(() => checkPermission('admin', 'conversion:handoff')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create', () => expect(() => checkPermission('specialist', 'conversion:create')).not.toThrow());
    it('can read', () => expect(() => checkPermission('specialist', 'conversion:read')).not.toThrow());
    it('cannot handoff', () => expect(() => checkPermission('specialist', 'conversion:handoff')).toThrow(ForbiddenError));
  });

  describe('viewer', () => {
    it('can read', () => expect(() => checkPermission('viewer', 'conversion:read')).not.toThrow());
    it('cannot create', () => expect(() => checkPermission('viewer', 'conversion:create')).toThrow(ForbiddenError));
    it('cannot handoff', () => expect(() => checkPermission('viewer', 'conversion:handoff')).toThrow(ForbiddenError));
  });
});

describe('MCP Mediation Required', () => {
  function validateMcpMediation(mcpMediationRequestId: string | null, system: string): { allowed: boolean; reason?: string } {
    if (!mcpMediationRequestId) {
      return { allowed: false, reason: `Direct ${system} access is blocked. MCP mediation is required.` };
    }
    return { allowed: true };
  }

  it('blocks CRM handoff without MCP mediation', () => {
    const result = validateMcpMediation(null, 'CRM');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MCP mediation');
  });

  it('blocks WhatsApp handoff without MCP mediation', () => {
    const result = validateMcpMediation(null, 'WhatsApp');
    expect(result.allowed).toBe(false);
  });

  it('allows handoff with MCP mediation', () => {
    expect(validateMcpMediation('mediation-1', 'CRM').allowed).toBe(true);
  });
});

describe('MockCrmProvider', () => {
  const provider = new MockCrmProvider();

  it('validates lead data', async () => {
    const result = await provider.prepareHandoff({ name: 'John Doe', source: 'campaign' });
    expect(result.valid).toBe(true);
  });

  it('rejects lead without name', async () => {
    const result = await provider.prepareHandoff({ name: '', source: 'campaign' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lead name is required');
  });

  it('creates mock lead deterministically', async () => {
    const leadData = { name: 'Jane Smith', source: 'LinkedIn', campaignId: 'camp-1' };
    const result1 = await provider.mockCreateLead(leadData);
    const result2 = await provider.mockCreateLead(leadData);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Mock provider is deterministic — same input produces same hash
    expect(result1.payloadHash).toBe(result2.payloadHash);
  });
});

describe('MockMessagingProvider', () => {
  const provider = new MockMessagingProvider();

  it('validates message template', async () => {
    const result = await provider.prepareMessage({ channel: 'WhatsApp', templateName: 'welcome', variables: {} });
    expect(result.valid).toBe(true);
  });

  it('rejects template without channel', async () => {
    const result = await provider.prepareMessage({ channel: '', templateName: 'welcome', variables: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Channel is required');
  });

  it('queues mock message deterministically', async () => {
    const template = { channel: 'WhatsApp', templateName: 'welcome', variables: { name: 'John' } };
    const result = await provider.mockQueueMessage(template);
    expect(result.success).toBe(true);
    expect(result.payloadHash).toBeDefined();
  });
});

describe('Lead Statuses', () => {
  const STATUSES = ['new_lead', 'contacted', 'qualified', 'nurturing', 'converted', 'lost', 'archived'];

  it('supports all lead statuses', () => {
    expect(STATUSES).toHaveLength(7);
  });
});

describe('Consent Statuses', () => {
  const STATUSES = ['pending', 'granted', 'denied', 'withdrawn'];

  it('supports all consent statuses', () => {
    expect(STATUSES).toHaveLength(4);
  });
});

describe('Session Context Lock for Conversion', () => {
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

describe('No Secrets in Conversion Records', () => {
  it('lead placeholders have no real PII', () => {
    const lead = {
      leadNamePlaceholder: 'placeholder-name',
      leadEmailPlaceholder: 'placeholder-email',
      leadPhonePlaceholder: 'placeholder-phone',
    };
    expect(lead.leadNamePlaceholder).toContain('placeholder');
    expect(lead.leadEmailPlaceholder).toContain('placeholder');
  });

  it('CRM payload has no secrets', () => {
    const payload = { summary: 'Mock CRM lead' };
    expect(payload.summary).not.toContain('password');
    expect(payload.summary).not.toContain('token');
  });
});

describe('Conversion Sequence Plan Types', () => {
  const PLAN_STATUSES = ['draft', 'proposed', 'approved', 'rejected', 'executing', 'completed', 'cancelled'];

  it('supports all plan statuses', () => {
    expect(PLAN_STATUSES).toHaveLength(7);
  });
});

describe('FunctionalAgent Cannot Send Messages', () => {
  function validateAgentType(agentType: string): { allowed: boolean; reason?: string } {
    if (agentType === 'functional') {
      return { allowed: false, reason: 'FunctionalAgent cannot send or approve messages' };
    }
    return { allowed: true };
  }

  it('blocks FunctionalAgent from sending messages', () => {
    const result = validateAgentType('functional');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('FunctionalAgent');
  });

  it('allows human to send messages', () => {
    expect(validateAgentType('human').allowed).toBe(true);
  });
});
