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

The existing `e2e/production-acceptance.spec.ts` remains the authority for governed persistence and tenant isolation. GitHub CI starts an isolated PostgreSQL acceptance database, seeds controlled fixtures, and verifies:

1. A manager creates an event and prepares a commercial-plan action through Stitchi.
2. No plan exists before approval.
3. The manager cannot self-approve the governed action.
4. The CCO approves and executes the internal action.
5. The plan is persisted and linked to the event.
6. Content approval follows the same role boundary.
7. A publishing package is prepared with all external execution flags disabled.
8. Audit evidence records approval and package preparation.
9. A second tenant cannot read the plan, conversation, approval, package, or audit evidence.
10. The browser can find the persisted plan and scheduling package without console, API, or horizontal-overflow failures.

This layer may mutate data because its database is temporary and isolated. It must never be pointed at the deployed customer database.

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
