import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { encryptSecret, decryptSecret, secretFingerprint } from '@shared/crypto/secret-vault';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { auditLog } from '@shared/logging';

export const integrationProviderSchema = z.enum([
  'postiz',
  'gohighlevel',
  'whatsapp',
  'telegram',
  'voice_chat',
  'smartlabs_voice',
  'social_oauth',
  'openclaw',
  'agentgateway',
  'agentscope',
]);

export const credentialTypeSchema = z.enum([
  'api_key',
  'oauth_client',
  'oauth_token',
  'webhook_secret',
  'bot_token',
  'service_endpoint',
  'runtime_endpoint',
]);

export const upsertIntegrationCredentialSchema = z.object({
  tenantKey: z.string().trim().min(1).max(80).default('default'),
  provider: integrationProviderSchema,
  credentialType: credentialTypeSchema,
  connectionKey: z.string().trim().min(1).max(120).regex(/^[a-z0-9._:-]+$/i, 'Connection key may contain letters, numbers, dots, underscores, colons, and dashes').default('default'),
  displayName: z.string().trim().min(2).max(160),
  secrets: z.record(z.string().trim().min(1).max(20000)).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one secret field is required',
  }),
  metadata: z.record(z.unknown()).optional(),
});

export type UpsertIntegrationCredentialInput = z.infer<typeof upsertIntegrationCredentialSchema>;

export interface SafeIntegrationCredential {
  id: string;
  tenantKey: string;
  provider: string;
  credentialType: string;
  connectionKey: string;
  displayName: string;
  secretFields: string[];
  secretFingerprints: Record<string, string>;
  metadata: unknown;
  isActive: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  lastValidatedAt: Date | null;
  rawSecretsReturned: false;
}

export interface DecryptedIntegrationCredential {
  id: string;
  tenantKey: string;
  provider: string;
  credentialType: string;
  connectionKey: string;
  displayName: string;
  secrets: Record<string, string>;
  metadata: Record<string, unknown>;
}

export function requireCredentialAdmin(role: string): void {
  if (role !== 'admin' && role !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required for tenant integration credentials');
  }
}

export async function listIntegrationCredentials(role: string, tenantKey = 'default'): Promise<SafeIntegrationCredential[]> {
  requireCredentialAdmin(role);
  const credentials = await prisma.integrationCredential.findMany({
    where: { tenant_key: tenantKey },
    orderBy: [{ provider: 'asc' }, { credential_type: 'asc' }],
  });
  return credentials.map(toSafeCredential);
}

export async function upsertIntegrationCredential(
  role: string,
  userId: string,
  input: UpsertIntegrationCredentialInput,
): Promise<SafeIntegrationCredential> {
  requireCredentialAdmin(role);
  const encryptedPayload = encryptPayload(input.secrets);
  const fingerprints = fingerprintPayload(input.secrets);
  const credential = await prisma.integrationCredential.upsert({
    where: {
      tenant_key_provider_credential_type_connection_key: {
        tenant_key: input.tenantKey,
        provider: input.provider,
        credential_type: input.credentialType,
        connection_key: input.connectionKey,
      },
    },
    create: {
      tenant_key: input.tenantKey,
      provider: input.provider,
      credential_type: input.credentialType,
      connection_key: input.connectionKey,
      display_name: input.displayName,
      encrypted_payload: encryptedPayload as Prisma.InputJsonValue,
      secret_fingerprints: fingerprints as Prisma.InputJsonValue,
      metadata: toPrismaJson(input.metadata),
      created_by_user_id: userId,
      is_active: true,
    },
    update: {
      display_name: input.displayName,
      encrypted_payload: encryptedPayload as Prisma.InputJsonValue,
      secret_fingerprints: fingerprints as Prisma.InputJsonValue,
      metadata: toPrismaJson(input.metadata),
      is_active: true,
    },
  });

  auditLog(
    {
      actor: `user:${userId}`,
      action: 'integration_credential_saved',
      object_type: 'integration_credential',
      object_id: credential.id,
      result: 'success',
    },
    `Tenant integration credential saved for ${input.provider}/${input.credentialType}`,
  );

  return toSafeCredential(credential);
}

export async function deactivateIntegrationCredential(role: string, userId: string, id: string): Promise<SafeIntegrationCredential> {
  requireCredentialAdmin(role);
  const existing = await prisma.integrationCredential.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('IntegrationCredential', id);
  const credential = await prisma.integrationCredential.update({
    where: { id },
    data: { is_active: false },
  });
  auditLog(
    {
      actor: `user:${userId}`,
      action: 'integration_credential_disabled',
      object_type: 'integration_credential',
      object_id: id,
      result: 'success',
    },
    `Tenant integration credential disabled for ${credential.provider}/${credential.credential_type}`,
  );
  return toSafeCredential(credential);
}

export async function getActiveIntegrationCredential(
  provider: z.infer<typeof integrationProviderSchema>,
  credentialType: z.infer<typeof credentialTypeSchema>,
  tenantKey = 'default',
  connectionKey = 'default',
): Promise<DecryptedIntegrationCredential | null> {
  const credential = await prisma.integrationCredential.findUnique({
    where: {
      tenant_key_provider_credential_type_connection_key: {
        tenant_key: tenantKey,
        provider,
        credential_type: credentialType,
        connection_key: connectionKey,
      },
    },
  });
  if (!credential?.is_active) return null;
  return {
    id: credential.id,
    tenantKey: credential.tenant_key,
    provider: credential.provider,
    credentialType: credential.credential_type,
    connectionKey: credential.connection_key,
    displayName: credential.display_name,
    secrets: decryptPayload(credential.encrypted_payload),
    metadata: normalizeMetadata(credential.metadata),
  };
}

export async function hasActiveIntegrationCredential(
  provider: z.infer<typeof integrationProviderSchema>,
  credentialType: z.infer<typeof credentialTypeSchema>,
  tenantKey = 'default',
  connectionKey = 'default',
): Promise<boolean> {
  const count = await prisma.integrationCredential.count({
    where: {
      tenant_key: tenantKey,
      provider,
      credential_type: credentialType,
      connection_key: connectionKey,
      is_active: true,
    },
  });
  return count > 0;
}

function encryptPayload(secrets: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([key, value]) => [key, encryptSecret(value)]));
}

function decryptPayload(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? decryptSecret(value) : '']),
  );
}

function fingerprintPayload(secrets: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([key, value]) => [key, secretFingerprint(value)]));
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function toSafeCredential(credential: {
  id: string;
  tenant_key: string;
  provider: string;
  credential_type: string;
  connection_key: string;
  display_name: string;
  encrypted_payload: unknown;
  secret_fingerprints: unknown;
  metadata: unknown;
  created_by_user_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_validated_at: Date | null;
}): SafeIntegrationCredential {
  const encrypted = normalizeMetadata(credential.encrypted_payload);
  return {
    id: credential.id,
    tenantKey: credential.tenant_key,
    provider: credential.provider,
    credentialType: credential.credential_type,
    connectionKey: credential.connection_key,
    displayName: credential.display_name,
    secretFields: Object.keys(encrypted),
    secretFingerprints: normalizeMetadata(credential.secret_fingerprints) as Record<string, string>,
    metadata: credential.metadata,
    isActive: credential.is_active,
    createdByUserId: credential.created_by_user_id,
    createdAt: credential.created_at,
    updatedAt: credential.updated_at,
    lastValidatedAt: credential.last_validated_at,
    rawSecretsReturned: false,
  };
}
