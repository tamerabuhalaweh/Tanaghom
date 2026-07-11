# Hybrid Production Operations Acceptance

## Status Rule

This file distinguishes implemented controls from externally blocked acceptance. A script existing in Git is not production evidence. An old manifest is not current evidence. A configured destination is not proven until a controlled notification arrives.

## Automated Acceptance

| Control | Acceptance evidence |
|---|---|
| Public availability | GitHub-hosted `Hybrid External Uptime` workflow passes for root and `/api/health` |
| Browser security headers | CSP, frame, content-type, referrer policy, and one-year HSTS pass on root and API |
| Local database backup | Daily systemd timer, current manifest, SHA-256 validation, and `pg_restore --list` |
| Off-server backup | Encrypted artifact, encrypted checksum, sanitized manifest, current sync evidence |
| Restore drill | Isolated database, critical record counts, isolated app health, and real login validation |
| Runtime monitoring | Prometheus target healthy and rules loaded for app, DB, Redis, backup, restore, and uptime |
| Alert delivery | Alertmanager or GitHub workflow delivers a controlled alert to approved external destination |

## Customer/Operations Inputs Still Required

1. **Off-server storage**: provide either an rsync destination or S3-compatible bucket, credentials, retention, and region/residency approval.
2. **Backup encryption custody**: nominate owner for the server-only passphrase and recovery escrow. The passphrase must not be stored in Git.
3. **Alert destination**: provide an approved webhook endpoint and recipient/escalation list.
4. **Incident ownership**: name Incident Commander, Technical Lead, Security Lead, and customer contact.
5. **Independent security tester**: provide or approve the tester and test window using `docs/security/INDEPENDENT_SECURITY_REVIEW_BRIEF.md`.

## RPO And RTO Proposal Requiring Owner Sign-Off

- Database RPO: 24 hours maximum until a higher-frequency policy is approved.
- Database restore RTO: 4 hours for a confirmed database-loss incident.
- Application availability RTO: 1 hour when data restoration is not required.
- Local retention: 30 days.
- Restore drill cadence: monthly and before material production releases.

These are engineering proposals, not contractual promises, until the customer and operations owner approve them.

## Go-Live Blocking Rule

Unrestricted customer-production sign-off is blocked while any of the following is true:

- no current encrypted off-server copy;
- no proven external alert destination;
- no current isolated restore/login drill;
- no named incident owners;
- no independent penetration-test report;
- any unaccepted critical/high security finding remains open.
