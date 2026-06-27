import { beforeEach, describe, expect, it, vi } from 'vitest';

const repoMocks = vi.hoisted(() => ({
  getAgentRepByUserId: vi.fn(),
  getUserById: vi.fn(),
  createAgentRep: vi.fn(),
}));

vi.mock('../repository', () => repoMocks);
vi.mock('@shared/logging', () => ({
  auditLog: vi.fn(),
}));

import { createOwnAgentRep } from '../service';

describe('createOwnAgentRep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing AgentRep without creating another one', async () => {
    const existing = {
      id: 'rep-1',
      userId: 'user-1',
      name: 'Existing AgentRep',
      status: 'active',
      agentType: 'functional',
      functionalAgents: [],
      governanceAgents: [],
    };
    repoMocks.getAgentRepByUserId.mockResolvedValue(existing);

    const result = await createOwnAgentRep('user-1', 'specialist', 'dept-1');

    expect(result).toBe(existing);
    expect(repoMocks.createAgentRep).not.toHaveBeenCalled();
  });

  it('creates only the authenticated user AgentRep when missing', async () => {
    repoMocks.getAgentRepByUserId.mockResolvedValue(null);
    repoMocks.getUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Social Manager',
      email: 'social@example.com',
      role: 'specialist',
      departmentId: 'dept-1',
    });
    repoMocks.createAgentRep.mockImplementation(async (input) => ({
      id: 'rep-2',
      userId: input.userId,
      name: input.name,
      agentType: input.agentType,
      status: 'active',
      permissionsContext: input.permissionsContext,
      metadata: input.metadata,
      functionalAgents: [],
      governanceAgents: [],
    }));

    const result = await createOwnAgentRep('user-1', 'specialist', 'dept-1');

    expect(repoMocks.createAgentRep).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Social Manager AgentRep',
      agentType: 'functional',
      permissionsContext: {
        role: 'specialist',
        departmentId: 'dept-1',
        source: 'self_service_agentrep_creation',
      },
      metadata: {
        createdBy: 'self_service',
      },
    });
    expect(result.userId).toBe('user-1');
    expect(result.permissionsContext.source).toBe('self_service_agentrep_creation');
  });
});
