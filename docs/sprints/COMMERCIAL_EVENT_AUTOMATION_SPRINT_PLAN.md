# Commercial Event Automation Sprint Plan

## Purpose

This plan translates the client call with Amro into a phased engineering delivery plan for the Commercial/Social product.

The product direction is now event-centered:

> Event strategy -> content requirements -> campaign execution -> lead capture -> sales follow-up -> performance learning.

The immediate objective is to automate as much of Amro's marketing and sales manager workflow as safely possible while preserving tenant-owned credentials, human approval, auditability, and production controls.

## Delivery Control Model

### Source Of Truth

- Product scope: this document plus the client-approved sprint issue for each sprint.
- Architecture authority: STITCH architecture and current repo control-plane docs.
- Implementation authority: code, Prisma schema, migrations, API contracts, tests, and sprint completion reports.
- AI/agent memory: non-authoritative.

### GitHub Workflow

Every sprint must be tracked as a GitHub milestone or GitHub Project iteration.

Recommended GitHub Project fields:

- `Sprint`: Sprint 59, Sprint 60, etc.
- `Area`: Backend, Frontend, Data, Integration, QA, Docs, DevOps.
- `Priority`: P0, P1, P2, P3.
- `Status`: Backlog, Ready, In Progress, In Review, CI Green, Deployed, Accepted.
- `Owner`: human dev or AI dev owner.
- `Blocked By`: credential, decision, dependency, API access, design.
- `PR`: pull request URL.
- `Evidence`: test run, screenshot, smoke result, deployment note, acceptance report.

Recommended labels:

- `sprint-59`, `sprint-60`, `sprint-61`, `sprint-62`, `sprint-63`
- `area/backend`, `area/frontend`, `area/data`, `area/integration`, `area/qa`, `area/docs`
- `priority/p0`, `priority/p1`, `priority/p2`
- `blocked/customer-credential`, `blocked/customer-decision`, `blocked/external-api`
- `needs-codex-review`, `needs-product-review`, `needs-deployment`

### Branch And PR Rules

- Main branch remains protected.
- One sprint branch per sprint:
  - `feature/sprint-59-event-foundation-strategy-wizard`
  - `feature/sprint-60-per-event-dashboard-kpi-tracking`
  - `feature/sprint-61-event-campaign-planner`
  - `feature/sprint-62-lead-lifecycle-attribution-sales`
  - `feature/sprint-63-master-events-learning-loop`
- If multiple developers work in the same sprint, use short-lived sub-branches and merge into the sprint branch through reviewed PRs.
- Prisma schema/migration ownership must be single-owner per sprint to avoid migration conflicts.
- No sprint branch may merge until GitHub CI is green and the sprint acceptance checklist is complete.

### Required CI Gates

Existing GitHub CI must remain required:

- Backend lint
- Backend typecheck
- Backend tests
- Backend build
- Backend runtime smoke
- Frontend lint
- Frontend build
- Docker build
- Docker compose validation
- Secret scan
- Demo/live safety checks

Additional sprint-specific checks should be added as implementation grows:

- Event tenant-isolation tests
- Event dashboard API contract tests
- Event workflow Playwright walkthrough
- Data migration validation
- Deployed acceptance workflow after VPS deployment

## Sprint Documentation Requirements

Each sprint must create:

- `docs/sprints/SPRINT-XX-<name>.md`
- Sprint GitHub issue or milestone
- PR description with scope, out-of-scope, tests, and screenshots where UI changed
- Completion report with:
  - commit SHA
  - changed files summary
  - CI result
  - manual QA result
  - deployed smoke result if deployed
  - remaining gaps

## Definition Of Ready

A sprint is ready only when:

- The user story is clear.
- Backend/data ownership is clear.
- Frontend screens are named.
- Test plan is written.
- Out-of-scope is explicit.
- Required customer credentials/decisions are identified.
- Acceptance criteria are testable.

## Definition Of Done

A sprint is done only when:

- Backend and frontend are wired together.
- No customer-facing page depends on fake static data unless explicitly marked as sample/template content.
- Tenant isolation is tested where tenant data is touched.
- CI is green.
- Frontend build is green.
- Playwright or equivalent walkthrough covers the main user path.
- Sprint completion report exists.
- Remaining gaps are listed honestly.
- Codex review is complete before merge.

## Parallel Work Lanes

### Lane A - Data And Backend

Owns Prisma schema, migrations, service layer, API contracts, tenant isolation, workflow state, and tests.

### Lane B - Product UI

Owns event-centered screens, dashboard layout, guided workflows, forms, tables, empty states, and user-facing copy.

### Lane C - Analytics And Reporting

Owns KPI calculations, manual/imported performance data, event dashboards, master dashboard, and learning summaries.

### Lane D - Integrations

Owns Postiz, GoHighLevel, WhatsApp, SmartLabs, social OAuth, Meta/YouTube/Formaloo readiness, and customer-owned credential handling.

### Lane E - QA, CI, And Deployment

