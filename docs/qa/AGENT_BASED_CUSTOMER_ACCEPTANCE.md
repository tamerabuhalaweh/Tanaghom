# Agent-Based Customer Acceptance

## Purpose

This acceptance harness gives delivery a repeatable customer-flow check before asking a customer to perform UAT. It covers the deployed Hybrid product from six role perspectives and combines that evidence with the existing isolated production acceptance workflow.

It does not replace customer UAT, live connector acceptance, an independent security review, or human approval of business policy.

## What An Agent Means Here

The six browser agents are deterministic, objective-driven Playwright operators. Each agent receives:

- a business objective;
- a role-specific account;
- an isolated browser context;
- allowed workspaces and expected permission boundaries;
- release assertions for browser errors, API failures, layout overflow, raw IDs, and internal/test wording.

This is intentionally more reliable than allowing an LLM to decide whether a broken response should pass. Stitchi supplies the real LLM interaction in the manager journey. An independent LLM UX evaluator may be added later as advisory evidence, but it must never override deterministic failures.

## Deployed Hybrid Layer

Run:

```powershell
npm run test:e2e:agentic-hybrid-live
```

Default target:

```text
https://tanaghum-hybrid.163-123-180-104.sslip.io
```

The deployed run is read-only or AI-guidance-only. It must not:

- approve or save prepared Stitchi work;
- create acceptance records in the customer workspace;
- change executive report schedules;
- publish content;
- write to GHL;
- send WhatsApp or Telegram messages;
- execute voice calls;
- reveal stored credentials.

### Personas

| Agent                 | Customer objective                                          | Main checks                                                      |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Commercial Manager    | Understand today's work and ask Stitchi for the next action | Today, Plans, Events, Sales & Leads, Stitchi                     |
| Content Specialist    | Prepare content without admin access                        | Content workflow, Integrations redirect, hidden admin navigation |
| CCO / Executive       | Review work and inspect executive reporting                 | Review Content, Executive Dashboard, report readiness            |
| Sales Operations      | Review the lead and follow-up pipeline                      | Lead pipeline, follow-up, customer journey, CRM readiness        |
| Admin / Security      | Inspect production configuration safely                     | Integrations, Operations, Account Security                       |
| Exploratory Read-Only | Validate mobile discoverability and restrictions            | Mobile Today, hidden admin links, privileged-route redirect      |

Every persona produces:

- objective text;
- viewport screenshot;
- JSON evidence with visited routes and observations;
- trace on failure;
- exact console and failed-response findings.

## Isolated Persistence Layer

`e2e/production-acceptance.spec.ts` is the authority for governed commercial persistence, role boundaries, responsive product behavior, and tenant isolation. The fixture manager in `scripts/seed-production-acceptance.ts` creates two dedicated acceptance tenants. It never changes the default tenant or customer users.

The primary acceptance tenant contains temporary manager, CCO, specialist, reviewer, viewer, and admin accounts. A second tenant contains the cross-tenant actor. The fixture includes a completed historical event, verified AED evidence, two historical findings, one deliberately preserved USD plan, a future event, a content campaign, and a revenue line.

The serial acceptance journey verifies:

1. Historical evidence can be previewed without invented results.
2. A specialist cannot approve historical learning.
3. A CCO can approve one finding and reject another.
4. Approved learning becomes available to annual planning.
5. Provider failure returns an honest dependency state and creates no findings.
6. A specialist cannot create an annual plan and a viewer cannot create an execution plan.
7. A manager creates an AED annual plan, monthly initiative, and governed budget allocation.
8. Over-allocation is rejected and records are not silently changed.
9. A manager cannot approve the manager's own annual plan; a CCO can approve it.
10. An execution plan is linked to the annual initiative, future event, campaign, and approved learning.
11. Stitchi can prepare and cancel an action without a write.
12. A manager cannot approve the governed Stitchi action; a CCO can approve and execute it.
13. A duplicate approval is idempotent and does not repeat execution.
14. Audit evidence records Stitchi creation, approval, and completion.
15. Future assessment evidence can trace the execution plan and campaign.
16. Existing USD data remains USD; no automatic currency conversion occurs.
17. The isolation tenant receives `404` for primary-tenant assessment, plan, hierarchy, and Stitchi records.
18. Six browser personas traverse Today, Assessment, Annual Planning, Execution Plans, Events, Content, Sales & Leads, and Stitchi without hidden authorization failures.
19. Customer pages show no raw UUIDs, sprint/test language, console warnings, failed API responses, or horizontal overflow.
20. Annual-plan permissions, keyboard skip navigation, reduced motion, and 1440x900, 1920x1080, 768x1024, and 390x844 layouts are verified.

### Local Or CI Run

Use a disposable database and a password created only for this run:

```powershell
$env:E2E_PRODUCTION_ACCEPTANCE = 'true'
$env:E2E_ACCEPTANCE_PASSWORD = '<temporary-16-plus-character-password>'
$env:E2E_ACCEPTANCE_ACTION = 'seed'
npm run build
npm run acceptance:seed
npm run test:e2e:production
```

Set `DATABASE_URL`, `JWT_SECRET`, `E2E_API_BASE_URL`, and `E2E_BASE_URL` for the target stack. GitHub CI supplies these values and uploads logs, traces, screenshots, and the Playwright report for 14 days.

### Deployed Hybrid Run

A persistence run against Hybrid is allowed only as an explicit release operation because the fixture is confined to `acceptance-primary` and `acceptance-isolation`. Use a new temporary password, seed immediately before each run, and always clean up afterward:

```powershell
$env:E2E_ACCEPTANCE_ACTION = 'cleanup'
npm run acceptance:cleanup
```

Cleanup disables the temporary users, suspends their subscriptions, and archives both acceptance tenants. Confirm cleanup by proving that an acceptance login is rejected. Never reuse the temporary password, never seed the AB environment, and never point this harness at an unrelated deployment.

## GitHub Actions

`Agentic Hybrid Acceptance` is a manual workflow. It accepts a Hybrid base URL, runs the six deployed personas with one worker, and uploads Playwright evidence for 14 days.

Repository secrets may override the seeded acceptance accounts:

- `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD`
- `E2E_SPECIALIST_EMAIL` / `E2E_SPECIALIST_PASSWORD`
- `E2E_CCO_EMAIL` / `E2E_CCO_PASSWORD`
- `E2E_VIEWER_EMAIL` / `E2E_VIEWER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`

Shared acceptance passwords are not permanent production credentials. Before customer go-live, named users must complete onboarding, change passwords, and enable MFA according to the production access policy.

## Release Rule

Before requesting customer UAT:

1. Main CI is green, including isolated production acceptance.
2. Agentic Hybrid Acceptance passes twice consecutively against the deployed Hybrid.
3. Any failure is filed as a GitHub issue with the persona, route, screenshot, trace, and API/console evidence.
4. Connector-dependent cases remain explicitly blocked until the customer provides the required account and credentials.
5. Customer UAT still validates business wording, policy, KPI meaning, and daily-work fit.

## What A Green Run Does Not Prove

- That the customer likes or accepts the product.
- That GHL, Meta, YouTube, Formaloo, Postiz, SmartLabs, WhatsApp, or other connectors work with credentials that were not supplied.
- That an external publish, CRM write, message, or call should be authorized.
- That the platform passed penetration testing.
- That final business thresholds, executive recipients, cadence, retention, or legal policy have customer approval.
