import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildDeletionReadiness,
  buildTenantPurgeEvaluation,
  readTenantExportEvidence,
  recordTenantExportEvidence,
  safeTenantKeySegment,
  sanitizeTenantExportValue,
  tenantPurgeConfirmationPhrase,
} from './lifecycle';
import {
  DEFAULT_PRODUCTION_ENTITLEMENTS,
  buildSubscriptionHealth,
  mergeEntitlements,
} from './subscription';

describe('tenant lifecycle production controls', () => {
  it('redacts sensitive values from tenant exports', () => {
    const sanitized = sanitizeTenantExportValue({
      id: 'tenant-1',
      password_hash: 'must-not-leak',
      encrypted_api_key: 'must-not-leak',
      nested: {
        access_token: 'must-not-leak',
        safeLabel: 'safe',
      },
      items: [
        {
          code_verifier: 'must-not-leak',
          status: 'connected',
        },
      ],
      integrationCredentials: [
        {
          provider: 'postiz',
          credential_type: 'api_key',
          encrypted_payload: 'must-not-leak',
        },
      ],
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).toContain('integrationCredentials');
    expect(serialized).toContain('credential_type');
    expect(serialized).toContain('safe');
    expect(serialized).toContain('connected');
  });

  it('blocks tenant deletion readiness until archive, export, and operational blockers are cleared', () => {
    const blocked = buildDeletionReadiness({
      tenantStatus: 'active',
      activeUsers: 2,
      activeMemberships: 2,
      activeCredentials: 1,
      activeSubscriptions: 1,
      pendingApprovals: 1,
      pendingPackages: 1,
      exportGenerated: false,
    });

    expect(blocked.deletionReady).toBe(false);
    expect(blocked.hardDeleteAvailableFromUi).toBe(false);
    expect(blocked.blockers.length).toBeGreaterThanOrEqual(6);

    const ready = buildDeletionReadiness({
      tenantStatus: 'archived',
      activeUsers: 0,
      activeMemberships: 0,
      activeCredentials: 0,
      activeSubscriptions: 0,
      pendingApprovals: 0,
      pendingPackages: 0,
      exportGenerated: true,
    });

    expect(ready.deletionReady).toBe(true);
    expect(ready.supportedAction).toBe('archive_then_offline_purge_job');
  });

  it('records tenant export evidence without raw exported secrets', () => {
    const previousEvidenceDir = process.env.TENANT_EXPORT_EVIDENCE_DIR;
    const dir = mkdtempSync(join(tmpdir(), 'tanaghum-tenant-export-'));
    process.env.TENANT_EXPORT_EVIDENCE_DIR = dir;
    try {
      const evidence = recordTenantExportEvidence('customer/acme', {
        schemaVersion: 'tenant-export.v1',
        counts: { users: 1 },
        data: {
          credentials: [{
            provider: 'postiz',
            encrypted_payload: 'must-not-leak',
            access_token: 'must-not-leak',
          }],
        },
      });
      const loaded = readTenantExportEvidence('customer/acme');
      const evidenceFile = readFileSync(join(dir, `${safeTenantKeySegment('customer/acme')}-latest.json`), 'utf8');

      expect(evidence.schemaVersion).toBe('tenant-export-evidence.v1');
      expect(evidence.tenantKey).toBe('customer/acme');
      expect(evidence.counts).toEqual({ users: 1 });
      expect(loaded?.bundleHash).toBe(evidence.bundleHash);
      expect(evidenceFile).not.toContain('must-not-leak');
      expect(evidenceFile).not.toContain('encrypted_payload');
      expect(evidenceFile).toContain('tenant-export-evidence.v1');
    } finally {
      if (previousEvidenceDir === undefined) delete process.env.TENANT_EXPORT_EVIDENCE_DIR;
      else process.env.TENANT_EXPORT_EVIDENCE_DIR = previousEvidenceDir;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires explicit environment enablement and confirmation phrase for tenant purge execution', () => {
    const dryRun = buildTenantPurgeEvaluation({
      tenantKey: 'default',
      tenantStatus: 'active',
      activeUsers: 1,
      activeMemberships: 1,
      activeCredentials: 1,
      activeSubscriptions: 1,
      pendingApprovals: 1,
      pendingPackages: 1,
      exportGenerated: false,
      dryRun: true,
      purgeEnabled: false,
    });
    expect(dryRun.canInspect).toBe(true);
    expect(dryRun.canExecute).toBe(false);
    expect(dryRun.blockers).toContain('Tenant must be archived before deletion review.');

    const blockedExecution = buildTenantPurgeEvaluation({
      tenantKey: 'default',
      tenantStatus: 'archived',
      activeUsers: 0,
      activeMemberships: 0,
      activeCredentials: 0,
      activeSubscriptions: 0,
      pendingApprovals: 0,
      pendingPackages: 0,
      exportGenerated: true,
      dryRun: false,
      purgeEnabled: false,
      confirmation: tenantPurgeConfirmationPhrase('default'),
    });
    expect(blockedExecution.canExecute).toBe(false);
    expect(blockedExecution.blockers).toContain('TENANT_PURGE_ENABLED=true is required for execution.');

    const executable = buildTenantPurgeEvaluation({
      tenantKey: 'default',
      tenantStatus: 'archived',
      activeUsers: 0,
      activeMemberships: 0,
      activeCredentials: 0,
      activeSubscriptions: 0,
      pendingApprovals: 0,
      pendingPackages: 0,
      exportGenerated: true,
      dryRun: false,
      purgeEnabled: true,
      confirmation: tenantPurgeConfirmationPhrase('default'),
    });
    expect(executable.canExecute).toBe(true);
    expect(executable.supportedExecutionMode).toBe('application_data_purge_preserve_audit_identity_shell');
  });

  it('evaluates tenant subscription service access and entitlement overrides', () => {
    const healthy = buildSubscriptionHealth({
      tenantStatus: 'active',
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24),
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
      entitlementOverrides: { maxUsers: 40 },
    });

    expect(healthy.serviceAccess).toBe(true);
    expect(healthy.entitlements.maxUsers).toBe(40);
    expect(healthy.entitlements.postizSandboxScheduling).toBe(true);
    expect(healthy.productionPaymentProvider).toBe('not_configured');

    const blocked = buildSubscriptionHealth({
      tenantStatus: 'active',
      subscriptionStatus: 'expired',
      currentPeriodEnd: new Date(Date.now() - 1000 * 60),
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    });

    expect(blocked.serviceAccess).toBe(false);
    expect(blocked.blockers).toContain('Subscription is expired.');
    expect(blocked.blockers).toContain('Current subscription period has expired.');
  });

  it('ignores non-object entitlement overrides', () => {
    expect(mergeEntitlements({ maxUsers: 10 }, null)).toEqual({ maxUsers: 10 });
    expect(mergeEntitlements({ maxUsers: 10 }, ['bad'])).toEqual({ maxUsers: 10 });
  });
});
