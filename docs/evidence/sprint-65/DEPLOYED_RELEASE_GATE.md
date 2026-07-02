# Sprint 65 Deployed VPS Release Gate

## Purpose

This release gate records whether the deployed VPS is safe to hand to the customer for acceptance testing.

Do not mark the release as approved until the required checks below pass against the deployed environment.

## Environment

| Field | Value |
|---|---|
| Date/time | |
| Tester | |
| Git commit SHA | |
| Frontend URL | |
| Backend API URL | |
| VPS host | |
| Tenant/workspace | |
| Test user role | |

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
| Frontend loads | 200 OK and app shell renders | | |
| Login works | User reaches Dashboard | | |
| Events page loads | Event list or empty state renders | | |
| Event dashboard loads | KPIs, planner, sales workflow, closeout sections render | | |
| Strategy wizard loads | Event strategy wizard renders | | |
| Planner API path works | Planner endpoints return OK for selected event | | |
| Lead lifecycle path works | Lead dashboard returns OK for selected event | | |
| Master dashboard loads | Master events dashboard renders | | |
| Connector status loads | Connector setup/readiness renders accurate missing/configured/validated states | | |
| Secrets are not exposed | No raw API keys/tokens in UI or API responses | | |
| No console errors | Playwright console capture is empty | | |
| No unexpected failed API responses | Playwright network capture is empty except approved blocked connector states | | |

## Operational Checks

| Check | Required Result | Actual | Pass |
|---|---|---|---|
| Docker services | Required services healthy/running | | |
| Database migrations | Latest migrations applied | | |
| Backend health | `/health` returns OK | | |
| Operations readiness | `/ops/readiness` returns OK for authenticated admin | | |
| Backup status | Backup status endpoint reports latest local backup or precise blocker | | |
| Monitoring status | Monitoring status endpoint reports latest uptime evidence or precise blocker | | |
| Logs | No repeated runtime errors during smoke window | | |

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
| 1 | | | | |
| 2 | | | | |

## Decision

| Decision | Choose One |
|---|---|
| Approved for customer acceptance | |
| Blocked - fixes required | |
| Approved with documented customer-owned blockers | |

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
