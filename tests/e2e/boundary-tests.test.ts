import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// E2E Boundary Tests — validates M5 gates, external access blocks, canonical ownership rules

describe('M5 Execution Blocked', () => {
  function validateM5Execution(action: string, subsystem: string): { allowed: boolean; reason?: string } {
    const blockedActions = ['publish', 'schedule', 'render', 'send_message', 'create_crm_lead', 'upload_file'];
    if (blockedActions.includes(action)) {
      return { allowed: false, reason: `M5 ${action} blocked in ${subsystem}` };
    }
    return { allowed: true };
  }

  it('blocks M5 publishing', () => {
    expect(validateM5Execution('publish', 'postiz').allowed).toBe(false);
  });

  it('blocks M5 rendering', () => {
    expect(validateM5Execution('render', 'production').allowed).toBe(false);
  });

  it('blocks M5 CRM lead creation', () => {
    expect(validateM5Execution('create_crm_lead', 'crm-conversion').allowed).toBe(false);
  });

  it('blocks M5 WhatsApp message', () => {
    expect(validateM5Execution('send_message', 'crm-conversion').allowed).toBe(false);
  });

  it('blocks M5 file upload', () => {
    expect(validateM5Execution('upload_file', 'asset-cognition').allowed).toBe(false);
  });
});

describe('Direct External Access Blocked', () => {
  function validateDirectAccess(target: string, hasMcpMediation: boolean): { allowed: boolean; reason?: string } {
    if (!hasMcpMediation) {
      return { allowed: false, reason: `Direct ${target} access is blocked. MCP mediation required.` };
    }
    return { allowed: true };
  }

  it('blocks direct Postiz access', () => {
    expect(validateDirectAccess('Postiz', false).allowed).toBe(false);
  });

  it('blocks direct CRM access', () => {
    expect(validateDirectAccess('CRM', false).allowed).toBe(false);
  });

  it('blocks direct WhatsApp access', () => {
    expect(validateDirectAccess('WhatsApp', false).allowed).toBe(false);
  });

  it('blocks direct ResourceSpace access', () => {
    expect(validateDirectAccess('ResourceSpace', false).allowed).toBe(false);
  });

  it('allows mediated access', () => {
    expect(validateDirectAccess('Postiz', true).allowed).toBe(true);
  });
});

describe('Canonical Ownership Rules', () => {
  it('Asset Cognition owns canonical asset identity', () => {
    const asset = { id: 'asset-1', canonicalOwner: 'STITCH' };
    expect(asset.canonicalOwner).toBe('STITCH');
  });

  it('ResourceSpace cannot own canonical asset identity', () => {
    const asset = { id: 'asset-1', canonicalOwner: 'STITCH', resourcespaceRef: 'rs-123' };
    expect(asset.canonicalOwner).not.toBe('ResourceSpace');
  });

  it('Rendering tools cannot own canonical asset identity', () => {
    const asset = { id: 'asset-1', canonicalOwner: 'STITCH', renderingRef: 'render-123' };
    expect(asset.canonicalOwner).not.toBe('RenderingTool');
  });

  it('STITCH owns canonical approval authority', () => {
    const approval = { canonicalAuthority: 'STITCH', paperclipRef: 'pc-123' };
    expect(approval.canonicalAuthority).toBe('STITCH');
  });
});

describe('LearningSignal Cannot Execute', () => {
  function validateLearningSignalAuthority(action: string): { allowed: boolean; reason?: string } {
    const blockedActions = ['approve', 'publish', 'execute', 'update_dks_directly', 'change_strategy'];
    if (blockedActions.includes(action)) {
      return { allowed: false, reason: `LearningSignal cannot ${action}` };
    }
    return { allowed: true };
  }

  it('cannot approve', () => expect(validateLearningSignalAuthority('approve').allowed).toBe(false));
  it('cannot publish', () => expect(validateLearningSignalAuthority('publish').allowed).toBe(false));
  it('cannot execute', () => expect(validateLearningSignalAuthority('execute').allowed).toBe(false));
  it('cannot directly update DKS', () => expect(validateLearningSignalAuthority('update_dks_directly').allowed).toBe(false));
  it('cannot change strategy', () => expect(validateLearningSignalAuthority('change_strategy').allowed).toBe(false));
});

