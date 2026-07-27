# Hybrid Recovery Host And Temporary Production

Last verified: 2026-07-27

## Purpose

This host is the Hybrid recovery target. During the primary VPS incident opened
on 2026-07-27, it is explicitly promoted as temporary production. It provides
the active customer endpoint from the reviewed Hybrid `main` release without
changing the isolated AB environment.

Backup URL: `https://tanaghum-backup.155-117-45-45.sslip.io`

Recovery source:

```text
Repository: tamerabuhalaweh/Tanaghom
Release channel: main
Deployment rule: primary and standby must use the same reviewed main commit
Server path: /opt/tanaghum-backup
```

## Current Operating Posture

Before promotion, the deployment was a warm application standby with an
isolated default database. Promotion requires restoring the latest approved
primary artifact after preserving the standby database and completing the
checks in `docs/operations/DISASTER_RECOVERY_RUNBOOK.md`.

After the recorded promotion timestamp, this host is the source of truth for
new customer writes. It must not be replaced by an older primary snapshot.
Failback requires a final encrypted backup from this host, isolated restore on
the recovered primary, full acceptance, and deliberate traffic redirection.

The production credential-vault key must be held separately in an approved
secret manager or offline escrow. It must not be embedded in database archives
or Git. If the approved key is unavailable during recovery, credential records
remain preserved but unusable; the UI must show `Reconnect required` and owners
must re-enter secrets on the temporary-production host.

Verified capabilities:

- Ubuntu Server 24.04 LTS host with Docker Engine and Docker Compose.
- Caddy-managed HTTPS certificate and HTTP-to-HTTPS routing.
- Separate PostgreSQL and Redis containers with persistent Docker volumes.
- Production application mode with external writes and live execution disabled by default.
- Server-only secrets and initial access material; no secrets committed to Git.
- Gemma provider connectivity for the acceptance users.
- Encrypted tenant Postiz credential and safe Postiz diagnostics.
- Daily PostgreSQL custom-format dump, SHA-256 validation, and `pg_restore --list` verification.
- Weekly isolated restore drill that validates application health and login against the restored database.
- Public application and health probes every five minutes.
- Docker restart policies for application services.
- Daily encrypted primary-database receipt over a dedicated restricted SSH identity.
- Encrypted and decrypted checksum validation before any restore.
- Weekly independent-host restore drill against the received primary backup.
- Thirty-day retention with a minimum of seven local and received artifacts.

Not implemented or claimed:

- Continuous database replication.
- Automatic DNS failover from the primary Hybrid URL.
- Off-server copy of this temporary production host's own backup files until a
  new destination is configured.
- External alert delivery because no webhook/email destination is configured.
- Live external connector execution; customer credentials, mappings, scopes, and authorization remain required.
- Postiz scheduling; the API key is accepted, but the current workspace exposes no channel and Instagram OAuth still requires provider setup.

## Acceptance Evidence

The pre-promotion live gate passed against the isolated backup deployment.
After restoration of the primary data, the gate correctly exposed two
production conditions that must be resolved before final acceptance:

- privileged users are redirected to mandatory MFA enrollment;
- saved credentials require secure re-entry because the primary vault key was
  not available on the recovery host.

The recovery-hardening release converts the credential condition from HTTP 500
errors into an honest `Reconnect required` state. Non-privileged live browser
acceptance passed after deploying release
`8b035a17cac8741f1ba3a5064aadaf0564322b96`. Final privileged and full
role-based acceptance remains pending until all five real privileged owners
enroll MFA.

The post-promotion restore drill also passed:

```text
PostgreSQL tables restored: 137
Application health validation: passed
Application login validation: passed
Critical restored record counts: passed
Credential response sanitization: passed
```

Evidence paths on the server:

```text
/var/backups/tanaghum-backup/postgres/latest.json
/var/backups/tanaghum-backup/postgres/restore-drill-latest.json
/var/lib/tanaghum-backup/uptime/latest.json
/srv/tanaghum-primary/offserver-upload.json
/var/lib/tanaghum-primary-dr/restore-drill-latest.json
```

## Scheduled Operations

```text
tanaghum-backup-postgres.timer      daily at approximately 02:15 UTC
tanaghum-backup-uptime.timer        every five minutes
tanaghum-backup-restore-drill.timer weekly on Sunday at approximately 03:30 UTC
tanaghum-primary-offserver-restore-drill.timer weekly on Sunday at approximately 04:30 UTC
tanaghum-primary-offserver-retention.timer daily at approximately 05:00 UTC
```

Inspect without exposing secrets:

```bash
systemctl list-timers --all | grep tanaghum-backup
systemctl show tanaghum-backup-postgres.service -p Result -p ExecMainStatus
systemctl show tanaghum-backup-uptime.service -p Result -p ExecMainStatus
sudo docker ps --filter name=tanaghum-backup
curl -fsS https://tanaghum-backup.155-117-45-45.sslip.io/api/health
```

## Recovery Procedure

1. Verify the requested recovery release and compare its exact commit SHA with GitHub and the primary Hybrid release.
2. Confirm `/opt/tanaghum-backup/.env.backup`, `docker-compose.backup.yml`, and `Caddyfile.backup` remain server-only and mode `600`.
3. Start the stack from `/opt/tanaghum-backup` with its backup compose file and environment file.
4. Confirm all five Tanaghum containers are running and the application, PostgreSQL, and Redis health checks are healthy.
5. Run the live Hybrid Playwright acceptance gate against the backup URL.
6. If customer data must be recovered, obtain explicit authorization and an approved backup source before replacing the isolated standby database.
7. Validate the restored data in isolation before directing customer traffic.
8. Record the recovery decision, operator, source backup, checksum, validation results, and customer authorization.

The full controlled promotion process is documented in
`docs/operations/DISASTER_RECOVERY_RUNBOOK.md`.

## Security Rules

- Never place VPS passwords, application passwords, API keys, database passwords, or provider tokens in this document or GitHub.
- Rotate the VPS password because it was shared out of band during provisioning.
- Keep SSH key access available before considering password-login disablement.
- Customer traffic may use this host only after the promotion evidence confirms
  that the approved primary recovery artifact was restored and accepted.
- External execution flags remain disabled until credentials, mapping, approval, and acceptance evidence exist.
