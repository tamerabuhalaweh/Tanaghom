import { prisma } from '@shared/database';
import { ConflictError, NotFoundError } from '@shared/errors';
import { hashPassword } from '@shared/auth';
import type { CreateUserInput, UpdateUserInput, CreateDepartmentInput, UpdateDepartmentInput, UserSummary, DepartmentSummary } from './types';

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
