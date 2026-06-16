import { prisma } from '@shared/database';
import { ConflictError, NotFoundError } from '@shared/errors';
import { hashPassword } from '@shared/auth';
import type { Prisma } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput, CreateDepartmentInput, UpdateDepartmentInput, UserSummary, DepartmentSummary, CreateAgentRepInput, UpdateAgentRepInput, CreateFunctionalAgentInput, CreateGovernanceAgentInput, AgentRepSummary, FunctionalAgentSummary, GovernanceAgentSummary } from './types';

export async function listUsers(departmentId?: string, role?: string): Promise<UserSummary[]> {
  const where: Record<string, unknown> = {};
  if (departmentId) where.department_id = departmentId;
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: { created_at: 'desc' },
  });

  return users.map((u) => mapUser(u));
}

export async function getUserById(id: string): Promise<UserSummary> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!user) throw new NotFoundError('User', id);
  return mapUser(user);
}

export async function createUser(input: CreateUserInput): Promise<UserSummary> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError(`User with email ${input.email} already exists`);

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password_hash: passwordHash,
      role: input.role,
      department_id: input.departmentId,
    },
    include: { department: true },
  });
  return mapUser(user);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserSummary> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('User', id);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.departmentId !== undefined) data.department_id = input.departmentId;
  if (input.isActive !== undefined) data.is_active = input.isActive;

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { department: true },
  });
  return mapUser(user);
}

export async function listDepartments(): Promise<DepartmentSummary[]> {
  const departments = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
  return departments.map((d) => mapDepartment(d));
}

export async function getDepartmentById(id: string): Promise<DepartmentSummary> {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!dept) throw new NotFoundError('Department', id);
  return mapDepartment(dept);
}