Owns Playwright walkthroughs, production readiness checks, GitHub Actions, deployed smoke tests, backups/ops evidence, and acceptance reports.

## Sprint 59 - Event Foundation And Strategy Wizard

### Goal

Create the first-class event operating model that Amro's workflow depends on.

### Scope

- Add event data model for Commercial/Social events.
- Add event types:
  - Tagyeer wa Irtaqi
  - Moaaskar Al-Tamayoz
  - Business Camp
  - Virtual Event
- Add event fields:
  - name
  - type
  - date
  - location
  - campaign start date
  - campaign end date
  - expected attendance
  - revenue target
  - planned budget
  - owner
  - status
  - tenant key
- Link campaigns, leads, publishing packages, and performance records to events.
- Add Event Strategy Wizard:
  - objective
  - audience
  - geography
  - offer
  - FOMO angle
  - upsell plan
  - channels
  - content department requirements
  - sales team requirements

Note: Sprint 59 delivered the backend foundation. The customer-facing Event Strategy Wizard UI is completed in the Sprint 60 Lane B branch so it can create real `/events` records and route into the per-event dashboard.

### Out Of Scope

- Live Meta Ads integration.
- Live YouTube Ads integration.
- Live GHL write.
- Live WhatsApp execution.

### Acceptance Criteria

- Admin/manager can create an event.
- Campaign start date can be derived from the event date.
- A campaign can be linked to an event.
- Leads can be linked to an event.
- Tenant A cannot read Tenant B events.
- Event list and event detail page load from backend API.
- CI green.

### Suggested Work Split

- Lane A: Prisma model, migration, API routes, tenant tests.
- Lane B: Event list/detail UI and strategy wizard UI.
- Lane E: Playwright event creation walkthrough.

## Sprint 60 - Per-Event Dashboard And Manual KPI Tracking

### Goal

Replace Amro's event Google Sheet with a production event dashboard.

### Scope

- Per-event dashboard with:
  - new leads
  - form completions
  - meetings booked
  - purchases
  - no-shows
  - no-show rate
  - planned budget
  - actual spend
  - budget variance
  - reach
  - interactions
  - interaction rate
  - email performance
  - WhatsApp performance
  - lead temperature breakdown
  - channel attribution
- Manual KPI entry/import path until official integrations are connected.
- Event-specific lead table.
- Event-specific campaign status.

### Out Of Scope

- Automated Meta/YouTube spend import.
- Automated GHL purchase sync.
- Automated Formaloo sync.

### Acceptance Criteria

- Per-event dashboard shows event-specific data only.
- Manual KPI records can be created and updated.
- Dashboard metrics update after KPI/lead records change.
- Empty states explain what data is missing and how to add it.
- Tenant isolation tests cover dashboard data.
- Playwright walkthrough covers event dashboard.

### Suggested Work Split

- Lane A: KPI model/API and dashboard aggregation.
- Lane B: Dashboard UI with CEO-readable KPI cards and charts.
- Lane C: metric definitions and calculation tests.
- Lane E: browser walkthrough and visual checks.

## Sprint 61 - Event Campaign Planner

### Goal

Turn Amro's planning process into an operational workflow.

### Scope

- Email campaign planner:
  - number of emails
  - send dates
  - audience segment
  - purpose
  - subject/content draft
  - approval state
- WhatsApp campaign planner:
  - message frequency
  - content type: text, image, video
  - audience segment
  - approval state
- Upsell campaign type for existing customers.
- Content Department requirements:
  - required videos
  - images
  - captions
  - landing-page assets
  - due dates
- Sales team task plan:
  - inquiry response
  - follow-up
  - closing tasks

### Out Of Scope

- Sending real email/WhatsApp messages.
- Writing real CRM automation workflows.

### Acceptance Criteria

- Manager can create event campaign plan.
- Email and WhatsApp plans are tied to event and segments.
- Plans require human approval before execution handoff.
- Content requirements are visible as tasks.
- No outbound message is sent from this sprint.

### Suggested Work Split

- Lane A: planner models/API.
- Lane B: planner UI and workflow.
- Lane C: readiness/coverage calculations.
- Lane E: Playwright campaign planning walkthrough.

## Sprint 62 - Lead Lifecycle, Attribution, And Sales Workflow

### Goal

Model the sales journey from lead to purchase/no-show.

### Scope

- Lead lifecycle:
  - new
  - contacted
  - meeting booked
  - meeting attended
  - no-show
  - purchased
  - lost
- Lead temperature:
  - cold
  - warm
  - hot
  - buyer
- Audience source:
  - follower
  - non-follower
  - existing customer
  - referral
- Channel attribution:
  - Meta
  - Instagram
  - YouTube
  - WhatsApp
  - email
  - organic
  - dark ad
  - referral
- GHL tag taxonomy mapping configuration.

### Out Of Scope

- Live two-way GHL sync.
- Live Meta conversion sync.

### Acceptance Criteria

