# Sprint 65 Customer Acceptance Workflow

## Purpose

This workflow proves that the customer can understand and operate the event-centered Commercial/Social product without developer explanation.

It is not a fake demo script. It is the acceptance path for the production candidate.

## Required Environment

| Item | Required |
|---|---|
| Frontend URL | Production or approved staging URL |
| Backend API URL | Matching API URL |
| User | Admin or Marketing/Sales Manager test user |
| Tenant | Customer or approved acceptance tenant |
| Event | Existing event or permission to create a test event |
| Writes | Disabled unless `E2E_ALLOW_ACCEPTANCE_WRITES=true` is explicitly approved |

## Automated Playwright Command

Read-only acceptance:

```bash
E2E_SPRINT65_ACCEPTANCE=true \
E2E_BASE_URL=https://tanaghum.163-123-180-104.sslip.io \
E2E_API_BASE_URL=https://tanaghum.163-123-180-104.sslip.io/api \
E2E_USER_EMAIL=<configured in GitHub secret or local env> \
E2E_USER_PASSWORD=<configured in GitHub secret or local env> \
npm run test:e2e:sprint65
```

Sandbox write-path acceptance:

```bash
E2E_SPRINT65_ACCEPTANCE=true \
E2E_ALLOW_ACCEPTANCE_WRITES=true \
E2E_BASE_URL=https://tanaghum.163-123-180-104.sslip.io \
E2E_API_BASE_URL=https://tanaghum.163-123-180-104.sslip.io/api \
E2E_USER_EMAIL=<configured in GitHub secret or local env> \
E2E_USER_PASSWORD=<configured in GitHub secret or local env> \
npm run test:e2e:sprint65
```

Only use write-path mode on an approved sandbox/test tenant.

## 15-Minute Manual Walkthrough

| Step | Page | Expected Result | Pass |
|---|---|---|---|
| 1 | Login | User signs in and lands on Dashboard. | |
| 2 | Events | Event list or empty state is clear. | |
| 3 | Create Event Strategy | Strategy wizard explains event type, offer, audience, channels, content, and sales requirements. | |
| 4 | Event Dashboard | Selected event shows KPIs, funnel, budget, connector status, planner, sales workflow, barriers, closeout, and evidence. | |
| 5 | Event Campaign Planner | Email, WhatsApp, upsell, content, and sales work are visible as event-scoped plans. | |
| 6 | Content Creator | User can create campaign ideas, or the page clearly explains that AI model setup is required. | |
| 7 | Review & Approve | Human review path is understandable and approval remains required. | |
| 8 | Scheduling | Approved packages and Postiz readiness are visible; real scheduling remains blocked without credentials/authorization. | |
| 9 | Performance | Leads and customer-interest data are visible or honest empty states explain what is missing. | |
| 10 | Master Events Dashboard | Cross-event portfolio KPIs are readable. | |
| 11 | Closeout Report | Event closeout report can be generated/previewed from event data. | |
| 12 | Connector Setup | Missing/configured/validated connector states are clear and no raw secrets are displayed. | |
| 13 | Operations | Readiness, backup, and monitoring statuses are visible. | |
| 14 | Security | External execution controls are visible and understandable. | |

## Pass Criteria

- No console errors.
- No unexpected failed API responses.
- No raw JSON in the customer path.
- No raw UUIDs in the customer path.
- No raw secrets in frontend or API responses.
- Blocked external actions explain the required credential or authorization.
- Customer can complete the path in 15 minutes without engineering explanation.
- Manual rehearsal passes twice before final customer handoff.

## Current Evidence Status

Passed for customer acceptance on 2026-07-03.

Three deployed acceptance runs passed against:

```text
Frontend: https://tanaghum.163-123-180-104.sslip.io
API:      https://tanaghum.163-123-180-104.sslip.io/api
Command:  npx playwright test e2e/sprint65-customer-acceptance.spec.ts --workers=1
Env:      E2E_SPRINT65_ACCEPTANCE=true, E2E_ALLOW_ACCEPTANCE_WRITES=true
```

The latest run completed 3/3 tests after the PR #100 learning recommendations UI deployment and covered login, Events, strategy wizard, event dashboard, content creator, approval, scheduling, analytics, master dashboard, connector setup, backend release-gate endpoints, and an approved sandbox lead lifecycle write.

Customer-owned credentials are still required before real Postiz scheduling, GHL writes, Meta/YouTube/Formaloo imports, WhatsApp/Telegram, and SmartLabs execution can be validated.
