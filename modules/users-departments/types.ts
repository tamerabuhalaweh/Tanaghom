import { z } from 'zod';

export const ROLES = ['admin', 'cco', 'department_head', 'specialist', 'reviewer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const AGENT_TYPES = ['functional', 'governance'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES),
  departmentId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  primaryApproverId: z.string().uuid().nullable().optional(),
  backupApproverId: z.string().uuid().nullable().optional(),
});

export const createAgentRepSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  agentType: z.enum(AGENT_TYPES).default('functional'),
  permissionsContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAgentRepSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(AGENT_STATUSES).optional(),
  permissionsContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createFunctionalAgentSchema = z.object({
  agentRepId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  capability: z.string().min(1).max(200),
  config: z.record(z.unknown()).optional(),
});

export const createGovernanceAgentSchema = z.object({
  agentRepId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  policyScope: z.array(z.string()).min(1),
  vetoAuthority: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateAgentRepInput = z.infer<typeof createAgentRepSchema>;
export type UpdateAgentRepInput = z.infer<typeof updateAgentRepSchema>;
export type CreateFunctionalAgentInput = z.infer<typeof createFunctionalAgentSchema>;
export type CreateGovernanceAgentInput = z.infer<typeof createGovernanceAgentSchema>;

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  description: string | null;
  primaryApproverId: string | null;
  backupApproverId: string | null;
  userCount: number;
  createdAt: Date;
}

export interface AgentRepSummary {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  agentType: AgentType;
  status: AgentStatus;
  permissionsContext: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  functionalAgents: FunctionalAgentSummary[];
  governanceAgents: GovernanceAgentSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FunctionalAgentSummary {
  id: string;
  agentRepId: string;
  name: string;
  description: string | null;
  capability: string;
  status: AgentStatus;
  config: Record<string, unknown> | null;
  createdAt: Date;
}

export interface GovernanceAgentSummary {
  id: string;
  agentRepId: string;
  name: string;
  description: string | null;
  policyScope: string[];
  vetoAuthority: boolean;
  status: AgentStatus;
  config: Record<string, unknown> | null;
  createdAt: Date;
}

export interface SessionContext {
  humanUserId: string;
  agentRepId: string;
  agentType: AgentType;
  actingAgentId: string | null;
  role: Role;
  departmentId: string | null;
}
