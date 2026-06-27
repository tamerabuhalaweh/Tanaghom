# Sprint 48 — SaaS Tenant Isolation, MFA, and Production Operations Hardening

## Status

Implemented for review.

## Goal

Raise production readiness by addressing three weak areas:

- SaaS tenant/customer isolation
- MFA and hardened authentication
- production operations visibility, backups, and incident readiness

## Completed

### SaaS Tenant Isolation

- Tenant integration credentials are now scoped only to the authenticated user's tenant.
- The integration credential API no longer accepts caller-selected `tenantKey` from query/body.
- Added tenant admin summary endpoint:
  - `GET /admin/tenant`
  - `PUT /admin/tenant`
  - `GET /admin/tenant/isolation-report`
- Login now ensures active tenant membership exists and blocks disabled memberships.
- Legacy users are backfilled into their own tenant membership during login.

### MFA Foundation

- Added TOTP MFA support with encrypted secrets:
  - `GET /auth/mfa/status`
  - `POST /auth/mfa/setup`
  - `POST /auth/mfa/verify`
  - `POST /auth/mfa/disable`
- Added `user_mfa_factors` table.
- Login enforces MFA only after a verified factor exists.
- Frontend login supports authenticator code entry when required.
- MFA setup secret is returned once only.

### Security Baseline Hardening

- `SECRET_VAULT_ENCRYPTION_KEY` is now required in production.
- Frontend logout calls backend logout so revoked-token storage is used.
- MFA code validation is enforced at login input validation.

### Production Operations

- Added admin-only operations endpoints:
  - `GET /ops/readiness`
  - `GET /ops/metrics`
- Added PostgreSQL backup script:
  - `scripts/backup-postgres.sh`
- Added production operations runbook:
  - `docs/operations/PRODUCTION_OPERATIONS_RUNBOOK.md`

## Tests Added / Updated

- TOTP MFA utility tests
- Login validator MFA tests
- Tenant credential scope tests
- Existing token revocation, GHL SaaS config, and publishing governance tests remain passing

## Still Not Production Complete

- MFA recovery policy is not complete yet.
- UI for self-service MFA setup/status is not built yet.
- Full tenant billing/subscription model is not implemented.
- Full tenant role templates and advanced membership lifecycle are not implemented.
- Monitoring stack is not deployed yet.
- Backup job scheduling and off-server storage are not configured by code.
- Restore drill evidence must still be collected.
- Penetration/security review is still required.
- Real customer integration testing for Postiz/GHL/social/voice remains required.
