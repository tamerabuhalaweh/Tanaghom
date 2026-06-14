import { prisma } from '@shared/database';
import type { SessionUser } from '../types';

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { department: true },
  });
}

export async function findUserById(id: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.department_id,
    isActive: user.is_active,
  };
}
