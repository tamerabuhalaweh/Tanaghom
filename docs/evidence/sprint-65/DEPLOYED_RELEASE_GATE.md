# Sprint 65 Deployed VPS Release Gate

## Purpose

This release gate records whether the deployed VPS is safe to hand to the customer for acceptance testing.

Do not mark the release as approved until the required checks below pass against the deployed environment.

## Environment

| Field | Value |
|---|---|
| Date/time | 2026-07-03 07:24 -04:00 |
| Tester | Codex |
| Git commit SHA | `2d49cc5` |
| Frontend URL | `https://tanaghum.163-123-180-104.sslip.io` |
| Backend API URL | `https://tanaghum.163-123-180-104.sslip.io/api` |
| VPS host | `163.123.180.104` |
| Tenant/workspace | Default acceptance tenant |
| Test user role | Admin |

## Automated Checks

Run:

```bash
E2E_SPRINT65_ACCEPTANCE=true \
E2E_BASE_URL=<frontend-url> \
E2E_API_BASE_URL=<api-url> \
E2E_USER_EMAIL=<tester-email> \
E2E_USER_PASSWORD=<tester-password> \
npm run test:e2e:sprint65
```

| Check | Required Result | Actual | Pass |
|---|---|---|---|
| Frontend loads | 200 OK and app shell renders | 200 OK, app shell renders | Yes |
| Login works | User reaches Dashboard | Login reached Dashboard | Yes |
| Events page loads | Event list or empty state renders | Events page loaded | Yes |
| Event dashboard loads | KPIs, planner, sales workflow, closeout sections render | Event workspace loaded with required sections | Yes |
| Strategy wizard loads | Event strategy wizard renders | Strategy wizard loaded | Yes |
| Planner API path works | Planner endpoints return OK for selected event | Email, WhatsApp, and content planner endpoints returned OK | Yes |
| Lead lifecycle path works | Lead dashboard returns OK for selected event | Lead dashboard returned OK; write-path lead transition passed | Yes |
| Master dashboard loads | Master events dashboard renders | Master Events Dashboard loaded | Yes |
| Connector status loads | Connector setup/readiness renders accurate missing/configured/validated states | Connector Setup loaded; readiness endpoints returned OK | Yes |
| Secrets are not exposed | No raw API keys/tokens in UI or API responses | No raw secrets detected by Playwright checks | Yes |
| No console errors | Playwright console capture is empty | Empty | Yes |
| No unexpected failed API responses | Playwright network capture is empty except approved blocked connector states | Empty | Yes |

## Operational Checks

| Check | Required Result | Actual | Pass |
|---|---|---|---|
| Docker services | Required services healthy/running | `app`, `frontend`, `postgres`, `redis`, `prometheus`, and `grafana` running; database and Redis healthy | Yes |
| Database migrations | Latest migrations applied | 22 migrations detected; missing Sprint 59-64 migrations applied on VPS | Yes |
| Backend health | `/health` returns OK | `200 {"status":"healthy"}` | Yes |
| Operations readiness | `/ops/readiness` returns OK for authenticated admin | Returned OK in deployed acceptance test | Yes |
| Backup status | Backup status endpoint reports latest local backup or precise blocker | Returned OK or precise blocker in deployed acceptance test | Yes |
| Monitoring status | Monitoring status endpoint reports latest uptime evidence or precise blocker | Returned OK or precise blocker in deployed acceptance test | Yes |
| Logs | No repeated runtime errors during smoke window | Initial missing-table error fixed by rebuilding stale migrate image and applying migrations; no repeated errors during final passing runs | Yes |

## Release Blockers

Release is blocked if any of these fail:

- Authentication.
- Events page.
- Event dashboard.
- Lead lifecycle dashboard.
- Master dashboard.
- Connector status page.
- Secret exposure check.
- Unexpected 5xx API response.
- Runtime logs show repeated application errors.

## Known Customer-Owned Blockers

These do not block the release if they are clearly shown as missing/blocked in the product:

- Postiz social channel not connected.
- Meta/Instagram/YouTube credentials not provided.
- GHL credentials/tag mapping not provided.
- WhatsApp/Telegram credentials not provided.
- SmartLabs tenant key/agent ID not provided.
- Off-server backup destination not provided.
- External alert destination not provided.

## Rehearsal Runs

| Run | Date/time | Tester | Result | Notes |
|---|---|---|---|---|
| 1 | 2026-07-03 07:04 -04:00 | Codex | Passed | `npx playwright test e2e/sprint65-customer-acceptance.spec.ts --workers=1`, with deployed URL/API and sandbox writes enabled |
| 2 | 2026-07-03 07:07 -04:00 | Codex | Passed | Same deployed acceptance command; 3/3 tests passed |
| 3 | 2026-07-03 07:25 -04:00 | Codex | Passed | Same deployed acceptance command after PR #100 deployment; 3/3 tests passed |

## Decision

| Decision | Choose One |
|---|---|
| Approved for customer acceptance | Yes |
| Blocked - fixes required | |
| Approved with documented customer-owned blockers | Yes |

## Passed VPS Gate - 2026-07-03

PR #109 was merged into `main`, the VPS was updated from the old sprint branch to `main`, backend/frontend images were rebuilt, the stale migrate image was rebuilt, and the missing Sprint 59-64 migrations were applied.

Three deployed Playwright acceptance runs passed against:

```text
Frontend: https://tanaghum.163-123-180-104.sslip.io
API:      https://tanaghum.163-123-180-104.sslip.io/api
Command:  npx playwright test e2e/sprint65-customer-acceptance.spec.ts --workers=1
Env:      E2E_SPRINT65_ACCEPTANCE=true, E2E_ALLOW_ACCEPTANCE_WRITES=true
```

The release remains dependent on customer-owned credentials for real external connector execution, as listed above.

## Learning UI Deployment - 2026-07-03

PR #100 was merged into `main` as `2d49cc5`, the VPS frontend image was rebuilt, and the deployed acceptance gate passed again. The event dashboard now includes evidence-backed learning recommendations while keeping customer-owned connector execution gated.

## Initial VPS Probe - 2026-07-02

| Field | Value |
|---|---|
| Tester | Codex |
| Local test commit | `39eb1b3` |
| Frontend URL | `https://tanaghum.163-123-180-104.sslip.io` |
| Backend API URL | `https://tanaghum.163-123-180-104.sslip.io/api` |
| Command | `npm run test:e2e:sprint65 -- --reporter=list` with `E2E_SPRINT65_ACCEPTANCE=true` |
| Mode | Read-only, `E2E_ALLOW_ACCEPTANCE_WRITES` unset |
| Result | Failed |

### Failure

Login succeeded, but the Sprint 65 event-centered backend route was not available on the deployed VPS:

```text
GET /api/events -> 404
```

This blocks customer acceptance because the required Sprint 65 path starts with Events, Event Dashboard, Lead Lifecycle, Master Dashboard, and Closeout.

### Required Fix Before Release

1. Deploy latest `main` to the VPS.
2. Apply database migrations.
3. Restart backend/frontend services.
4. Confirm `/api/events` returns `200 OK` for an authenticated user.
5. Rerun `npm run test:e2e:sprint65`.
6. Run the manual 15-minute walkthrough twice and fill the rehearsal table above.
