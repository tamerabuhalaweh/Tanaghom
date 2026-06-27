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

The readiness endpoint checks:

- database health
- Redis health
- secret vault key presence
- JWT secret minimum length
- explicit CORS origin
- email delivery configuration when enabled
- backup target configuration
- alert destination configuration

## Required Production Environment

Required:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SECRET_VAULT_ENCRYPTION_KEY`
- `CORS_ORIGIN`

Recommended:

- `REQUEST_BODY_LIMIT=1mb`
- `RATE_LIMIT_WINDOW_SECONDS=60`
- `RATE_LIMIT_MAX_REQUESTS=100`
- `DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres`
- `BACKUP_STORAGE_TARGET=<off-server backup destination>`
- `ALERT_WEBHOOK_URL=<ops alert webhook>`
- `OPERATIONS_ALERT_EMAIL=<ops email>`
- `EMAIL_DELIVERY_ENABLED=true`
- SMTP settings when email delivery is enabled

## Customer-Owned Integration Credentials

The platform must not use hardcoded shared customer credentials.

Each tenant/customer configures their own:

- AI provider key
- Postiz API key and channel ID
- GoHighLevel API key and location ID
- WhatsApp/Telegram/voice credentials
- social OAuth client credentials

GoHighLevel environment fallback is disabled by default. Do not enable `ALLOW_GLOBAL_GHL_CREDENTIALS=true` for multi-tenant SaaS unless there is a documented enterprise-hosted exception.

## Backup

Run on the server:

```bash
chmod +x scripts/backup-postgres.sh
DATABASE_URL="$DATABASE_URL" DATABASE_BACKUP_DIR=/var/backups/tanaghum/postgres ./scripts/backup-postgres.sh
```

Backup output:

- PostgreSQL custom dump
- SHA-256 checksum

Minimum production policy:

- daily database backup
- off-server copy
- checksum stored with the dump
- restore drill before customer go-live
- restore drill repeated monthly

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

- MFA backend foundation exists after Sprint 48 hardening, but customer rollout and recovery policy must be finalized.
- Full tenant billing/subscription model is not implemented.
- Full production monitoring stack is not deployed.
- Restore drill evidence must be collected.
- Penetration/security review must still be performed.
