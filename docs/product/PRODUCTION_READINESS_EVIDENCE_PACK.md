# Production Readiness Evidence Pack

## Snapshot

| Item | Status |
|---|---|
| Prepared date | 2026-07-03 |
| Current main commit | `2d49cc5e0b69bf60e76121ddf11be3a8072fc255` |
| Deployed VPS commit | `2d49cc5` |
| Frontend URL | `https://tanaghum.163-123-180-104.sslip.io` |
| API URL | `https://tanaghum.163-123-180-104.sslip.io/api` |
| GitHub CI on current main | Passed |
| VPS frontend smoke | Passed, HTTP 200 |
| VPS API health smoke | Passed, `/api/health` healthy |
| Deployed acceptance run | Passed, 3/3 Playwright tests |

## What Is Ready

- Event-centered Commercial/Social workflow is deployed on the VPS.
- Event strategy creation, event dashboard, manual KPI tracking, planner records, lead lifecycle, closeout evidence, connector setup UI, and learning recommendations are present in the customer-facing product path.
- GitHub CI passed on the current main commit.
- The deployed customer acceptance gate passed after the latest deployment.
- The product clearly separates customer-owned connector setup from platform-owned workflow logic.
- External execution remains gated; missing credentials or disabled write flags are shown as blocked/readiness states rather than fake success.

## Verification Evidence

| Evidence | Result |
|---|---|
| `npm run typecheck` | Passed during PR #100 rebase verification |
| `npm --prefix frontend run lint` | Passed during PR #100 rebase verification |
| `npm --prefix frontend run build` | Passed during PR #100 rebase verification |
| `npx playwright test e2e/sprint60-event-dashboard.spec.ts --workers=1` | Passed, verifies event dashboard KPI, CSV import, and learning recommendations |
| GitHub CI for `2d49cc5` | Passed: backend, frontend, docker, security |
| VPS smoke | Frontend `200`; API health `{"status":"healthy"}` |
| Deployed acceptance | Passed: `npx playwright test e2e/sprint65-customer-acceptance.spec.ts --workers=1` with deployed URLs and approved sandbox writes |

## Customer-Owned Credential Blockers

These are not code failures, but they block proving real provider execution:

| Area | Status | Required From Customer |
|---|---|---|
| Postiz social channel | Not fully validated | Business/social channel connected in Postiz and selected for the event |
| GoHighLevel | Wizard/readiness exists; real write not validated | Tenant GHL API credentials, location, pipeline, tag mapping |
| Formaloo import | CSV/import foundation exists; live provider import not validated | Formaloo export/API credentials and approved field mapping |
| Meta/Instagram/YouTube analytics | Readiness exists; official API not validated | Provider app/account access and approved read-only permissions |
| WhatsApp/Telegram | Readiness exists; execution not validated | Customer-owned provider credentials and approval policy |
| SmartLabs voice | Validation UI/backend exists; real tenant key not tested | SmartLabs API key and test agent ID |

## Operational Gaps

| Gap | Current Position | Risk |
|---|---|---|
| Off-server backups | Local backup/readiness exists; off-server destination not provided | Medium until storage bucket/backup host is configured |
| External alerts | Monitoring exists; external alert route not provided | Medium until email/webhook routing is configured |
| Provider production testing | Platform is ready to accept customer credentials, but live provider tests are not complete | High for go-live with real channels |
| Independent penetration test | Not performed | Medium; required before high-risk production rollout |
| Live external writes | Correctly blocked unless explicitly configured and authorized | Low by default, high only after enabling real writes without final review |

## Release Decision

The platform is ready for customer acceptance and controlled production-readiness testing of the event-centered Commercial/Social module.

It is not yet fully proven for live external execution because customer-owned credentials, provider approvals, and real account mappings are still required.

## Next Required Actions

1. Customer provides or connects Postiz business/social channel.
2. Customer provides GHL tenant credentials and confirms tag/pipeline mapping.
3. Customer provides SmartLabs test API key and agent ID for validation.
4. Customer provides Formaloo/Meta/YouTube access where official imports are required.
5. Configure off-server backups and external alert routing.
6. Run final security/data isolation review and independent penetration review before broader production rollout.
