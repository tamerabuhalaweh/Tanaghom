import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SENSITIVE_KEY_PATTERN = /(^|_)(password|password_hash|secret|token|access_token|refresh_token|api_key|apikey|encrypted|code_verifier|state_hash|hash)(_|$)/i;

export const TENANT_PRIVACY_ADMIN_ROLES = ['admin', 'cco'] as const;
export const TENANT_RETENTION_MODES = [
  'legal_review_required',
  'one_year',
  'three_years',
  'seven_years',
  'forever_after_legal_approval',
] as const;
export const TENANT_PRIVACY_REVIEW_STATUSES = [
  'pending_customer_legal_review',
  'in_review',
  'approved',
  'needs_changes',
] as const;

export type TenantPrivacyAdminRole = (typeof TENANT_PRIVACY_ADMIN_ROLES)[number];
export type TenantRetentionMode = (typeof TENANT_RETENTION_MODES)[number];
export type TenantPrivacyReviewStatus = (typeof TENANT_PRIVACY_REVIEW_STATUSES)[number];

export interface TenantPrivacyPolicy {
  schemaVersion: 'tenant-privacy-policy.v1';
  retentionMode: TenantRetentionMode;
  customRetentionDays: number | null;
  storeConversationLogs: boolean;
  storeVoiceCallTranscripts: boolean;
  storeSocialDmLogs: boolean;
  storeCrmLeadData: boolean;
  exportDeleteRoles: TenantPrivacyAdminRole[];
  legalBasisNotes: string | null;
  customerLegalOwner: string | null;
  dpoOrPrivacyContact: string | null;
}

export interface TenantPrivacyChecklistItem {
  key: string;
  label: string;
  status: 'ready' | 'attention_required' | 'blocked';
  detail: string;
}

export const DEFAULT_TENANT_PRIVACY_POLICY: TenantPrivacyPolicy = {
  schemaVersion: 'tenant-privacy-policy.v1',
  retentionMode: 'legal_review_required',
  customRetentionDays: null,
  storeConversationLogs: true,
  storeVoiceCallTranscripts: true,
  storeSocialDmLogs: true,
  storeCrmLeadData: true,
  exportDeleteRoles: ['admin', 'cco'],
  legalBasisNotes: null,
  customerLegalOwner: null,
  dpoOrPrivacyContact: null,
};

export function canManageTenantPrivacy(role: string): role is TenantPrivacyAdminRole {
  return (TENANT_PRIVACY_ADMIN_ROLES as readonly string[]).includes(role);
}

export function normalizeTenantPrivacyPolicy(value: unknown): TenantPrivacyPolicy {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const retentionMode = (TENANT_RETENTION_MODES as readonly string[]).includes(String(record.retentionMode))
    ? record.retentionMode as TenantRetentionMode
    : DEFAULT_TENANT_PRIVACY_POLICY.retentionMode;
  const exportDeleteRoles = Array.isArray(record.exportDeleteRoles)
    ? record.exportDeleteRoles.filter((role): role is TenantPrivacyAdminRole => canManageTenantPrivacy(String(role)))
    : DEFAULT_TENANT_PRIVACY_POLICY.exportDeleteRoles;

  return {
    schemaVersion: 'tenant-privacy-policy.v1',
    retentionMode,
    customRetentionDays: typeof record.customRetentionDays === 'number' && Number.isFinite(record.customRetentionDays)
      ? Math.max(1, Math.floor(record.customRetentionDays))
      : null,
    storeConversationLogs: typeof record.storeConversationLogs === 'boolean' ? record.storeConversationLogs : true,
    storeVoiceCallTranscripts: typeof record.storeVoiceCallTranscripts === 'boolean' ? record.storeVoiceCallTranscripts : true,
    storeSocialDmLogs: typeof record.storeSocialDmLogs === 'boolean' ? record.storeSocialDmLogs : true,
    storeCrmLeadData: typeof record.storeCrmLeadData === 'boolean' ? record.storeCrmLeadData : true,
    exportDeleteRoles: exportDeleteRoles.length ? exportDeleteRoles : DEFAULT_TENANT_PRIVACY_POLICY.exportDeleteRoles,
    legalBasisNotes: typeof record.legalBasisNotes === 'string' && record.legalBasisNotes.trim() ? record.legalBasisNotes.trim() : null,
    customerLegalOwner: typeof record.customerLegalOwner === 'string' && record.customerLegalOwner.trim() ? record.customerLegalOwner.trim() : null,
    dpoOrPrivacyContact: typeof record.dpoOrPrivacyContact === 'string' && record.dpoOrPrivacyContact.trim() ? record.dpoOrPrivacyContact.trim() : null,
  };
}

