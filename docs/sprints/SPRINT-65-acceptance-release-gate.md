# Sprint 65 - Acceptance Workflow and Deployed Release Gate

## Goal

Add the executable customer acceptance workflow and deployed VPS release-gate evidence package.

## Issues

- Refs #80 - End-To-End Customer Acceptance Workflow
- Refs #82 - Deployed VPS Smoke And Release Gate

These issues should remain open until the deployed workflow has passed twice and the release-gate evidence is filled with the actual environment, commit SHA, tester, and results.

## Deliverables

| Deliverable | Path | Purpose |
|---|---|---|
| Sprint 65 Playwright acceptance test | `e2e/sprint65-customer-acceptance.spec.ts` | Validates login, event path, strategy wizard, event dashboard, content/review/scheduling/performance, master dashboard, connector setup, release-gate API endpoints, and secret exposure checks. |
| NPM test script | `package.json` | Adds `npm run test:e2e:sprint65`. |
| Manual GitHub workflow | `.github/workflows/sprint65-acceptance.yml` | Allows deployed acceptance to run from GitHub Actions with environment URLs and secrets. |
| Customer acceptance workflow | `docs/evidence/sprint-65/CUSTOMER_ACCEPTANCE_WORKFLOW.md` | Defines the 15-minute manual path and pass criteria. |
| Deployed VPS release gate | `docs/evidence/sprint-65/DEPLOYED_RELEASE_GATE.md` | Records deployed smoke and operations evidence. |

## Safety Rules

- The default acceptance test is read-only.
- Event/lead writes require `E2E_ALLOW_ACCEPTANCE_WRITES=true`.
- Write-path mode must only run on an approved sandbox/test tenant.
- No raw secrets are expected in UI/API responses.
- Customer-owned missing credentials are accepted only when the product clearly explains the blocker.
- External publishing, CRM writes, messaging, voice execution, and M5/write execution remain blocked unless separately authorized.

## Validation Plan

Local/code validation:

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e:sprint65` with acceptance env disabled, proving the spec is registered and safely skipped by default.
- frontend lint/build

Deployed validation after merge/deployment:

- Run Sprint 65 GitHub workflow against the deployed VPS.
- Run manual 15-minute rehearsal twice.
- Fill `docs/evidence/sprint-65/DEPLOYED_RELEASE_GATE.md`.
- Attach Playwright report and release-gate evidence to the final production readiness pack.

## Current Status

Implemented as an acceptance/release-gate foundation. Final issue closure is pending deployed execution evidence.
