import { z } from 'zod';

export const ROLES = ['admin', 'cco', 'department_head', 'specialist', 'reviewer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

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

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

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
