# Production Operations Runbook

## Scope

This runbook covers the production Commercial/Social platform operations baseline:

- readiness checks
- backups
- restore verification
- alerting
- incident response
- credential ownership

## Readiness Endpoints

Admin-only endpoints:

- `GET /ops/readiness`
- `GET /ops/metrics`
- `GET /ops/backup/status`
- `GET /ops/monitoring/status`

Machine metrics endpoint:

- `GET /ops/prometheus`
- Requires `OPERATIONS_METRICS_TOKEN` as a bearer token.

The readiness endpoint checks:

- database health
- Redis health
- secret vault key presence
- JWT secret minimum length
- explicit CORS origin
- email delivery configuration when enabled
- backup target configuration
- latest local backup manifest
- alert destination configuration
- admin MFA coverage
- Prometheus metrics token configuration

## Required Production Environment

Required:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SECRET_VAULT_ENCRYPTION_KEY`
- `CORS_ORIGIN`
- `OPERATIONS_METRICS_TOKEN`

Recommended:

- `REQUEST_BODY_LIMIT=1mb`
- `RATE_LIMIT_WINDOW_SECONDS=60`
- `RATE_LIMIT_MAX_REQUESTS=100`
- `DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres`
- `DATABASE_BACKUP_CRON=<documented backup schedule>`
- `BACKUP_STORAGE_TARGET=<off-server backup destination>`
- `BACKUP_RSYNC_TARGET=<rsync destination>` or `BACKUP_S3_URI=<s3-compatible destination>`
- `ALERT_WEBHOOK_URL=<ops alert webhook>`
- `OPERATIONS_ALERT_EMAIL=<ops email>`
- `PUBLIC_HEALTH_URL=<public /health URL for uptime monitor>`
- `PUBLIC_APP_URL=<public app URL for uptime monitor>`
- `UPTIME_CHECK_EVIDENCE_PATH=/var/lib/tanaghum/uptime/latest.json`
- `LATEST_RESTORE_DRILL_AT=<ISO timestamp after a successful restore drill>`
- `EMAIL_DELIVERY_ENABLED=true`
- SMTP settings when email delivery is enabled
- `MFA_RECOVERY_CODE_PEPPER=<stable secret pepper for recovery-code hashes>`

## Customer-Owned Integration Credentials

The platform must not use hardcoded shared customer credentials.

Each tenant/customer configures their own:

- AI provider key
- Postiz API key and channel ID
- GoHighLevel API key and location ID
- WhatsApp/Telegram/voice credentials
- social OAuth client credentials
- SmartLabs voice credentials (`smartlabs_voice` provider in tenant credential vault)

GoHighLevel environment fallback is disabled by default. Do not enable `ALLOW_GLOBAL_GHL_CREDENTIALS=true` for multi-tenant SaaS unless there is a documented enterprise-hosted exception.

## Backup

Run on the server:

```bash
chmod +x scripts/backup-postgres.sh
DATABASE_URL="$DATABASE_URL" DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres ./scripts/backup-postgres.sh
```

For the Docker-based VPS deployment, prefer:

```bash
chmod +x scripts/backup-postgres-docker.sh scripts/verify-postgres-backup-docker.sh
DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres ./scripts/backup-postgres-docker.sh
```

Backup output:

- PostgreSQL custom dump
- SHA-256 checksum
- `latest.json` manifest for `/ops/backup/status`

Minimum production policy:

- daily database backup
- off-server copy
- checksum stored with the dump
- restore drill before customer go-live
- restore drill repeated monthly

## Off-Server Backup Sync

Off-server backup support is scriptable but requires a real storage destination.

Supported modes:

- `BACKUP_RSYNC_TARGET=user@backup-host:/path/`
- `BACKUP_S3_URI=s3://bucket/prefix`

Run after a local backup:

```bash
DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres \
BACKUP_RSYNC_TARGET=user@backup-host:/srv/tanaghum/ \
./scripts/sync-latest-backup-offserver.sh
```

or:

```bash
DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres \
BACKUP_S3_URI=s3://company-backups/tanaghum \
./scripts/sync-latest-backup-offserver.sh
```

The script writes `offserver-latest.json`. `/ops/backup/status` reports that evidence without exposing the target URI.

## Restore Drill

Restore into a separate database, never directly into production:

```bash
createdb tanaghum_restore_check
pg_restore --dbname=tanaghum_restore_check --clean --if-exists /path/to/tanaghum-postgres.dump
```

