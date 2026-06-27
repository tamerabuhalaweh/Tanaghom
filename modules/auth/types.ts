import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().regex(/^\d{6}$/, 'Authenticator code must be 6 digits').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantKey: string;
    departmentId: string | null;
    agentRepId: string | null;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantKey: string;
  departmentId: string | null;
  isActive: boolean;
  agentRepId: string | null;
}
