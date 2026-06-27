import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { comparePassword, hashPassword, signToken, verifyToken, type JwtPayload } from '@shared/auth';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@shared/database';
import { getEmailDeliveryStatus, sendOnboardingEmail } from '@shared/notifications/email';
import { AUTH_EVENTS, type UserAuthenticatedEvent, type UserLoginFailedEvent } from './events';
import { findUserByEmail, findUserById, findAgentRepByUserId } from './repository';
import { assertMfaSatisfied } from './mfa-service';
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

  const membership = await ensureActiveTenantMembership(user.id, user.tenant_key, user.role);
  await assertMfaSatisfied(user.id, input.mfaCode);

  // Resolve AgentRep for session context
  const agentRep = await findAgentRepByUserId(user.id);

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: membership.role,
    tenantKey: user.tenant_key,
    departmentId: user.department_id || undefined,
    agentRepId: agentRep?.id,
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
      role: membership.role,
      tenantKey: user.tenant_key,
      departmentId: user.department_id,
      agentRepId: agentRep?.id || null,
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

export async function createOnboardingToken(input: {
  requesterRole: string;
  requesterUserId: string;
  requesterTenantKey?: string;
  userId: string;
  purpose: 'invite' | 'password_reset';
  sendEmail?: boolean;
}): Promise<{
  token?: string;
  expiresAt: Date;
  purpose: string;
  rawTokenReturnedOnce: boolean;
  delivery: { mode: 'email' | 'manual'; sent: boolean; messageId?: string | null };
}> {
  if (input.requesterRole !== 'admin' && input.requesterRole !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required');
  }
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      tenant_key: input.requesterTenantKey || 'default',
    },
  });
  if (!user) throw new UnauthorizedError('User not found');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await prisma.userOnboardingToken.create({
    data: {
      user_id: input.userId,
      purpose: input.purpose,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    },
  });
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'onboarding_token_created', object_type: 'user', object_id: input.userId, result: 'success' },
    `Onboarding token created for ${input.purpose}`,
  );

  if (input.sendEmail) {
    const delivery = await sendOnboardingEmail({
      to: user.email,
      name: user.name,
      token,
      purpose: input.purpose,
    });
    auditLog(
      { actor: `user:${input.requesterUserId}`, action: 'onboarding_email_sent', object_type: 'user', object_id: input.userId, result: 'success' },
      `Onboarding email sent for ${input.purpose}`,
    );
    return {
      expiresAt,
      purpose: input.purpose,
      rawTokenReturnedOnce: false,
      delivery: { mode: 'email', sent: true, messageId: delivery.messageId },
    };
  }

  return {
    token,
    expiresAt,
    purpose: input.purpose,
    rawTokenReturnedOnce: true,
    delivery: { mode: 'manual', sent: false },
  };
}

export async function acceptOnboardingToken(input: { token: string; password: string }): Promise<{ status: 'accepted'; userId: string }> {
  const tokenHash = hashToken(input.token);
  const record = await prisma.userOnboardingToken.findUnique({ where: { token_hash: tokenHash } });
  if (!record || record.used_at || record.expires_at.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired onboarding token');
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user_id },
      data: { password_hash: passwordHash, is_active: true },
    }),
    prisma.userOnboardingToken.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    }),
  ]);
  auditLog(
    { actor: `user:${record.user_id}`, action: 'onboarding_token_accepted', object_type: 'user', object_id: record.user_id, result: 'success' },
    'User onboarding/password reset token accepted',
  );
  return { status: 'accepted', userId: record.user_id };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getOnboardingEmailStatus() {
  return getEmailDeliveryStatus();
}

async function ensureActiveTenantMembership(userId: string, tenantKey: string, role: LoginResult['user']['role']) {
  await prisma.tenant.upsert({
    where: { tenant_key: tenantKey },
    create: {
      tenant_key: tenantKey,
      name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
      status: 'active',
    },
    update: {},
  });
  const membership = await prisma.tenantMembership.upsert({
    where: {
      tenant_key_user_id: {
        tenant_key: tenantKey,
        user_id: userId,
      },
    },
    create: {
      tenant_key: tenantKey,
      user_id: userId,
      role: role as 'admin' | 'cco' | 'department_head' | 'specialist' | 'reviewer' | 'viewer',
      is_active: true,
    },
    update: {},
  });
  if (!membership.is_active) {
    throw new UnauthorizedError('Tenant membership is disabled');
  }
  return membership;
}
