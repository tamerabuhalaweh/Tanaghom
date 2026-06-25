import { prisma } from '@shared/database';
import type { SessionUser } from './types';

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { department: true },
  });
}

export async function findUserById(id: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { department: true, agent_reps: true },
  });
  if (!user) return null;

  const agentRep = user.agent_reps?.[0] || null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantKey: user.tenant_key,
    departmentId: user.department_id,
    isActive: user.is_active,
    agentRepId: agentRep?.id || null,
  };
}

export async function findAgentRepByUserId(userId: string) {
  return prisma.agentRep.findUnique({
    where: { user_id: userId },
  });
}