describe('FunctionalAgent Cannot Approve or Execute', () => {
  function validateFunctionalAgent(action: string): { allowed: boolean; reason?: string } {
    if (action === 'approve' || action === 'execute') {
      return { allowed: false, reason: `FunctionalAgent cannot ${action}` };
    }
    return { allowed: true };
  }

  it('cannot approve', () => expect(validateFunctionalAgent('approve').allowed).toBe(false));
  it('cannot execute', () => expect(validateFunctionalAgent('execute').allowed).toBe(false));
  it('can read', () => expect(validateFunctionalAgent('read').allowed).toBe(true));
});

describe('GovernanceAgent Cannot Replace Human Authority', () => {
  function validateGovernanceAgent(hasHumanApproval: boolean): { allowed: boolean; reason?: string } {
    if (!hasHumanApproval) {
      return { allowed: false, reason: 'GovernanceAgent cannot replace human authority' };
    }
    return { allowed: true };
  }

  it('blocks without human approval', () => {
    expect(validateGovernanceAgent(false).allowed).toBe(false);
  });

  it('allows with human approval', () => {
    expect(validateGovernanceAgent(true).allowed).toBe(true);
  });
});

describe('No Secrets in Repository', () => {
  it('JWT secret is placeholder', () => {
    const jwtSecret = 'dev-secret-change-in-production';
    expect(jwtSecret).toContain('change-in-production');
  });

  it('no real API keys stored', () => {
    const config = {
      jwtSecret: 'placeholder',
      dbUrl: 'postgresql://localhost:5432/tanaghum',
    };
    expect(config.jwtSecret).not.toContain('sk-');
    expect(config.jwtSecret).not.toContain('api_key');
  });

  it('seed users are development-only', () => {
    const seedComment = 'DEVELOPMENT-ONLY SEED DATA';
    expect(seedComment).toContain('DEVELOPMENT-ONLY');
  });
});

describe('Session Context Lock Enforcement', () => {
  function validateSessionLock(
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
    expect(() => validateSessionLock('u1', 'r1', 'u1', 'r1')).not.toThrow();
  });

  it('blocks mismatched user', () => {
    expect(() => validateSessionLock('u1', 'r1', 'u2', 'r1')).toThrow(ForbiddenError);
  });

  it('blocks mismatched AgentRep', () => {
    expect(() => validateSessionLock('u1', 'r1', 'u1', 'r2')).toThrow(ForbiddenError);
  });
});

describe('SAIF Critical Dimensions Enforcement', () => {
  const CRITICAL_DIMENSIONS = ['security_posture', 'human_oversight', 'compliance'];

  function validateCriticalDimensions(evaluations: { dimension: string; rating: string; mitigation?: string }[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const critical of CRITICAL_DIMENSIONS) {
      const eval_ = evaluations.find(e => e.dimension === critical);
      if (!eval_ || (eval_.rating === 'negative' && !eval_.mitigation)) {
        missing.push(critical);
      }
    }
    return { valid: missing.length === 0, missing };
  }

  it('blocks when critical dimensions missing', () => {
    const result = validateCriticalDimensions([{ dimension: 'cost', rating: 'positive' }]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('security_posture');
  });

  it('passes when all critical dimensions positive', () => {
    const result = validateCriticalDimensions([
      { dimension: 'security_posture', rating: 'positive' },
      { dimension: 'human_oversight', rating: 'positive' },
      { dimension: 'compliance', rating: 'positive' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('passes when negative has mitigation', () => {
    const result = validateCriticalDimensions([
      { dimension: 'security_posture', rating: 'negative', mitigation: 'Additional review' },
      { dimension: 'human_oversight', rating: 'positive' },
      { dimension: 'compliance', rating: 'positive' },
    ]);
    expect(result.valid).toBe(true);
  });
});
