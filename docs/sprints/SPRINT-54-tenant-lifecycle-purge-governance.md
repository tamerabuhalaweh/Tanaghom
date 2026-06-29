# Sprint 54: Tenant Lifecycle Export Evidence and Purge Governance

Status: implemented locally, pending CI/VPS verification
Date: 2026-06-29

## Goal

Move the SaaS tenant lifecycle closer to production by making tenant export/delete readiness auditable and adding a guarded offline purge worker. This sprint does not add billing/subscriptions and does not expose hard delete in the application UI.

## Delivered

- Tenant export now writes local export evidence:
  - default directory: `./ops/tenant-exports`
  - override: `TENANT_EXPORT_EVIDENCE_DIR`
  - evidence file: `<tenant-key>-latest.json`
  - stores redacted counts and a SHA-256 hash of the sanitized export bundle
- Tenant deletion readiness now checks retained export evidence instead of relying only on `LATEST_TENANT_EXPORT_AT`.
- Tenant export and deletion readiness now use direct `tenant_key` ownership for core commercial records:
  - content requests
  - approvals
  - publishing packages
  - lead capture records
  - analytics ingestion requests
  - analytics snapshots
  - campaign performance reports
  - commercial workflow runs
- Added offline purge worker:
  - command: `npm run tenant:purge -- --tenant-key=<tenant>`
  - dry-run is the default
  - execution requires:
    - archived tenant
    - retained export evidence
    - no active users
    - no active memberships
    - no active integration credentials
    - no pending/escalated approvals
    - no draft/validating/ready publishing packages
    - `TENANT_PURGE_ENABLED=true`
    - `--confirm=PURGE_TENANT_<tenant>`
- Purge execution mode is intentionally limited to:
  - `application_data_purge_preserve_audit_identity_shell`
  - application records are deleted where safe
  - tenant/user/agent identity shells are anonymized/deactivated
  - audit/evidence lineage is preserved

## Safety Policy

- No UI hard-delete.
- No tenant purge execution without explicit environment enablement.
- No purge execution without a tenant-specific confirmation phrase.
- No purge execution unless deletion readiness is clear.
- No raw secrets are written to export evidence.
- Audit/SPINE/evidence records are preserved by design.

## Example Commands

Dry-run:

```bash
npm run tenant:purge -- --tenant-key=customer-a
```

Execute after legal/retention approval:

```bash
TENANT_PURGE_ENABLED=true npm run tenant:purge -- --tenant-key=customer-a --execute --confirm=PURGE_TENANT_customer-a
```

## Verification

- Unit coverage added for:
  - tenant export evidence generation
  - export evidence redaction posture
  - purge dry-run behavior
  - purge execution blockers
  - purge confirmation phrase
- Full command verification must be rerun in CI/VPS before release.

## Remaining Production Gaps

- Billing/subscriptions are still not implemented.
- Tenant lifecycle automation is still manual/admin-driven.
- Full legal retention policy and independent privacy review are still required before customer hard-delete promises.
- The purge worker preserves audit identity shells; it is not a blind physical deletion of every tenant-linked database row.
- Off-server backup target and external alert routing still require real customer/team destinations.
- Production connector flows still need real customer credentials/accounts:
  - Postiz real channel scheduling
  - GHL writes
  - WhatsApp
  - Telegram
  - SmartLabs voice
  - social OAuth
- OpenClaw, agentgateway, and AgentScope are still not production runtime infrastructure.
- Independent penetration/security review is still not complete.
