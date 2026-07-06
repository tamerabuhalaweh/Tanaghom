# CONTEXT.md - Current Active Context

Last updated: 2026-07-06

## Start Here

The current project handover source of truth is:

[`docs/handover/CURRENT_PROJECT_HANDOVER.md`](docs/handover/CURRENT_PROJECT_HANDOVER.md)

Read that file before starting any new development, review, deployment, or AI-agent task.

## Current Active Branch

```text
feature/hybrid-emergent-ux-governed-tanaghum
```

Latest known R5A implementation commit at this update:

```text
82e160b feat: accept GHL credentials and validate mappings
```

Latest deployed hybrid branch commit at this update:

```text
0f32140 docs: record R5A implementation evidence
```

## Current Product Direction

The active implementation lane is Hybrid Tanaghum:

```text
Emergent-style customer UX
  -> Tanaghum frontend API adapter
  -> Tanaghum backend
  -> RBAC / tenant isolation / audit / approval / integrations / workflow controls
```

Main rule:

**Customers configure business systems, not backend architecture.**

Customer-facing setup should show:

- GoHighLevel CRM
- Postiz scheduling
- Meta / Instagram analytics
- YouTube analytics
- Formaloo / forms
- SmartLabs voice/chat
- AI provider
- CSV import fallback

Customer-facing setup must not show:

- agentgateway
- OpenClaw
- AgentScope
- MCP internals
- runtime bridge internals

Those belong under Admin/Ops evidence only.

## Current Runtime Truth

- R3 agentgateway sandbox policy adapter is live-accepted on hybrid for connector dry-run mediation.
- This is not full production agentgateway deployment.
- OpenClaw is not production-orchestrating Tanaghum workflows.
- AgentScope is not executing production agent sessions.
- External writes, publishing, CRM writes, messaging, voice calls, and M5 remain blocked unless explicitly authorized.

Current R4/R4A status:

- Postiz read-only adapter is deployed and live-accepted on hybrid for connector dry-run.
- It uses tenant-owned Postiz `baseUrl`, `apiKey`, and optional `integrationId`.
- It reads Postiz integrations and analytics only.
- It does not schedule, publish, import, or write KPI records during dry-run.
- R4 live validation returned: credential valid, zero connected channels, zero KPI rows, no writes, honest customer setup blocker.
- R4A channel selection UX is implemented locally:
  - user can select listed channels
  - user can paste a Postiz integration ID as pending validation
  - user can run read-only analytics validation for an event
  - the UI shows KPI preview rows or precise setup blockers

Current R5 status:

- GoHighLevel read-sync adapter is implemented and deployed to hybrid at commit `1042abe`.
- Customer-owned GHL API key, location ID, tag mapping, and pipeline/stage mapping are required.
- Read sync is gated by `GHL_READ_SYNC_ENABLED=true`; write-back remains separately gated by `GHL_WRITE_BACK_ENABLED=true`.
- R5 backend path pulls contacts, opportunities, per-contact appointments/meetings, tags, stages, purchases, meeting/no-show state, and maps those into Tanaghum lead mirrors.
- Tanaghum never exposes raw GHL payloads or secrets in the response.
- Local verification on 2026-07-06 passed backend lint, typecheck, full backend tests (1769), backend build, frontend lint, and frontend build.
- Deployed smoke on 2026-07-06 returned the expected customer setup blocker: missing GHL credential/mapping, read sync disabled, write-back disabled, and pull preview `requires_credentials` with `rawPayloadReturned: false`.
Current R5A status:

- Implemented, pushed, deployed to hybrid, and smoke-tested on 2026-07-06.
- Adds read-only GHL credential acceptance through `POST /ghl-setup/test-connection`.
- The test uses tenant-owned GHL credential fields from the secure vault and performs a read-only contact search only.
- If successful, `last_validated_at` is recorded on the tenant GHL credential.
- Adds `POST /ghl-setup/validate-mappings` to check whether GHL tag/stage mappings cover required sales outcomes:
  - meeting booked
  - meeting attended
  - no-show
  - purchased
  - lost
  - follow-up needed
  - warm / hot / buyer temperature
- GHL setup mappings created by the GHL wizard now validate against Tanaghum lead status/temperature vocabulary.
- Deployed API smoke returned the expected missing-credential blocker with `rawSecretsReturned: false` and `rawPayloadReturned: false`.
- Deployed browser smoke on `/ghl-wizard` clicked "Validate GHL Mappings" and received HTTP 200, status `not_ready`, 9 missing required outcomes, `readyForReadSync: false`, 0 console errors, and 0 failed requests.
- Real read sync still requires customer-owned credentials, mappings, and `GHL_READ_SYNC_ENABLED=true`.
- CRM writes remain blocked unless separately authorized through `GHL_WRITE_BACK_ENABLED=true`.

Current R5B status:

- In implementation on 2026-07-06.
- Adds `POST /ghl-setup/live-validation` for customer-owned GHL credential validation.
- The endpoint calls only read-only GHL surfaces:
  - contacts search
  - opportunities search
  - location tags
  - opportunity pipelines and stages
- The response returns status/counts/blockers only, with `rawSecretsReturned: false` and `rawPayloadReturned: false`.
- Saved Tanaghum GHL tag/stage mappings are compared against live GHL tags and pipeline stages when those read scopes are available.
- No CRM write-back, WhatsApp send, or workflow mutation is enabled by R5B.
- Full live acceptance still requires customer-owned GHL API key, location ID, and read scopes.

Next recommended work:

1. Finish R5B verification and deploy to hybrid.
2. If the customer provides real GHL credentials, run GHL live validation.
3. If accepted, map required tags/stages and run GHL read-sync preview with `GHL_READ_SYNC_ENABLED=true`.
4. Then move to Formaloo import or Meta/YouTube analytics readiness depending on available customer credentials.

## Current Required Verification

Before claiming any implementation complete:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

For customer-facing UI work, add browser walkthrough or Playwright evidence.

## Documentation Rule

Older sprint files remain audit history. If they conflict with the current code or the handover file, use:

1. current code and schema
2. current tests
3. deployed evidence
4. `docs/handover/CURRENT_PROJECT_HANDOVER.md`
5. historical sprint docs