export function retentionModeLabel(mode: TenantRetentionMode): string {
  switch (mode) {
    case 'one_year':
      return '1 year';
    case 'three_years':
      return '3 years';
    case 'seven_years':
      return '7 years';
    case 'forever_after_legal_approval':
      return 'Forever after legal approval';
    case 'legal_review_required':
    default:
      return 'Legal review required';
  }
}

export function buildPrivacyReviewChecklist(
  policyInput: unknown,
  reviewStatus: string,
): {
  policy: TenantPrivacyPolicy;
  reviewStatus: TenantPrivacyReviewStatus;
  automationGate: 'blocked' | 'review_required' | 'ready';
  checklist: TenantPrivacyChecklistItem[];
  explanation: string;
} {
  const policy = normalizeTenantPrivacyPolicy(policyInput);
  const normalizedReviewStatus = (TENANT_PRIVACY_REVIEW_STATUSES as readonly string[]).includes(reviewStatus)
    ? reviewStatus as TenantPrivacyReviewStatus
    : 'pending_customer_legal_review';
  const legalApproved = normalizedReviewStatus === 'approved';
  const retentionSelected = policy.retentionMode !== 'legal_review_required';
  const foreverRequiresApproval = policy.retentionMode === 'forever_after_legal_approval' && !legalApproved;
  const dataCategories = [
    policy.storeConversationLogs,
    policy.storeVoiceCallTranscripts,
    policy.storeSocialDmLogs,
    policy.storeCrmLeadData,
  ];

  const checklist: TenantPrivacyChecklistItem[] = [
    {
      key: 'retention_policy',
      label: 'Retention period selected',
      status: retentionSelected ? (foreverRequiresApproval ? 'attention_required' : 'ready') : 'blocked',
      detail: retentionSelected
        ? `${retentionModeLabel(policy.retentionMode)} is configured.`
        : 'Customer asked for forever retention, but this must be converted into an approved retention policy.',
    },
    {
      key: 'export_delete_permissions',
      label: 'Export/delete permissions limited',
      status: policy.exportDeleteRoles.every(role => canManageTenantPrivacy(role)) ? 'ready' : 'blocked',
      detail: 'Export and deletion review actions are limited to executive admin/CCO roles until a dedicated GM role exists.',
    },
    {
      key: 'data_categories',
      label: 'Stored data categories documented',
      status: dataCategories.some(Boolean) ? 'ready' : 'attention_required',
      detail: 'Conversation logs, CRM lead data, voice transcripts, and social DM logs are explicitly controlled here.',
    },
    {
      key: 'legal_owner',
      label: 'Legal/privacy owner captured',
      status: policy.customerLegalOwner || policy.dpoOrPrivacyContact ? 'ready' : 'attention_required',
      detail: policy.customerLegalOwner || policy.dpoOrPrivacyContact
        ? 'Customer legal/privacy owner is recorded.'
        : 'Ask the customer who owns privacy decisions and data subject requests.',
    },
    {
      key: 'legal_basis',
      label: 'Business reason documented',
      status: policy.legalBasisNotes ? 'ready' : 'attention_required',
      detail: policy.legalBasisNotes
        ? 'A business reason for storing audit/conversation data is recorded.'
        : 'Document why conversations, CRM data, voice calls, and social DMs are stored.',
    },
    {
      key: 'formal_review',
      label: 'Formal UAE PDPL/legal review',
      status: legalApproved ? 'ready' : normalizedReviewStatus === 'in_review' ? 'attention_required' : 'blocked',
      detail: legalApproved
        ? 'Formal legal/privacy review is marked approved.'
        : 'Final compliance acceptance must come from the customer/legal counsel before live social/voice automation is treated as production-ready.',
    },
  ];

  return {
    policy,
    reviewStatus: normalizedReviewStatus,
    automationGate: legalApproved ? 'ready' : normalizedReviewStatus === 'in_review' ? 'review_required' : 'blocked',
    checklist,
    explanation: 'UAE PDPL/legal review means confirming what personal data Tanaghum stores, why it is stored, who can export or request deletion, how long it is retained, and whether customer legal counsel approves the policy before live social, CRM, voice, and AI-agent workflows process real people data.',
  };
}

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
