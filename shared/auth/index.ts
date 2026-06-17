import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UnauthorizedError, ForbiddenError } from '../errors';

const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  departmentId?: string;
  agentRepId?: string;
}

export interface SessionContext {
  humanUserId: string;
  agentRepId: string;
  role: string;
  departmentId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: 86400 });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (payload: JwtPayload): void => {
    if (!allowedRoles.includes(payload.role)) {
      throw new ForbiddenError(`Role '${payload.role}' is not authorized. Required: ${allowedRoles.join(', ')}`);
    }
  };
}

export function resolveSessionContext(payload: JwtPayload): SessionContext {
  if (!payload.agentRepId) {
    throw new UnauthorizedError('Session context incomplete: agentRepId missing');
  }
  return {
    humanUserId: payload.sub,
    agentRepId: payload.agentRepId,
    role: payload.role,
    departmentId: payload.departmentId,
  };
}

export { authenticate } from './middleware';