- Sales user can update lead lifecycle.
- Event dashboard reflects meeting, purchase, and no-show changes.
- Attribution is visible per lead and per event.
- GHL tag mapping can be configured without hardcoded credentials.
- Tenant isolation tests cover leads and attribution.

### Suggested Work Split

- Lane A: lead lifecycle and attribution model/API.
- Lane B: sales workflow UI and event lead table.
- Lane C: conversion funnel calculations.
- Lane D: GHL mapping readiness.
- Lane E: sales workflow browser test.

## Sprint 63 - Master Events Dashboard And Learning Loop

### Goal

Show what worked across events and use it to improve future campaigns.

### Scope

- Master dashboard across all events.
- Event comparison:
  - leads
  - form completions
  - purchases
  - no-show rate
  - budget efficiency
  - interaction rate
  - best channels
- Post-event closeout report.
- Problem/barrier log from forms or manual entries.
- Learning recommendations for next event:
  - best audience
  - best channel
  - best CTA
  - best content format
  - strongest objection/problem patterns

### Out Of Scope

- Fully autonomous strategy changes.
- External ad platform optimization writes.

### Acceptance Criteria

- Admin can compare events.
- Event closeout report can be generated.
- Learning recommendations are traceable to event data.
- Empty states remain honest when no data exists.
- Playwright master dashboard walkthrough passes.

### Suggested Work Split

- Lane A: master aggregation API.
- Lane B: executive dashboard UI.
- Lane C: recommendation logic and tests.
- Lane E: visual QA and acceptance evidence.

## Sprint 64 - Customer-Owned Connector Readiness

### Goal

Prepare production-grade connector configuration around the event model.

### Scope

- Postiz event scheduling channel selection.
- GHL tenant credential wizard and tag mapping validation.
- SmartLabs tenant key and agent ID validation.
- Formaloo/form import readiness.
- Meta/YouTube read-only analytics readiness.
- WhatsApp provider configuration readiness.
- Connector import pipeline:
  - credential status
  - test connection
  - source field mapping
  - dry-run import preview
  - tenant-scoped import job
  - import evidence/audit record
  - error handling and retry state
  - no write-back unless separately approved

### Out Of Scope

- Hardcoded customer credentials.
- Unapproved external writes.
- Scraping or unofficial social algorithm collection.

### Acceptance Criteria

- Each connector has a customer-owned credential setup path.
- Each connector shows verified/missing/blocked state.
- No raw secret is displayed.
- Event dashboard shows which connectors are active for that event.
- Event dashboard can consume connector-imported records after customer credentials are configured.
- External write actions remain approval-gated.

## Sprint 65 - Production Acceptance And Customer Onboarding

### Goal

Turn the event-centered product into a customer-acceptable release candidate.

### Scope

- End-to-end event walkthrough:
  - create event
  - create strategy
  - create campaign plan
  - generate content
  - approve content
  - prepare scheduling
  - capture leads
  - update lifecycle
  - view event dashboard
  - view master dashboard
  - generate closeout report
- Production readiness evidence:
  - CI green
  - deployed smoke pass
  - browser walkthrough pass
  - backup status
  - monitoring status
  - security checklist
  - remaining customer-owned credential list

### Acceptance Criteria

- Customer-facing walkthrough completes in 15 minutes without developer explanation.
- No console errors.
- No failed API calls in normal path.
- All blocked external actions explain exactly what credential/authorization is needed.
- Product status report is ready for client delivery.

## Integration Sequencing Rules

- Build event data foundation before external ad integrations.
- Manual KPI entry is acceptable before official API sync if it is clearly real tenant data, not fake static data.
- Postiz, GHL, SmartLabs, WhatsApp, Meta, YouTube, and Formaloo must be tenant-configured.
- No connector may become source of truth.
- STITCH remains the system of record.
- Human approval remains required before outbound execution.

## Multi-Agent Execution Rules

Multiple developers or AI agents can work safely if these boundaries are respected:

- Backend schema/API changes must be owned by one lead per sprint.
- UI-only work must consume existing API contracts or an approved OpenAPI/API contract stub.
- Integration work must not bypass credential vault or tenant isolation.
- QA agents should write tests against agreed acceptance criteria, not after-the-fact screenshots only.
- No agent may merge its own work without Codex review.

## Required Sprint PR Template

Each PR should include:

```md
## Sprint

Sprint XX - Name

## Scope

- ...

## Out Of Scope

- ...

## Tests

- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm run test
- [ ] npm run build
- [ ] npm --prefix frontend run lint
- [ ] npm --prefix frontend run build
- [ ] npx playwright test --reporter=list

## CI

- [ ] GitHub CI green

## Acceptance Evidence

- ...

## Remaining Gaps

- ...
```

## Immediate Next Action

Start Sprint 59 as the next implementation sprint.

Do not start Meta Ads, YouTube Ads, Formaloo, or full GHL automation before Sprint 59 and Sprint 60 are complete. The event object and per-event dashboard are the foundation required for those integrations to produce meaningful business value.
