import { UnauthorizedError } from '@shared/errors';
import { comparePassword, signToken, verifyToken, type JwtPayload } from '@shared/auth';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { AUTH_EVENTS, type UserAuthenticatedEvent, type UserLoginFailedEvent } from './events';
import { findUserByEmail, findUserById } from './repository';
import type { LoginInput, LoginResult, SessionUser } from './types';

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await findUserByEmail(input.email);

  if (!user) {
    const event: UserLoginFailedEvent = { email: input.email, reason: 'User not found', timestamp: new Date() };
    await eventBus.emit(AUTH_EVENTS.USER_LOGIN_FAILED, event);
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.is_active) {
    const event: UserLoginFailedEvent = { email: input.email, reason: 'Account disabled', timestamp: new Date() };
    await eventBus.emit(AUTH_EVENTS.USER_LOGIN_FAILED, event);
    throw new UnauthorizedError('Account is disabled');
  }

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) {
    const event: UserLoginFailedEvent = { email: input.email, reason: 'Invalid password', timestamp: new Date() };
    await eventBus.emit(AUTH_EVENTS.USER_LOGIN_FAILED, event);
    throw new UnauthorizedError('Invalid email or password');
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.department_id || undefined,
  };

  const token = signToken(payload);

  auditLog(
    { actor: `user:${user.email}`, action: 'login', object_type: 'session', result: 'success' },
    'User authenticated',
  );

  const authEvent: UserAuthenticatedEvent = { userId: user.id, email: user.email, role: user.role, timestamp: new Date() };
  await eventBus.emit(AUTH_EVENTS.USER_AUTHENTICATED, authEvent);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.department_id,
    },
  };
}

export async function getSession(token: string): Promise<SessionUser> {
  const payload = verifyToken(token);
  const user = await findUserById(payload.sub);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is disabled');
  }

  return user;
}
