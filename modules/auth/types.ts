import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    departmentId: string | null;
    agentRepId: string | null;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  isActive: boolean;
  agentRepId: string | null;
}
