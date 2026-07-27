import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AppError, UnauthorizedError, ForbiddenError } from '../errors';

const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
  tenantKey?: string;
  departmentId?: string;
  agentRepId?: string;
  mfaEnrollmentRequired?: boolean;
}

export interface SessionContext {
  humanUserId: string;
  agentRepId: string;
  role: string;
  tenantKey: string;
  departmentId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: payload.jti || randomUUID() } as object, JWT_SECRET, { expiresIn: 86400 });
}

function decodeToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    assertPrivilegedSessionFresh(payload);
    return payload;
  } catch {
    throw new UnauthorizedError('Invalid, expired, or superseded token');
  }
}

function assertPrivilegedSessionFresh(payload: JwtPayload): void {
  const cutoff = Number(process.env.MFA_PRIVILEGED_ENFORCEMENT_EPOCH || 0);
  if (!Number.isFinite(cutoff) || cutoff <= 0) return;
  if (!['admin', 'cco', 'department_head'].includes(payload.role)) return;
  if (!payload.iat || payload.iat < cutoff) {
    throw new AppError(
      'Sign in again to complete the privileged account security check',
      401,
      'PRIVILEGED_REAUTH_REQUIRED',
    );
  }
}

export function verifyToken(
  token: string,
  options: { allowMfaEnrollmentRequired?: boolean } = {},
): JwtPayload {
  const payload = decodeToken(token);
  if (payload.mfaEnrollmentRequired && !options.allowMfaEnrollmentRequired) {
    throw new AppError(
      'Complete authenticator enrollment before accessing this resource',
      403,
      'MFA_ENROLLMENT_REQUIRED',
    );
  }
  return payload;
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
    tenantKey: payload.tenantKey || 'default',
    departmentId: payload.departmentId,
  };
}

export { authenticate } from './middleware';
