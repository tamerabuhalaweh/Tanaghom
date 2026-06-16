import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// AgentRep and Session Context Lock tests — tests the identity delegation rules without requiring a database
// This validates that the Session Context Lock logic is correct

interface SessionContext {
  humanUserId: string;
  agentRepId: string;
  agentType: 'functional' | 'governance';
  actingAgentId: string | null;
  role: string;
  departmentId: string | null;
}

interface AgentRepStatus {
  id: string;
  status: 'active' | 'inactive' | 'suspended';
}

function validateSessionContextLock(
  sessionContext: SessionContext,
  targetUserId: string,
  targetAgentRepId?: string,
): void {
  // Rule 1: HumanUser can only invoke their assigned AgentRep
  if (targetAgentRepId && sessionContext.agentRepId !== targetAgentRepId) {
    throw new ForbiddenError('Session Context Lock: Cannot invoke another user\'s AgentRep');
  }

  // Rule 2: Cannot act on behalf of another user
  if (sessionContext.humanUserId !== targetUserId) {
    throw new ForbiddenError('Session Context Lock: Cannot act on behalf of another user');
  }
}

function validateAgentRepOwnership(
  sessionContext: SessionContext,
  targetAgentRepId: string,
): void {
  if (sessionContext.agentRepId !== targetAgentRepId) {
    throw new ForbiddenError('Session Context Lock: AgentRep does not belong to the authenticated user');
  }
}

function validateAgentRepIsActive(agentRep: AgentRepStatus): void {
  if (agentRep.status !== 'active') {
    throw new ForbiddenError(`Session Context Lock: AgentRep is ${agentRep.status}. Only active AgentReps can be used.`);
  }
}

function validateFunctionalAgentCannotActAsHumanUser(
  agentType: 'functional' | 'governance',
  _targetUserId: string,
): void {
  if (agentType === 'functional') {
    throw new ForbiddenError('FunctionalAgent cannot act as HumanUser');
  }
}

function validateGovernanceAgentCannotBypassHumanAuthority(
  agentType: 'functional' | 'governance',
  _targetUserId: string,
  hasHumanApproval: boolean,
): void {
  if (agentType === 'governance' && !hasHumanApproval) {
    throw new ForbiddenError('GovernanceAgent cannot bypass HumanUser authority');
  }
}

interface IdentityLineage {
  humanUserId: string;
  agentRepId: string;
  actingAgentType: 'functional' | 'governance' | 'human';
  actingAgentId: string | null;
  action: string;
  targetObjectType: string;
  targetObjectId: string;
  timestamp: Date;
  result: 'success' | 'failure' | 'denied' | 'blocked';
  metadata?: Record<string, unknown>;
}

function createIdentityLineage(
  humanUserId: string,
  agentRepId: string,
  actingAgentType: 'functional' | 'governance' | 'human',
  actingAgentId: string | null,
  action: string,
  targetObjectType: string,
  targetObjectId: string,
  result: 'success' | 'failure' | 'denied' | 'blocked',
  metadata?: Record<string, unknown>,
): IdentityLineage {
  return {
    humanUserId,
    agentRepId,
    actingAgentType,
    actingAgentId,
    action,
    targetObjectType,
    targetObjectId,
    timestamp: new Date(),
    result,
    metadata,
  };
}

