# Hybrid Disaster Recovery Runbook

Last reviewed: 2026-07-25

## Recovery Topology

| Responsibility | Environment |
| --- | --- |
| Active Hybrid application and customer database | `163.123.180.104` |
| Warm Hybrid application standby and encrypted primary backup receiver | `155.117.45.45` |
| Primary customer URL | `https://tanaghum-hybrid.163-123-180-104.sslip.io` |
| Standby validation URL | `https://tanaghum-backup.155-117-45-45.sslip.io` |

The standby URL is an independently running application used for recovery validation. It must not receive customer traffic merely because it is online. Promotion requires an incident decision and a validated restore of the approved primary backup.

## Backup Flow

1. The primary host creates a PostgreSQL custom-format dump every day.
2. The primary host writes a SHA-256 checksum and sanitized manifest.
3. After the local backup window, the primary host encrypts the dump with AES-256-CBC and PBKDF2-SHA256.
4. Only the encrypted artifact, encrypted checksum, and sanitized upload manifest are transferred through a dedicated restricted rsync-over-SSH identity.
5. The standby validates the encrypted checksum, decrypts into a temporary file, and validates the decrypted source checksum against the primary manifest.
6. A scheduled standby drill restores the dump into a temporary database, starts an isolated application container, validates health and login, records critical table counts, and removes the temporary database.
7. Retention runs only after a successful backup. It preserves at least seven artifacts and defaults to 30 days.

No raw PostgreSQL dump is transferred from the primary host.

## Target Recovery Objectives

These are engineering operating targets until contractually approved:

- Database RPO: 24 hours.
- Application-only RTO: 1 hour.
- Database recovery RTO: 4 hours.
- Primary local retention: 30 days, minimum seven backups.
- Standby encrypted-copy retention: 30 days, minimum seven backups.
- Independent restore drill: weekly and before material go-live releases.

## Daily Verification

On the primary host:

```bash
systemctl show tanaghum-postgres-backup.service -p Result -p ExecMainStatus
systemctl show tanaghum-backup-offserver-sync.service -p Result -p ExecMainStatus
cat /var/backups/tanaghum/postgres/latest.json
cat /var/backups/tanaghum/postgres/offserver-latest.json
```

On the standby host:

```bash
sha256sum --check /srv/tanaghum-primary/<encrypted-backup>.sha256
systemctl show tanaghum-primary-offserver-restore-drill.service -p Result -p ExecMainStatus
cat /var/lib/tanaghum-primary-dr/restore-drill-latest.json
```

Do not place passphrases, SSH private keys, application passwords, tokens, or raw target credentials in tickets or evidence.

## Promotion Decision

Only the named Incident Commander may authorize recovery promotion. Before promotion:

1. Identify the incident and affected tenant.
2. Disable external execution and connector write flags.
3. Select the latest approved encrypted primary backup.
4. Verify encrypted and decrypted checksums.
5. Restore into an isolated database.
6. Validate table counts, tenant isolation, application health, and login.
7. Record measured backup age and recovery duration.
8. Obtain customer authorization if recovery may discard newer data.
9. Restore into the standby production database only after the isolated drill passes.
10. Run migrations for the deployed application release.
11. Run authenticated browser acceptance.
12. Direct traffic only through an approved DNS or customer-domain change.

The current `sslip.io` URLs encode their server IP addresses. They do not support transparent automatic failover. Customer traffic therefore requires a deliberate URL or future managed-DNS change.

## Recovery Validation

Required checks after restoring:

- `/api/health` returns 200 and reports application, PostgreSQL, and Redis healthy.
- Login succeeds for an approved recovery-test account.
- Tenant-scoped records remain isolated.
- Commercial planning, Events, Content, Sales & Leads, and Stitchi read paths load.
- Integration credentials remain encrypted and raw values are never returned.
- External execution remains disabled until connector-specific reauthorization.
- Audit and request-ID evidence remains available.
- No unexpected browser console or failed API responses appear in acceptance paths.

## Rollback

If standby promotion validation fails:

1. Do not redirect customer traffic.
2. Preserve the failed database and application logs.
3. Return to the isolated standby database.
4. Select the preceding verified encrypted backup.
5. Repeat checksum, restore, migration, and browser validation.
6. Record the failed artifact, failure stage, request IDs, operator, and corrective action.

## Remaining External Acceptance

The following cannot be completed by repository or VPS automation alone:

- Named Incident Commander, Technical Lead, Security Lead, and customer contact.
- Contractual approval of RPO and RTO.
- Approved human-facing alert destination and escalation recipients.
- Independent penetration-test report and closure of critical/high findings.
- A third storage location if policy requires backup copies beyond primary plus standby.

