# Sprint 56 — Product Integrity & Workflow Verification

## Purpose

Verify that the recent production sprints remain wired together across backend routes, frontend API clients, product navigation, Tenant Admin controls, Commercial/Social workflow state, and browser-rendered UI.

This sprint does not introduce new business capability. It hardens verification so route drift, stale UI labels, and disconnected admin/runtime pages fail during testing.

## Scope Completed

- Added `tests/e2e/sprint56-product-integrity.test.ts`.
- Repaired local Playwright web server configuration so UI tests launch the Vite frontend instead of the backend watcher.
- Rebuilt the Commercial/Social browser walkthrough around the current product vocabulary:
  - Dashboard
  - Content Creator
  - Campaigns
  - Review & Approve
  - Scheduling
  - Performance
  - Tenant Administration
- Added mocked API responses for the browser walkthrough so UI route wiring can be tested without live customer credentials.

## Integrity Contracts Added

### Backend/API Wiring

The integrity test asserts that frontend API clients are backed by registered Express route prefixes for:

- Tenant Admin
- Commercial workflow
- Postiz
- AI provider
- Integration credentials
- Social OAuth
- Runtime bridges
- MCP runtime
- Operations
- SmartLabs
- GHL
- Leads

### Product Navigation

The test asserts that primary navigation labels match implemented routes and current customer-facing wording. It also guards against stale labels returning to the main navigation.

### Tenant Admin

The test asserts that subscription, export, deletion-readiness, and deletion-review controls are exposed by the API client and consumed by the Tenant Admin page.

### Command Center

The test asserts that Dashboard state is fed by backend API clients instead of static readiness panels.

## Browser Verification

The Playwright product walkthrough verifies:

- Login screen renders.
- Authenticated product shell loads.
- Dashboard renders current product workflow sections.
- Content Creator renders with current provider contract.
- Campaigns page renders actionable campaign controls.
- Review & Approve page renders current review guidance.
- Scheduling page renders scheduling payload controls.
- Performance page renders.
- Tenant Admin renders subscription/export/deletion controls.
- No frontend console errors are emitted during the walkthrough.

## Verification Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 979 tests.
- `npm run build`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.
- `npx playwright test --reporter=list`: passed for the mocked product walkthrough; deployed Sprint 39 acceptance checks remain skipped unless `E2E_ACCEPTANCE=true`.
- `DATABASE_URL=postgresql://user:pass@localhost:5432/tanaghum npx prisma validate`: passed.
- `DATABASE_URL=postgresql://user:pass@localhost:5432/tanaghum npx prisma generate`: passed.

## Verification Limits

- `npx prisma migrate status` could not verify a local database because PostgreSQL is not reachable on `localhost:5432` from this workstation.
- Deployed acceptance still needs a real environment run with `E2E_BASE_URL`, `E2E_API_BASE_URL`, and customer-owned credentials where applicable.

## Remaining Production Gaps

This sprint improves test confidence, but it does not close these production blockers:

- Off-server backups still need a real bucket/backup host and restore evidence.
- External alert routing still needs a real webhook/email/SMS destination.
- Billing/subscription payment collection is still manual/external; no payment provider is connected.
- Tenant hard-delete remains an offline guarded purge job, not a browser action.
- SmartLabs, Postiz, GHL, WhatsApp, Telegram, social OAuth, OpenClaw, agentgateway, and AgentScope require real tenant credentials/endpoints and production acceptance tests.
- Independent penetration testing and final browser CSP/security verification are still required.