describe('Session Context Lock', () => {
  const userA: SessionContext = {
    humanUserId: 'user-a-id',
    agentRepId: 'agent-rep-a-id',
    agentType: 'functional',
    actingAgentId: null,
    role: 'specialist',
    departmentId: 'dept-1',
  };

  const userB: SessionContext = {
    humanUserId: 'user-b-id',
    agentRepId: 'agent-rep-b-id',
    agentType: 'functional',
    actingAgentId: null,
    role: 'specialist',
    departmentId: 'dept-2',
  };

  const ccoUser: SessionContext = {
    humanUserId: 'cco-user-id',
    agentRepId: 'cco-agent-rep-id',
    agentType: 'governance',
    actingAgentId: null,
    role: 'cco',
    departmentId: null,
  };

  describe('HumanUser can only invoke their assigned AgentRep', () => {
    it('allows user to invoke their own AgentRep', () => {
      expect(() => validateSessionContextLock(userA, 'user-a-id', 'agent-rep-a-id')).not.toThrow();
    });

    it('blocks user from invoking another user\'s AgentRep', () => {
      expect(() => validateSessionContextLock(userA, 'user-a-id', 'agent-rep-b-id')).toThrow(ForbiddenError);
    });

    it('blocks user from acting on behalf of another user', () => {
      expect(() => validateSessionContextLock(userA, 'user-b-id')).toThrow(ForbiddenError);
    });
  });

  describe('User cannot command another user\'s AgentRep', () => {
    it('blocks cross-user AgentRep invocation', () => {
      expect(() => validateSessionContextLock(userA, 'user-b-id', 'agent-rep-b-id')).toThrow(ForbiddenError);
    });

    it('blocks AgentRep ownership violation', () => {
      expect(() => validateAgentRepOwnership(userA, 'agent-rep-b-id')).toThrow(ForbiddenError);
    });

    it('allows AgentRep ownership validation for own AgentRep', () => {
      expect(() => validateAgentRepOwnership(userA, 'agent-rep-a-id')).not.toThrow();
    });
  });

  describe('User Rep Agents cannot command another human\'s Rep Agent', () => {
    it('blocks AgentRep A from accessing AgentRep B\'s context', () => {
      expect(() => validateSessionContextLock(userA, 'user-b-id', 'agent-rep-b-id')).toThrow(ForbiddenError);
    });

    it('blocks AgentRep B from accessing AgentRep A\'s context', () => {
      expect(() => validateSessionContextLock(userB, 'user-a-id', 'agent-rep-a-id')).toThrow(ForbiddenError);
    });
  });

  describe('AgentRep must be active', () => {
    it('allows active AgentRep', () => {
      const activeAgentRep: AgentRepStatus = { id: 'rep-1', status: 'active' };
      expect(() => validateAgentRepIsActive(activeAgentRep)).not.toThrow();
    });

    it('blocks inactive AgentRep', () => {
      const inactiveAgentRep: AgentRepStatus = { id: 'rep-1', status: 'inactive' };
      expect(() => validateAgentRepIsActive(inactiveAgentRep)).toThrow(ForbiddenError);
    });

    it('blocks suspended AgentRep', () => {
      const suspendedAgentRep: AgentRepStatus = { id: 'rep-1', status: 'suspended' };
      expect(() => validateAgentRepIsActive(suspendedAgentRep)).toThrow(ForbiddenError);
    });
  });

  describe('FunctionalAgent cannot act as HumanUser', () => {
    it('blocks FunctionalAgent from acting as HumanUser', () => {
      expect(() => validateFunctionalAgentCannotActAsHumanUser('functional', 'user-a-id')).toThrow(ForbiddenError);
    });

    it('allows GovernanceAgent to act (with proper authorization)', () => {
      expect(() => validateFunctionalAgentCannotActAsHumanUser('governance', 'user-a-id')).not.toThrow();
    });
  });

  describe('GovernanceAgent cannot bypass HumanUser authority', () => {
    it('blocks GovernanceAgent without human approval', () => {
      expect(() => validateGovernanceAgentCannotBypassHumanAuthority('governance', 'user-a-id', false)).toThrow(ForbiddenError);
    });

    it('allows GovernanceAgent with human approval', () => {
      expect(() => validateGovernanceAgentCannotBypassHumanAuthority('governance', 'user-a-id', true)).not.toThrow();
    });

    it('allows FunctionalAgent (not subject to this rule)', () => {
      expect(() => validateGovernanceAgentCannotBypassHumanAuthority('functional', 'user-a-id', false)).not.toThrow();
    });
  });

  describe('Identity lineage helpers', () => {
    it('session context includes humanUserId and agentRepId', () => {
      expect(userA.humanUserId).toBe('user-a-id');
      expect(userA.agentRepId).toBe('agent-rep-a-id');
      expect(userA.agentType).toBe('functional');
      expect(userA.role).toBe('specialist');
    });

    it('CCO session context includes governance agent type', () => {
      expect(ccoUser.humanUserId).toBe('cco-user-id');
      expect(ccoUser.agentRepId).toBe('cco-agent-rep-id');
      expect(ccoUser.agentType).toBe('governance');
      expect(ccoUser.role).toBe('cco');
    });
  });
});

