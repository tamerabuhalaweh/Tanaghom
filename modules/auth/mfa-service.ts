import { AppError, ForbiddenError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { encryptSecret, decryptSecret, secretFingerprint } from '@shared/crypto/secret-vault';
import { buildTotpOtpAuthUrl, generateTotpSecret, verifyTotpCode } from '@shared/auth/mfa';

const MFA_ISSUER = process.env.MFA_ISSUER || 'Tanaghum';

export async function getMfaStatus(userId: string): Promise<{
  enabled: boolean;
  verifiedFactorCount: number;
  pendingSetupCount: number;
}> {
  const factors = await prisma.userMfaFactor.findMany({
    where: { user_id: userId, disabled_at: null },
  });
  return {
    enabled: factors.some(factor => factor.is_verified),
    verifiedFactorCount: factors.filter(factor => factor.is_verified).length,
    pendingSetupCount: factors.filter(factor => !factor.is_verified).length,
  };
}

export async function startTotpSetup(input: {
  requesterUserId: string;
  userId: string;
  email: string;
}): Promise<{
  factorId: string;
  secret: string;
  otpauthUrl: string;
  rawSecretReturnedOnce: true;
}> {
  if (input.requesterUserId !== input.userId) {
    throw new ForbiddenError('Users can only configure MFA for their own account');
  }
  const secret = generateTotpSecret();
  const factor = await prisma.userMfaFactor.create({
    data: {
      user_id: input.userId,
      factor_type: 'totp',
      encrypted_secret: encryptSecret(secret),
      secret_fingerprint: secretFingerprint(secret),
      label: 'Authenticator app',
      is_verified: false,
    },
  });
  auditLog(
    { actor: `user:${input.userId}`, action: 'mfa_setup_started', object_type: 'user_mfa_factor', object_id: factor.id, result: 'success' },
    'MFA setup started',
  );
  return {
    factorId: factor.id,
    secret,
    otpauthUrl: buildTotpOtpAuthUrl({ issuer: MFA_ISSUER, accountName: input.email, secret }),
    rawSecretReturnedOnce: true,
  };
}

export async function verifyTotpSetup(input: {
  requesterUserId: string;
  factorId: string;
  code: string;
}): Promise<{ status: 'enabled'; factorId: string }> {
  const factor = await prisma.userMfaFactor.findFirst({
    where: {
      id: input.factorId,
      user_id: input.requesterUserId,
      disabled_at: null,
    },
  });
  if (!factor) throw new UnauthorizedError('MFA factor not found');
  if (!verifyTotpCode(decryptSecret(factor.encrypted_secret), input.code)) {
    throw new UnauthorizedError('Invalid authenticator code');
  }
  await prisma.userMfaFactor.update({
    where: { id: factor.id },
    data: {
      is_verified: true,
      enabled_at: new Date(),
      last_used_at: new Date(),
    },
  });
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'mfa_enabled', object_type: 'user_mfa_factor', object_id: factor.id, result: 'success' },
    'MFA enabled',
  );
  return { status: 'enabled', factorId: factor.id };
}

export async function verifyUserMfaCode(userId: string, code: string): Promise<boolean> {
  const factor = await getActiveVerifiedTotpFactor(userId);
  if (!factor) return true;
  const valid = verifyTotpCode(decryptSecret(factor.encrypted_secret), code);
  if (valid) {
    await prisma.userMfaFactor.update({
      where: { id: factor.id },
      data: { last_used_at: new Date() },
    });
  }
  return valid;
}

export async function assertMfaSatisfied(userId: string, code?: string): Promise<void> {
  const factor = await getActiveVerifiedTotpFactor(userId);
  if (!factor) return;
  if (!code) {
    throw new AppError('Authenticator code required', 401, 'MFA_REQUIRED');
  }
  if (!await verifyUserMfaCode(userId, code)) {
    throw new UnauthorizedError('Invalid authenticator code');
  }
}

export async function disableTotpMfa(input: {
  requesterUserId: string;
  code: string;
}): Promise<{ status: 'disabled' }> {
  const factor = await getActiveVerifiedTotpFactor(input.requesterUserId);
  if (!factor) throw new AppError('MFA is not enabled', 409, 'MFA_NOT_ENABLED');
  if (!verifyTotpCode(decryptSecret(factor.encrypted_secret), input.code)) {
    throw new UnauthorizedError('Invalid authenticator code');
  }
  await prisma.userMfaFactor.update({
    where: { id: factor.id },
    data: { disabled_at: new Date(), is_verified: false },
  });
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'mfa_disabled', object_type: 'user_mfa_factor', object_id: factor.id, result: 'success' },
    'MFA disabled',
  );
  return { status: 'disabled' };
}

async function getActiveVerifiedTotpFactor(userId: string) {
  return prisma.userMfaFactor.findFirst({
    where: {
      user_id: userId,
      factor_type: 'totp',
      is_verified: true,
      disabled_at: null,
    },
    orderBy: { enabled_at: 'desc' },
  });
}
