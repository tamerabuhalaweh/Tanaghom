import { describe, expect, it } from 'vitest';
import { buildDeletionReadiness, sanitizeTenantExportValue } from './lifecycle';

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
      pendingApprovals: 0,
      pendingPackages: 0,
      exportGenerated: true,
    });

    expect(ready.deletionReady).toBe(true);
    expect(ready.supportedAction).toBe('archive_then_offline_purge_job');
  });
});