describe('Identity Lineage', () => {
  it('creates lineage with all required fields', () => {
    const lineage = createIdentityLineage(
      'user-a-id',
      'agent-rep-a-id',
      'functional',
      'content-strategy-agent-id',
      'create_draft',
      'content_item',
      'content-item-123',
      'success',
      { platform: 'linkedin' },
    );

    expect(lineage.humanUserId).toBe('user-a-id');
    expect(lineage.agentRepId).toBe('agent-rep-a-id');
    expect(lineage.actingAgentType).toBe('functional');
    expect(lineage.actingAgentId).toBe('content-strategy-agent-id');
    expect(lineage.action).toBe('create_draft');
    expect(lineage.targetObjectType).toBe('content_item');
    expect(lineage.targetObjectId).toBe('content-item-123');
    expect(lineage.timestamp).toBeInstanceOf(Date);
    expect(lineage.result).toBe('success');
    expect(lineage.metadata).toEqual({ platform: 'linkedin' });
  });

  it('creates lineage with governance agent type', () => {
    const lineage = createIdentityLineage(
      'cco-user-id',
      'cco-agent-rep-id',
      'governance',
      'cco-governance-agent-id',
      'approve_content',
      'content_item',
      'content-item-456',
      'success',
    );

    expect(lineage.actingAgentType).toBe('governance');
    expect(lineage.actingAgentId).toBe('cco-governance-agent-id');
  });

  it('creates lineage with human agent type', () => {
    const lineage = createIdentityLineage(
      'user-a-id',
      'agent-rep-a-id',
      'human',
      null,
      'manual_review',
      'approval',
      'approval-789',
      'success',
    );

    expect(lineage.actingAgentType).toBe('human');
    expect(lineage.actingAgentId).toBeNull();
  });

  it('supports all result types', () => {
    const results = ['success', 'failure', 'denied', 'blocked'] as const;
    for (const result of results) {
      const lineage = createIdentityLineage(
        'user-a-id',
        'agent-rep-a-id',
        'functional',
        null,
        'test_action',
        'test_object',
        'test-id',
        result,
      );
      expect(lineage.result).toBe(result);
    }
  });
});

describe('AgentRep Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['users:read', 'users:create', 'users:update', 'departments:read', 'departments:manage', 'agentreps:read', 'agentreps:create', 'agentreps:update', 'agents:read', 'agents:create'],
    cco: ['users:read', 'departments:read', 'agentreps:read', 'agents:read'],
    department_head: ['users:read', 'departments:read', 'agentreps:read', 'agents:read'],
    specialist: ['users:read', 'departments:read', 'agentreps:read'],
    reviewer: ['users:read', 'departments:read', 'agentreps:read'],
    viewer: ['users:read', 'departments:read', 'agentreps:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can read AgentReps', () => {
      expect(() => checkPermission('admin', 'agentreps:read')).not.toThrow();
    });

    it('can create AgentReps', () => {
      expect(() => checkPermission('admin', 'agentreps:create')).not.toThrow();
    });

    it('can update AgentReps', () => {
      expect(() => checkPermission('admin', 'agentreps:update')).not.toThrow();
    });

    it('can create agents', () => {
      expect(() => checkPermission('admin', 'agents:create')).not.toThrow();
    });

    it('can read agents', () => {
      expect(() => checkPermission('admin', 'agents:read')).not.toThrow();
    });
  });

  describe('cco', () => {
    it('can read AgentReps', () => {
      expect(() => checkPermission('cco', 'agentreps:read')).not.toThrow();
    });

    it('can read agents', () => {
      expect(() => checkPermission('cco', 'agents:read')).not.toThrow();
    });

    it('cannot create AgentReps', () => {
      expect(() => checkPermission('cco', 'agentreps:create')).toThrow(ForbiddenError);
    });

    it('cannot create agents', () => {
      expect(() => checkPermission('cco', 'agents:create')).toThrow(ForbiddenError);
    });
  });

  describe('specialist', () => {
    it('can read AgentReps', () => {
      expect(() => checkPermission('specialist', 'agentreps:read')).not.toThrow();
    });

    it('cannot create AgentReps', () => {
      expect(() => checkPermission('specialist', 'agentreps:create')).toThrow(ForbiddenError);
    });

    it('cannot read agents', () => {
      expect(() => checkPermission('specialist', 'agents:read')).toThrow(ForbiddenError);
    });
  });

  describe('viewer', () => {
    it('can read AgentReps', () => {
      expect(() => checkPermission('viewer', 'agentreps:read')).not.toThrow();
    });

    it('cannot create AgentReps', () => {
      expect(() => checkPermission('viewer', 'agentreps:create')).toThrow(ForbiddenError);
    });
  });
});
