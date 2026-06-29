import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SENSITIVE_KEY_PATTERN = /(^|_)(password|password_hash|secret|token|access_token|refresh_token|api_key|apikey|encrypted|code_verifier|state_hash|hash)(_|$)/i;

export interface TenantDeletionReadinessInput {
  tenantStatus: string;
  activeUsers: number;
  activeMemberships: number;
  activeCredentials: number;
  activeSubscriptions: number;
  pendingApprovals: number;
  pendingPackages: number;
  exportGenerated: boolean;
}

export interface TenantExportEvidence {
  schemaVersion: 'tenant-export-evidence.v1';
  tenantKey: string;
  generatedAt: string;
  bundleHash: string;
  counts: Record<string, unknown>;
  redactionPolicy: {
    passwordHashesReturned: false;
    rawSecretsReturned: false;
    encryptedSecretsReturned: false;
    oauthTokensReturned: false;
    apiKeysReturned: false;
  };
}

export interface TenantPurgeEvaluationInput extends TenantDeletionReadinessInput {
  tenantKey: string;
  dryRun: boolean;
  purgeEnabled: boolean;
  confirmation?: string;
}

export function sanitizeTenantExportValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => sanitizeTenantExportValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '<redacted>' : sanitizeTenantExportValue(nested),
    ]),
  );
}

export function safeTenantKeySegment(tenantKey: string): string {
  return tenantKey.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'tenant';
}

export function tenantExportEvidenceDir(): string {
  return process.env.TENANT_EXPORT_EVIDENCE_DIR || './ops/tenant-exports';
}

export function tenantExportEvidencePath(tenantKey: string): string {
  return join(tenantExportEvidenceDir(), `${safeTenantKeySegment(tenantKey)}-latest.json`);
}

export function buildTenantExportEvidence(tenantKey: string, exportBundle: Record<string, unknown>): TenantExportEvidence {
  const sanitizedBundle = sanitizeTenantExportValue(exportBundle) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitizedBundle);
  return {
    schemaVersion: 'tenant-export-evidence.v1',
    tenantKey,
    generatedAt: new Date().toISOString(),
    bundleHash: createHash('sha256').update(serialized).digest('hex'),
    counts: typeof sanitizedBundle.counts === 'object' && sanitizedBundle.counts !== null
      ? sanitizedBundle.counts as Record<string, unknown>
      : {},
    redactionPolicy: {
      passwordHashesReturned: false,
      rawSecretsReturned: false,
      encryptedSecretsReturned: false,
      oauthTokensReturned: false,
      apiKeysReturned: false,
    },
  };
}

export function recordTenantExportEvidence(tenantKey: string, exportBundle: Record<string, unknown>): TenantExportEvidence {
  const evidence = buildTenantExportEvidence(tenantKey, exportBundle);
  const evidenceDir = tenantExportEvidenceDir();
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(tenantExportEvidencePath(tenantKey), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

export function readTenantExportEvidence(tenantKey: string): TenantExportEvidence | null {
  const evidencePath = tenantExportEvidencePath(tenantKey);
  if (existsSync(evidencePath)) {
    try {
      return JSON.parse(readFileSync(evidencePath, 'utf8')) as TenantExportEvidence;
    } catch {
      return null;
    }
  }
  if (process.env.LATEST_TENANT_EXPORT_AT) {
    return {
      schemaVersion: 'tenant-export-evidence.v1',
      tenantKey,
      generatedAt: process.env.LATEST_TENANT_EXPORT_AT,
      bundleHash: 'external-evidence-not-recorded-locally',
      counts: {},
      redactionPolicy: {
        passwordHashesReturned: false,
        rawSecretsReturned: false,
        encryptedSecretsReturned: false,
        oauthTokensReturned: false,
        apiKeysReturned: false,
      },
    };
  }
  return null;
}

export function buildDeletionReadiness(input: TenantDeletionReadinessInput) {
  const blockers: string[] = [];
  if (!input.exportGenerated) blockers.push('Tenant export evidence must be generated and retained before deletion.');
  if (input.tenantStatus !== 'archived') blockers.push('Tenant must be archived before deletion review.');
  if (input.activeUsers > 0) blockers.push('Active users must be deactivated or migrated before deletion.');
  if (input.activeMemberships > 0) blockers.push('Active memberships must be disabled before deletion.');
  if (input.activeCredentials > 0) blockers.push('Active tenant credentials must be revoked before deletion.');
  if (input.activeSubscriptions > 0) blockers.push('Active tenant subscriptions must be cancelled or expired before deletion.');
  if (input.pendingApprovals > 0) blockers.push('Pending approvals must be resolved before deletion.');
  if (input.pendingPackages > 0) blockers.push('Pending publishing packages must be resolved before deletion.');

  return {
    deletionReady: blockers.length === 0,
    hardDeleteAvailableFromUi: false,
    supportedAction: 'archive_then_offline_purge_job',
    requiresHumanReview: true,
    requiresLegalRetentionReview: true,
    blockers,
    policy: {
      exportBeforeDelete: true,
      revokeCredentialsBeforeDelete: true,
      preserveAuditLogs: true,
      productionPurgeJobRequired: true,
    },
  };
}

export function tenantPurgeConfirmationPhrase(tenantKey: string): string {
  return `PURGE_TENANT_${tenantKey}`;
}

export function buildTenantPurgeEvaluation(input: TenantPurgeEvaluationInput) {
  const readiness = buildDeletionReadiness(input);
  const executionBlockers = [...readiness.blockers];
  if (!input.dryRun && !input.purgeEnabled) {
    executionBlockers.push('TENANT_PURGE_ENABLED=true is required for execution.');
  }
  if (!input.dryRun && input.confirmation !== tenantPurgeConfirmationPhrase(input.tenantKey)) {
    executionBlockers.push(`Confirmation phrase must be ${tenantPurgeConfirmationPhrase(input.tenantKey)}.`);
  }

  return {
    tenantKey: input.tenantKey,
    dryRun: input.dryRun,
    canInspect: true,
    canExecute: !input.dryRun && executionBlockers.length === 0,
    supportedExecutionMode: 'application_data_purge_preserve_audit_identity_shell',
    confirmationPhrase: tenantPurgeConfirmationPhrase(input.tenantKey),
    blockers: executionBlockers,
    readiness,
    policy: {
      hardDeleteFromUi: false,
      preserveAuditLogs: true,
      preserveIdentityShell: true,
      requiresArchivedTenant: true,
      requiresExportEvidence: true,
      requiresCredentialRevocation: true,
      requiresHumanConfirmation: true,
      requiresEnvironmentEnablement: true,
    },
  };
}