export async function createDepartment(input: CreateDepartmentInput): Promise<DepartmentSummary> {
  const existing = await prisma.department.findUnique({ where: { name: input.name } });
  if (existing) throw new ConflictError(`Department '${input.name}' already exists`);

  const dept = await prisma.department.create({
    data: { name: input.name, description: input.description },
    include: { _count: { select: { users: true } } },
  });
  return mapDepartment(dept);
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<DepartmentSummary> {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Department', id);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;

  const dept = await prisma.department.update({
    where: { id },
    data,
    include: { _count: { select: { users: true } } },
  });
  return mapDepartment(dept);
}

function mapUser(u: Record<string, unknown>): UserSummary {
  const dept = u.department as { name: string } | null;
  return {
    id: u.id as string,
    email: u.email as string,
    name: u.name as string,
    role: u.role as UserSummary['role'],
    departmentId: u.department_id as string | null,
    departmentName: dept?.name || null,
    isActive: u.is_active as boolean,
    createdAt: u.created_at as Date,
  };
}

function mapDepartment(d: Record<string, unknown>): DepartmentSummary {
  const count = d._count as { users: number } | undefined;
  return {
    id: d.id as string,
    name: d.name as string,
    description: d.description as string | null,
    primaryApproverId: null,
    backupApproverId: null,
    userCount: count?.users || 0,
    createdAt: d.created_at as Date,
  };
}

// ============================================================
// AgentRep Repository
// ============================================================

export async function getAgentRepByUserId(userId: string): Promise<AgentRepSummary | null> {
  const agentRep = await prisma.agentRep.findUnique({
    where: { user_id: userId },
    include: {
      user: true,
      functional_agents: true,
      governance_agents: true,
    },
  });
  if (!agentRep) return null;
  return mapAgentRep(agentRep);
}

export async function getAgentRepById(id: string): Promise<AgentRepSummary> {
  const agentRep = await prisma.agentRep.findUnique({
    where: { id },
    include: {
      user: true,
      functional_agents: true,
      governance_agents: true,
    },
  });
  if (!agentRep) throw new NotFoundError('AgentRep', id);
  return mapAgentRep(agentRep);
}

export async function createAgentRep(input: CreateAgentRepInput): Promise<AgentRepSummary> {
  const existing = await prisma.agentRep.findUnique({ where: { user_id: input.userId } });
  if (existing) throw new ConflictError(`AgentRep already exists for user ${input.userId}`);

  const agentRep = await prisma.agentRep.create({
    data: {
      user_id: input.userId,
      name: input.name,
      agent_type: input.agentType,
      permissions_context: input.permissionsContext as Prisma.InputJsonValue | undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    include: {
      user: true,
      functional_agents: true,
      governance_agents: true,
    },
  });
  return mapAgentRep(agentRep);
}

export async function updateAgentRep(id: string, input: UpdateAgentRepInput): Promise<AgentRepSummary> {
  const existing = await prisma.agentRep.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('AgentRep', id);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.status !== undefined) data.status = input.status;
  if (input.permissionsContext !== undefined) data.permissions_context = input.permissionsContext as Prisma.InputJsonValue;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const agentRep = await prisma.agentRep.update({
    where: { id },
    data,
    include: {
      user: true,
      functional_agents: true,
      governance_agents: true,
    },
  });
  return mapAgentRep(agentRep);
}

export async function listAgentReps(): Promise<AgentRepSummary[]> {
  const agentReps = await prisma.agentRep.findMany({
    include: {
      user: true,
      functional_agents: true,
      governance_agents: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return agentReps.map((ar) => mapAgentRep(ar));
}

// ============================================================
// FunctionalAgent Repository
// ============================================================

export async function createFunctionalAgent(input: CreateFunctionalAgentInput): Promise<FunctionalAgentSummary> {
  const agentRep = await prisma.agentRep.findUnique({ where: { id: input.agentRepId } });
  if (!agentRep) throw new NotFoundError('AgentRep', input.agentRepId);

  const agent = await prisma.functionalAgent.create({
    data: {
      agent_rep_id: input.agentRepId,
      name: input.name,
      description: input.description,
      capability: input.capability,
      config: input.config as Prisma.InputJsonValue | undefined,
    },
  });
  return mapFunctionalAgent(agent);
}

export async function listFunctionalAgents(agentRepId: string): Promise<FunctionalAgentSummary[]> {
  const agents = await prisma.functionalAgent.findMany({
    where: { agent_rep_id: agentRepId },
    orderBy: { created_at: 'desc' },
  });
  return agents.map((a) => mapFunctionalAgent(a));
}

// ============================================================
// GovernanceAgent Repository
// ============================================================

export async function createGovernanceAgent(input: CreateGovernanceAgentInput): Promise<GovernanceAgentSummary> {
  const agentRep = await prisma.agentRep.findUnique({ where: { id: input.agentRepId } });
  if (!agentRep) throw new NotFoundError('AgentRep', input.agentRepId);

  const agent = await prisma.governanceAgent.create({
    data: {
      agent_rep_id: input.agentRepId,
      name: input.name,
      description: input.description,
      policy_scope: input.policyScope,
      veto_authority: input.vetoAuthority,
      config: input.config as Prisma.InputJsonValue | undefined,
    },
  });
  return mapGovernanceAgent(agent);
}

export async function listGovernanceAgents(agentRepId: string): Promise<GovernanceAgentSummary[]> {
  const agents = await prisma.governanceAgent.findMany({
    where: { agent_rep_id: agentRepId },
    orderBy: { created_at: 'desc' },
  });
  return agents.map((a) => mapGovernanceAgent(a));
}

// ============================================================
// Mappers
// ============================================================

function mapAgentRep(ar: Record<string, unknown>): AgentRepSummary {
  const user = ar.user as { id: string; name: string; email: string } | null;
  const functionalAgents = (ar.functional_agents as Record<string, unknown>[] || []).map(mapFunctionalAgent);
  const governanceAgents = (ar.governance_agents as Record<string, unknown>[] || []).map(mapGovernanceAgent);

  return {
    id: ar.id as string,
    userId: ar.user_id as string,
    userName: user?.name || 'Unknown',
    userEmail: user?.email || 'Unknown',
    name: ar.name as string,
    agentType: ar.agent_type as AgentRepSummary['agentType'],
    status: ar.status as AgentRepSummary['status'],
    permissionsContext: ar.permissions_context as Record<string, unknown> | null,
    metadata: ar.metadata as Record<string, unknown> | null,
    functionalAgents,
    governanceAgents,
    createdAt: ar.created_at as Date,
    updatedAt: ar.updated_at as Date,
  };
}

function mapFunctionalAgent(a: Record<string, unknown>): FunctionalAgentSummary {
  return {
    id: a.id as string,
    agentRepId: a.agent_rep_id as string,
    name: a.name as string,
    description: a.description as string | null,
    capability: a.capability as string,
    status: a.status as FunctionalAgentSummary['status'],
    config: a.config as Record<string, unknown> | null,
    createdAt: a.created_at as Date,
  };
}

function mapGovernanceAgent(a: Record<string, unknown>): GovernanceAgentSummary {
  return {
    id: a.id as string,
    agentRepId: a.agent_rep_id as string,
    name: a.name as string,
    description: a.description as string | null,
    policyScope: a.policy_scope as string[],
    vetoAuthority: a.veto_authority as boolean,
    status: a.status as GovernanceAgentSummary['status'],
    config: a.config as Record<string, unknown> | null,
    createdAt: a.created_at as Date,
  };
}
