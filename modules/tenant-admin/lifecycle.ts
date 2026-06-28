const SENSITIVE_KEY_PATTERN = /(^|_)(password|password_hash|secret|token|access_token|refresh_token|api_key|apikey|encrypted|code_verifier|state_hash|hash)(_|$)/i;

export interface TenantDeletionReadinessInput {
  tenantStatus: string;
  activeUsers: number;
  activeMemberships: number;
  activeCredentials: number;
  pendingApprovals: number;
  pendingPackages: number;
  exportGenerated: boolean;
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

export function buildDeletionReadiness(input: TenantDeletionReadinessInput) {
  const blockers: string[] = [];
  if (!input.exportGenerated) blockers.push('Tenant export evidence must be generated and retained before deletion.');
  if (input.tenantStatus !== 'archived') blockers.push('Tenant must be archived before deletion review.');
  if (input.activeUsers > 0) blockers.push('Active users must be deactivated or migrated before deletion.');
  if (input.activeMemberships > 0) blockers.push('Active memberships must be disabled before deletion.');
  if (input.activeCredentials > 0) blockers.push('Active tenant credentials must be revoked before deletion.');
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