Then verify:

- migrations are consistent
- admin login works
- `/health` is healthy
- `/ops/readiness` is healthy enough for production
- a campaign workflow can be read
- customer secrets are still encrypted and never returned by APIs

The backup can be checked without restoring into production:

```bash
chmod +x scripts/verify-postgres-backup.sh
scripts/verify-postgres-backup.sh /path/to/tanaghum-postgres.dump
```

For Docker-based verification:

```bash
scripts/verify-postgres-backup-docker.sh /path/to/tanaghum-postgres.dump
```

For a Docker-based restore drill that creates a temporary database, restores the dump, validates table count, drops the temporary database, and writes `restore-drill-latest.json`:

```bash
scripts/restore-drill-postgres-docker.sh /path/to/tanaghum-postgres.dump
```

`/ops/backup/status` reads `restore-drill-latest.json`. `LATEST_RESTORE_DRILL_AT` is still supported for hosted environments that record restore evidence outside the backup directory.

## Monitoring Deployment

1. Set `OPERATIONS_METRICS_TOKEN` on the backend.
2. Create `monitoring/secrets/ops_metrics_token` on the server only.
3. Start Prometheus and Grafana:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana
```

Prometheus scrapes `/ops/prometheus`. Grafana runs on port `3001` by default.

For the production VPS compose configuration, Prometheus and Grafana must bind to `127.0.0.1` only unless a protected VPN or authenticated reverse proxy is added.

Prometheus alert rules are in:

- `monitoring/alert-rules.yml`

Current rule coverage:

- backend down
- database down
- Redis down
- local backup missing/stale

## Backup Timer

Systemd unit templates are available in:

- `ops/systemd/tanaghum-postgres-backup.service`
- `ops/systemd/tanaghum-postgres-backup.timer`
- `ops/systemd/tanaghum-backup-offserver-sync.service`
- `ops/systemd/tanaghum-backup-offserver-sync.timer`
- `ops/systemd/tanaghum-uptime-check.service`
- `ops/systemd/tanaghum-uptime-check.timer`

Install on the VPS:

```bash
sudo cp ops/systemd/tanaghum-postgres-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tanaghum-postgres-backup.timer
sudo systemctl list-timers tanaghum-postgres-backup.timer
```

Run once immediately:

```bash
sudo systemctl start tanaghum-postgres-backup.service
```

Install the uptime timer:

```bash
sudo cp ops/systemd/tanaghum-uptime-check.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tanaghum-uptime-check.timer
sudo systemctl start tanaghum-uptime-check.service
```

Install off-server sync only after a real target is configured in `/etc/tanaghum/backup-offserver.env`:

```bash
sudo install -d -m 700 /etc/tanaghum
sudo tee /etc/tanaghum/backup-offserver.env >/dev/null <<'EOF'
BACKUP_RSYNC_TARGET=user@backup-host:/srv/tanaghum/
# or BACKUP_S3_URI=s3://company-backups/tanaghum
EOF
sudo chmod 600 /etc/tanaghum/backup-offserver.env
sudo cp ops/systemd/tanaghum-backup-offserver-sync.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tanaghum-backup-offserver-sync.timer
```

## Alerting

Minimum alerts:

- `/health` non-200
- `/ops/readiness` status `not_ready`
- backend container restart loop
- database unavailable
- Redis unavailable
- disk usage above 80%
- backup job failure
- certificate expiration within 14 days
- high 5xx rate
- high login failure rate

## Incident Response

1. Identify affected tenant.
2. Capture request IDs from logs and user-facing error responses.
3. Check `/health` and `/ops/readiness`.
4. Check Docker/container status.
5. Check database and Redis connectivity.
6. If customer credentials may be exposed, rotate the affected tenant credentials immediately.
7. Preserve logs and audit records.
8. Document incident timeline, customer impact, root cause, and corrective action.

## Current Known Production Gaps

- MFA setup, login challenge, and recovery codes exist. Remaining work: customer rollout rehearsal and external security review.
- Full tenant billing/subscription model is not implemented.
- Monitoring deployment artifacts exist and have been deployed on the VPS; external alert routing still needs a real destination.
- Restore drill evidence can now be generated by script and has been verified on the VPS.
- Off-server backup sync requires a real backup host or bucket.
- Penetration/security review must still be performed.
