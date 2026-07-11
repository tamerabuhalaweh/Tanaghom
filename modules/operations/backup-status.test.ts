import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBackupStatus } from './controller';

const ORIGINAL_ENV = { ...process.env };
let dir = '';

describe('operations backup status', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    dir = mkdtempSync(join(tmpdir(), 'tanaghum-backup-status-'));
    process.env.DATABASE_BACKUP_DIR = dir;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('parses compact backup manifests and restore/off-server evidence', () => {
    const backupFile = join(dir, 'tanaghum-postgres-20260628T093418Z.dump');
    const checksumFile = `${backupFile}.sha256`;
    writeFileSync(backupFile, 'backup');
    writeFileSync(checksumFile, 'checksum');
    writeFileSync(join(dir, 'latest.json'), JSON.stringify({
      timestamp: '20260628T093418Z',
      backupFile,
      checksumFile,
    }));
    writeFileSync(join(dir, 'offserver-latest.json'), JSON.stringify({
      syncedAt: new Date().toISOString(),
      provider: 'rsync',
      encrypted: true,
      status: 'synced',
    }));
    writeFileSync(join(dir, 'restore-drill-latest.json'), JSON.stringify({
      restoredAt: new Date().toISOString(),
      applicationHealthValidation: 'passed',
      applicationLoginValidation: 'passed',
      status: 'passed',
    }));
    process.env.BACKUP_RSYNC_TARGET = 'backup-host:/srv/tanaghum';

    const status = getBackupStatus();

    expect(status.latestBackupFound).toBe(true);
    expect(status.latestBackupAt).toBe('2026-06-28T09:34:18.000Z');
    expect(status.latestChecksumFound).toBe(true);
    expect(status.storageTargetConfigured).toBe(true);
    expect(status.storageProvider).toBe('rsync');
    expect(status.offServerCopyFound).toBe(true);
    expect(status.offServerCopyCurrent).toBe(true);
    expect(status.restoreDrillEvidenceConfigured).toBe(true);
    expect(status.restoreDrillCurrent).toBe(true);
  });

  it('reports missing off-server evidence separately from local backup evidence', () => {
    writeFileSync(join(dir, 'latest.json'), JSON.stringify({
      timestamp: '20260628T093418Z',
      checksumFile: 'tanaghum-postgres.dump.sha256',
    }));

    const status = getBackupStatus();

    expect(status.latestBackupFound).toBe(true);
    expect(status.offServerCopyFound).toBe(false);
    expect(status.storageTargetConfigured).toBe(false);
    expect(status.restoreDrillEvidenceConfigured).toBe(false);
  });

  it('does not treat stale or incomplete evidence as production current', () => {
    const old = '2025-01-01T00:00:00Z';
    writeFileSync(join(dir, 'latest.json'), JSON.stringify({ timestamp: '20250101T000000Z' }));
    writeFileSync(join(dir, 'offserver-latest.json'), JSON.stringify({
      syncedAt: old,
      encrypted: false,
      status: 'synced',
    }));
    writeFileSync(join(dir, 'restore-drill-latest.json'), JSON.stringify({
      restoredAt: old,
      status: 'passed',
    }));

    const status = getBackupStatus();

    expect(status.latestBackupCurrent).toBe(false);
    expect(status.offServerCopyFound).toBe(true);
    expect(status.offServerCopyCurrent).toBe(false);
    expect(status.restoreDrillEvidenceConfigured).toBe(true);
    expect(status.restoreDrillCurrent).toBe(false);
  });
});
