import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { USER_EVENTS, DEPARTMENT_EVENTS, type UserCreatedEvent } from './events';
import * as repo from './repository';
import type { CreateUserInput, UpdateUserInput, CreateDepartmentInput, UpdateDepartmentInput, UserSummary, DepartmentSummary } from './types';

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
  admin: ['users:read', 'users:create', 'users:update', 'departments:read', 'departments:manage'],
  cco: ['users:read', 'departments:read'],
  department_head: ['users:read', 'departments:read'],
  specialist: ['users:read', 'departments:read'],
  reviewer: ['users:read', 'departments:read'],
  viewer: ['users:read', 'departments:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}
