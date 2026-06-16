import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { USER_EVENTS, DEPARTMENT_EVENTS, type UserCreatedEvent } from './events';
import * as repo from './repository';
import type { CreateUserInput, UpdateUserInput, CreateDepartmentInput, UpdateDepartmentInput, UserSummary, DepartmentSummary, CreateAgentRepInput, UpdateAgentRepInput, CreateFunctionalAgentInput, CreateGovernanceAgentInput, AgentRepSummary, FunctionalAgentSummary, GovernanceAgentSummary, SessionContext } from './types';

// ============================================================
// User Service
// ============================================================

export async function listUsers(requesterRole: string, departmentId?: string, role?: string): Promise<UserSummary[]> {
  checkPermission(requesterRole, 'users:read');
  return repo.listUsers(departmentId, role);
}

export async function getUser(requesterRole: string, id: string): Promise<UserSummary> {
  checkPermission(requesterRole, 'users:read');
  return repo.getUserById(id);
}

export async function createUser(requesterRole: string, input: CreateUserInput): Promise<UserSummary> {
  checkPermission(requesterRole, 'users:create');
  const user = await repo.createUser(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'user_created', object_type: 'user', object_id: user.id, result: 'success' },
    `User created: ${user.email}`,
  );

  const event: UserCreatedEvent = { userId: user.id, email: user.email, role: user.role, departmentId: user.departmentId, timestamp: new Date() };
  await eventBus.emit(USER_EVENTS.USER_CREATED, event);

  return user;
}

export async function updateUser(requesterRole: string, id: string, input: UpdateUserInput): Promise<UserSummary> {
  checkPermission(requesterRole, 'users:update');
  const user = await repo.updateUser(id, input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'user_updated', object_type: 'user', object_id: id, result: 'success' },
    `User updated: ${user.email}`,
  );

  return user;
}

// ============================================================
// Department Service
// ============================================================

export async function listDepartments(requesterRole: string): Promise<DepartmentSummary[]> {
  checkPermission(requesterRole, 'departments:read');
  return repo.listDepartments();
}

export async function getDepartment(requesterRole: string, id: string): Promise<DepartmentSummary> {
  checkPermission(requesterRole, 'departments:read');
  return repo.getDepartmentById(id);
}

export async function createDepartment(requesterRole: string, input: CreateDepartmentInput): Promise<DepartmentSummary> {
  checkPermission(requesterRole, 'departments:manage');
  const dept = await repo.createDepartment(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'department_created', object_type: 'department', object_id: dept.id, result: 'success' },
    `Department created: ${dept.name}`,
  );

  await eventBus.emit(DEPARTMENT_EVENTS.DEPARTMENT_CREATED, { departmentId: dept.id, name: dept.name, timestamp: new Date() });
  return dept;
}

export async function updateDepartment(requesterRole: string, id: string, input: UpdateDepartmentInput): Promise<DepartmentSummary> {
  checkPermission(requesterRole, 'departments:manage');
  const dept = await repo.updateDepartment(id, input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'department_updated', object_type: 'department', object_id: id, result: 'success' },
    `Department updated: ${dept.name}`,
  );

  return dept;
}

// ============================================================
// Permission Check
// ============================================================

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

// ============================================================
// AgentRep Service
// ============================================================

export async function getAgentRepByUserId(requesterRole: string, userId: string): Promise<AgentRepSummary | null> {
  checkPermission(requesterRole, 'agentreps:read');
  return repo.getAgentRepByUserId(userId);
}

export async function getAgentRepById(requesterRole: string, id: string): Promise<AgentRepSummary> {
  checkPermission(requesterRole, 'agentreps:read');
  return repo.getAgentRepById(id);
}

export async function createAgentRep(requesterRole: string, input: CreateAgentRepInput): Promise<AgentRepSummary> {
  checkPermission(requesterRole, 'agentreps:create');
  const agentRep = await repo.createAgentRep(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'agent_rep_created', object_type: 'agent_rep', object_id: agentRep.id, result: 'success' },
    `AgentRep created: ${agentRep.name} for user ${agentRep.userId}`,
  );

  return agentRep;
}

export async function updateAgentRep(requesterRole: string, id: string, input: UpdateAgentRepInput): Promise<AgentRepSummary> {
  checkPermission(requesterRole, 'agentreps:update');
  const agentRep = await repo.updateAgentRep(id, input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'agent_rep_updated', object_type: 'agent_rep', object_id: id, result: 'success' },
    `AgentRep updated: ${agentRep.name}`,
  );

  return agentRep;
}

export async function listAgentReps(requesterRole: string): Promise<AgentRepSummary[]> {
  checkPermission(requesterRole, 'agentreps:read');
  return repo.listAgentReps();
}

// ============================================================
// FunctionalAgent Service
// ============================================================

export async function createFunctionalAgent(requesterRole: string, input: CreateFunctionalAgentInput): Promise<FunctionalAgentSummary> {
  checkPermission(requesterRole, 'agents:create');
  const agent = await repo.createFunctionalAgent(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'functional_agent_created', object_type: 'functional_agent', object_id: agent.id, result: 'success' },
    `FunctionalAgent created: ${agent.name} (capability: ${agent.capability})`,
  );

  return agent;
}

export async function listFunctionalAgents(requesterRole: string, agentRepId: string): Promise<FunctionalAgentSummary[]> {
  checkPermission(requesterRole, 'agents:read');
  return repo.listFunctionalAgents(agentRepId);
}

// ============================================================
// GovernanceAgent Service
// ============================================================

export async function createGovernanceAgent(requesterRole: string, input: CreateGovernanceAgentInput): Promise<GovernanceAgentSummary> {
  checkPermission(requesterRole, 'agents:create');
  const agent = await repo.createGovernanceAgent(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'governance_agent_created', object_type: 'governance_agent', object_id: agent.id, result: 'success' },
    `GovernanceAgent created: ${agent.name} (policy_scope: ${agent.policyScope.join(', ')})`,
  );

  return agent;
}

export async function listGovernanceAgents(requesterRole: string, agentRepId: string): Promise<GovernanceAgentSummary[]> {
  checkPermission(requesterRole, 'agents:read');
  return repo.listGovernanceAgents(agentRepId);
}

// ============================================================
// Session Context Lock
// ============================================================

export async function resolveSessionContext(userId: string): Promise<SessionContext> {
  const user = await repo.getUserById(userId);
  if (!user) throw new ForbiddenError('User not found');

  const agentRep = await repo.getAgentRepByUserId(userId);
  if (!agentRep) throw new ForbiddenError('No AgentRep found for this user. Session context cannot be resolved.');

  return {
    humanUserId: user.id,
    agentRepId: agentRep.id,
    agentType: agentRep.agentType,
    actingAgentId: null,
    role: user.role,
    departmentId: user.departmentId,
  };
}

export function validateSessionContextLock(
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

export function validateAgentRepOwnership(
  sessionContext: SessionContext,
  targetAgentRepId: string,
): void {
  if (sessionContext.agentRepId !== targetAgentRepId) {
    throw new ForbiddenError('Session Context Lock: AgentRep does not belong to the authenticated user');
  }
}
