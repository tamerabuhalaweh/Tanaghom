import { createHash, randomBytes } from 'node:crypto';
import { AppError, ForbiddenError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { encryptSecret, decryptSecret, secretFingerprint } from '@shared/crypto/secret-vault';
import { buildTotpOtpAuthUrl, generateTotpSecret, verifyTotpCode } from '@shared/auth/mfa';

const MFA_ISSUER = process.env.MFA_ISSUER || 'Tanaghum';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_PARTS = 3;
const RECOVERY_CODE_PART_BYTES = 2;

export async function getMfaStatus(userId: string): Promise<{
  enabled: boolean;
  verifiedFactorCount: number;
  pendingSetupCount: number;
  recoveryCodes: {
    total: number;
    unused: number;
    used: number;
  };
}> {
  const [factors, recoveryCodes] = await Promise.all([
    prisma.userMfaFactor.findMany({
      where: { user_id: userId, disabled_at: null },
    }),
    prisma.userMfaRecoveryCode.findMany({
      where: { user_id: userId },
      select: { used_at: true },
    }),
  ]);
  const used = recoveryCodes.filter(code => code.used_at).length;
  return {
    enabled: factors.some(factor => factor.is_verified),
    verifiedFactorCount: factors.filter(factor => factor.is_verified).length,
    pendingSetupCount: factors.filter(factor => !factor.is_verified).length,
    recoveryCodes: {
      total: recoveryCodes.length,
      unused: recoveryCodes.length - used,
      used,
    },
  };
}

export async function getTenantMfaCoverage(tenantKey: string): Promise<{
  adminUsers: number;
  adminUsersWithMfa: number;
  coveragePct: number;
}> {
  const adminUsers = await prisma.user.findMany({
    where: {
      tenant_key: tenantKey,
      is_active: true,
      role: { in: ['admin', 'cco', 'department_head'] },
    },
    select: {
      id: true,
      mfa_factors: {
        where: {
          is_verified: true,
          disabled_at: null,
        },
        select: { id: true },
      },
    },
  });
  const adminUsersWithMfa = adminUsers.filter(user => user.mfa_factors.length > 0).length;
  return {
    adminUsers: adminUsers.length,
    adminUsersWithMfa,
    coveragePct: adminUsers.length ? Math.round((adminUsersWithMfa / adminUsers.length) * 100) : 100,
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
}): Promise<{
  status: 'enabled';
  factorId: string;
  recoveryCodes: string[];
  rawRecoveryCodesReturnedOnce: true;
}> {
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
  const recoveryCodes = await replaceRecoveryCodes(input.requesterUserId);
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'mfa_enabled', object_type: 'user_mfa_factor', object_id: factor.id, result: 'success' },
    'MFA enabled',
  );
  return {
    status: 'enabled',
    factorId: factor.id,
    recoveryCodes,
    rawRecoveryCodesReturnedOnce: true,
  };
}

export async function verifyUserMfaCode(userId: string, code: string): Promise<boolean> {
  const factor = await getActiveVerifiedTotpFactor(userId);
  if (!factor) return true;
  if (isRecoveryCode(code)) return consumeRecoveryCode(userId, code);
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

export async function regenerateRecoveryCodes(input: {
  requesterUserId: string;
  code: string;
}): Promise<{
  recoveryCodes: string[];
  rawRecoveryCodesReturnedOnce: true;
}> {
  const factor = await getActiveVerifiedTotpFactor(input.requesterUserId);
  if (!factor) throw new AppError('MFA is not enabled', 409, 'MFA_NOT_ENABLED');
  if (!verifyTotpCode(decryptSecret(factor.encrypted_secret), input.code)) {
    throw new UnauthorizedError('Invalid authenticator code');
  }
  const recoveryCodes = await replaceRecoveryCodes(input.requesterUserId);
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'mfa_recovery_codes_regenerated', object_type: 'user', object_id: input.requesterUserId, result: 'success' },
    'MFA recovery codes regenerated',
  );
  return {
    recoveryCodes,
    rawRecoveryCodesReturnedOnce: true,
  };
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
  await prisma.$transaction([
    prisma.userMfaFactor.update({
      where: { id: factor.id },
      data: { disabled_at: new Date(), is_verified: false },
    }),
    prisma.userMfaRecoveryCode.deleteMany({
      where: { user_id: input.requesterUserId },
    }),
  ]);
  auditLog(
    { actor: `user:${input.requesterUserId}`, action: 'mfa_disabled', object_type: 'user_mfa_factor', object_id: factor.id, result: 'success' },
    'MFA disabled',
  );
  return { status: 'disabled' };
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => (
    Array.from({ length: RECOVERY_CODE_PARTS }, () => randomBytes(RECOVERY_CODE_PART_BYTES).toString('hex').toUpperCase()).join('-')
  ));
}

export function hashRecoveryCode(userId: string, code: string): string {
  const pepper = process.env.MFA_RECOVERY_CODE_PEPPER || process.env.JWT_SECRET || process.env.SECRET_VAULT_ENCRYPTION_KEY || 'test-only-pepper';
  return createHash('sha256')
    .update(`${userId}:${normalizeRecoveryCode(code)}:${pepper}`)
    .digest('hex');
}

async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.userMfaRecoveryCode.deleteMany({
      where: { user_id: userId },
    }),
    prisma.userMfaRecoveryCode.createMany({
      data: recoveryCodes.map(code => ({
        user_id: userId,
        code_hash: hashRecoveryCode(userId, code),
      })),
    }),
  ]);
  return recoveryCodes;
}

async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const recoveryCode = await prisma.userMfaRecoveryCode.findUnique({
    where: { code_hash: hashRecoveryCode(userId, code) },
  });
  if (!recoveryCode || recoveryCode.user_id !== userId || recoveryCode.used_at) return false;
  await prisma.userMfaRecoveryCode.update({
    where: { id: recoveryCode.id },
    data: { used_at: new Date() },
  });
  auditLog(
    { actor: `user:${userId}`, action: 'mfa_recovery_code_used', object_type: 'user_mfa_recovery_code', object_id: recoveryCode.id, result: 'success' },
    'MFA recovery code used',
  );
  return true;
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function isRecoveryCode(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code.trim());
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
