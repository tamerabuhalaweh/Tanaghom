# Temporary Production Promotion Evidence

Date: 2026-07-27

## Decision

The recovery host at `155.117.45.45` is authorized for temporary production
because the primary Hybrid VPS at `163.123.180.104` is unreachable. GitHub
incident `#223` remains open for primary recovery.

Temporary production URL:

`https://tanaghum-backup.155-117-45-45.sslip.io`

AB remains isolated and is not part of this promotion.

## Reviewed Release

- Repository: `tamerabuhalaweh/Tanaghom`
- Release branch: `main`
- Pre-promotion release: `38d4f16d88ac6411553db94b4dc443d15fadfca8`
- Promotion changes must pass all required GitHub checks before deployment.

## Recovery Source

- Encrypted artifact:
  `tanaghum-postgres-20260725T064332Z.dump.enc`
- Artifact prepared: `2026-07-25T06:43:35Z`
- Encryption: AES-256-CBC with PBKDF2-SHA256
- Encrypted checksum: verified
- Source checksum: verified during the independent restore drill
- Latest independent restore drill: `2026-07-26T04:32:50Z`
- Restored tables: `137`
- Application health: passed
- Application login: passed

Critical records in the approved recovery artifact:

- tenants: 3
- users: 16
- tenant memberships: 16
- commercial events: 6
- commercial plans: 8
- lead records: 7

The artifact is not a continuous replica. The measured backup age at the actual
promotion timestamp must be recorded below.

## Required Promotion Evidence

- [x] Pre-promotion recovery-host backup and checksum verified.
- [x] Recovery artifact decrypted and source checksum verified.
- [x] Recovery artifact restored into the temporary-production database.
- [x] Database migrations completed.
- [x] Public root and `/api/health` return HTTP 200.
- [x] PostgreSQL and Redis report healthy.
- [x] Security headers and API request IDs verified.
- [ ] Authenticated browser acceptance passed.
- [x] External execution remains disabled.
- [ ] GitHub-hosted uptime monitor targets temporary production.
- [x] Immediate post-promotion backup and isolated restore drill passed.
- [ ] Four real privileged users completed owner-controlled MFA enrollment.

## Source-Of-Truth Rule

After the promotion timestamp, every accepted write on the temporary production
database is authoritative. Failback must synchronize the final temporary
production backup to the recovered primary before traffic is redirected.

Promotion timestamp: `2026-07-27T09:11:20Z`

Measured source backup age: `181665` seconds (`2 days, 2 hours, 27 minutes, 45 seconds`)

Promoted release SHA before monitoring/runbook update: `38d4f16d88ac6411553db94b4dc443d15fadfca8`

Post-promotion backup: `20260727T091120Z`

Post-promotion isolated restore drill: passed with 137 tables; application
health and login passed.

Operator acceptance result: runtime recovery and security-header checks passed;
browser, GitHub external monitoring, and real-user MFA evidence remain pending.

## Recovery Findings

The restored database contains integration and AI credentials encrypted with
the primary environment vault key. That key was not present in the
recovery-host secret store, so the restored ciphertext cannot be decrypted on
this host.

The recovery-hardening release:

- prevents connector and AI endpoints from returning unhandled HTTP 500 errors;
- does not report unusable saved credentials as configured;
- returns `Reconnect required` in safe credential status;
- preserves existing ciphertext and never returns raw secrets;
- requires owners to re-enter credentials through the secure setup UI;
- adds separate production-vault-key escrow to the recovery contract.

Commercial, event, lead, plan, and user records were restored correctly.
External connectors and saved AI credentials remain unavailable until owners
re-enter them or the approved primary vault key is restored.

## Dependency Audit

The root production audit has no critical advisory. The frontend audit reports
the React Router RSC-mode CSRF advisory against the latest stable package.
Hybrid uses browser SPA routing and does not enable React Server Components or
server actions, so that affected execution path is not used. No stable patched
release is currently available in the package registry; a forced downgrade
exposes additional high-severity router advisories. Track the upstream stable
fix and upgrade when published.
