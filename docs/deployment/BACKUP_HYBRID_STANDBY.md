# Hybrid Backup Standby

Last verified: 2026-07-20

## Purpose

This host is an independently deployed Hybrid application recovery target. It provides a second HTTPS endpoint built from the canonical recovery tag without changing the primary Hybrid or AB environments.

Backup URL: `https://tanaghum-backup.155-117-45-45.sslip.io`

Recovery source:

```text
Repository: tamerabuhalaweh/Tanaghom
Tag: hybrid-recovery-2026-07-19
Commit: a1a7edeeb09eb2b83b979eefd509ef783ba8381b
Server path: /opt/tanaghum-backup
```

## Recovery Posture

The deployment is a **warm code standby with an isolated database**. It is not currently a live replica of the primary Hybrid database.

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

Not implemented or claimed:

- Continuous or scheduled replication of primary customer data.
- Automatic DNS failover from the primary Hybrid URL.
- Off-server copy of this standby host's own backup files.
- External alert delivery because no webhook/email destination is configured.
- Live external connector execution; customer credentials, mappings, scopes, and authorization remain required.
- Postiz scheduling; the API key is accepted, but the current workspace exposes no channel and Instagram OAuth still requires provider setup.

## Acceptance Evidence

The live Hybrid Playwright gate passed against the backup URL:

```text
5 passed
- Stitchi prepares an AI-assisted commercial plan without executing before approval.
- Manager, specialist, and admin sessions load without unexpected API or console failures.
- Specialist is kept out of admin connector setup; manager and admin access is permitted.
- Event Operations and Sales & Leads work at desktop and mobile widths.
- Admin executive-report workflow preserves honest delivery readiness.
```

The first restore drill also passed:

```text
PostgreSQL tables restored: 135
Application health validation: passed
Application login validation: passed
```

Evidence paths on the server:

```text
/var/backups/tanaghum-backup/postgres/latest.json
/var/backups/tanaghum-backup/postgres/restore-drill-latest.json
/var/lib/tanaghum-backup/uptime/latest.json
```

## Scheduled Operations

```text
tanaghum-backup-postgres.timer      daily at approximately 02:15 UTC
tanaghum-backup-uptime.timer        every five minutes
tanaghum-backup-restore-drill.timer weekly on Sunday at approximately 03:30 UTC
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

1. Verify the requested recovery release/tag and compare its commit SHA with GitHub.
2. Confirm `/opt/tanaghum-backup/.env.backup`, `docker-compose.backup.yml`, and `Caddyfile.backup` remain server-only and mode `600`.
3. Start the stack from `/opt/tanaghum-backup` with its backup compose file and environment file.
4. Confirm all five Tanaghum containers are running and the application, PostgreSQL, and Redis health checks are healthy.
5. Run the live Hybrid Playwright acceptance gate against the backup URL.
6. If customer data must be recovered, obtain explicit authorization and an approved backup source before replacing the isolated standby database.
7. Validate the restored data in isolation before directing customer traffic.
8. Record the recovery decision, operator, source backup, checksum, validation results, and customer authorization.

## Security Rules

- Never place VPS passwords, application passwords, API keys, database passwords, or provider tokens in this document or GitHub.
- Rotate the VPS password because it was shared out of band during provisioning.
- Keep SSH key access available before considering password-login disablement.
- Customer traffic must not be redirected to this host while it contains isolated seed data.
- External execution flags remain disabled until credentials, mapping, approval, and acceptance evidence exist.

