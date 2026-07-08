# Hybrid Product UX Standard

Status: Active for Hybrid v2 customer-facing work.
Owner: Tanaghum delivery engineering.
Purpose: Keep the Hybrid product simple enough for a marketing or sales manager to operate without needing architecture explanation.

## Product Principle

The customer-facing product must be organized around work, not modules.

Primary flow:

1. Home
2. Events
3. Content
4. Review
5. Scheduling
6. Performance
7. Integrations

Admin/Ops/runtime concepts must not be part of the normal daily workflow.

## Customer-Facing Language

Use:

- Home
- Event
- Plan
- Content
- Review
- Scheduling
- Leads
- Sales
- Performance
- Integrations
- Data source
- Connected
- Needs setup
- Waiting for data
- Next action

Avoid in customer pages:

- STITCH
- SAIF
- MCP
- M5
- agentgateway
- AgentScope
- OpenClaw
- runtime bridge
- dry-run policy
- source of truth, unless it is explaining CRM ownership in plain language

Those terms belong only in Admin/Ops evidence pages and technical documentation.

## Navigation Rules

The sidebar is for daily work.

Customer-facing product nav:

- Home: executive overview and next actions.
- Events: event workspace and event planning.
- Content: AI ideas and platform-ready content.
- Review: approval queue.
- Scheduling: publishing package and Postiz handoff.
- Performance: leads, sales, spend, and results.
- Integrations: connect customer-owned systems.

Account setup lives in a collapsed account area:

- My Profile
- Account Security
- AI Settings

Admin/Ops pages live in a collapsed admin area and are visible only to authorized roles.

## Page Layout Rules

Every customer-facing page should follow the same structure:

1. Short title and one-sentence purpose.
2. One primary action.
3. One visible next-action panel when the page has a workflow.
4. Main business data.
5. Empty state that tells the user what to do next.

Do not place three or more unrelated workflows in one visible section.

Do not put technical evidence panels in customer workflow pages.

## Event Workspace Rules

The Event page is the core work surface.

Required structure:

- Event selector on the left for desktop, top for mobile.
- Current event summary.
- Tabs:
  - Overview
  - Plan
  - KPIs
  - Leads
  - Risks
  - Learning
- Each tab must have:
  - a short "What this tab is for" line,
  - one primary next action,
  - business cards/tables,
  - a helpful empty state.

Do not stack long forms, tables, and action cards side by side if they can overlap or squeeze text.

## Dashboard Rules

Dashboards must answer:

- Are we on track?
- What needs attention today?
- Where are leads coming from?
- Are spend and sales moving correctly?
- What should the team do next?

Dashboard charts must have stable heights. Any chart component must use a fixed height, minimum height, or aspect ratio so it cannot render at width/height 0.

## Form Rules

Forms must:

- Explain why the field exists.
- Mark required fields in plain language.
- Validate before submit.
- Show success or failure after submit.
- Never expose raw secrets after save.

Integration forms must be wizards:

1. Save credential.
2. Validate connection.
3. Map fields.
4. Test import.
5. Approve import.

## Empty State Rules

Every empty state must include:

- what is missing,
- why it matters,
- what to do next,
- a button if the user has permission.

Bad: "No data."

Good: "No KPI records yet. Connect a data source or import campaign results so the dashboard can calculate spend, leads, and purchases."

## Role Rules

Marketing manager:

- sees event plan, content, KPI, lead/sales, performance, integrations if allowed.

Sales manager:

- sees event overview, leads, sales tasks, meetings, purchases, no-shows, performance.

Social media manager:

- sees content, review, scheduling, Postiz handoff, platform readiness.

Admin/CCO:

- sees user management, tenant settings, operations, runtime evidence, security, and connector registry.

Viewer:

- sees read-only dashboards and event summaries.

## Definition Of Done For UX Pages

A page is not done unless:

- it has one clear purpose,
- a non-technical user can identify the next action in under 10 seconds,
- no customer page uses internal runtime jargon,
- cards do not overlap on desktop or mobile,
- text wraps cleanly,
- tables scroll horizontally only when unavoidable,
- loading, empty, error, and permission states are handled,
- Playwright smoke testing shows no console errors for the main path.

## Prepared Backlog: UX3 To UX6

### UX3 - Integration Setup Wizard

Goal: make customer-owned integrations simple to configure.

Scope:

- Replace dense credential tables with provider setup cards.
- Each provider card shows: status, last test, what data it imports, next action.
- Flow per provider:
  1. Save credential.
  2. Validate connection.
  3. Map fields.
  4. Run test import.
  5. Approve import.
- Hide runtime infrastructure concepts from customer-facing integration setup.
- Keep raw secrets hidden at all times.

Acceptance:

- A marketing manager can understand why a provider is blocked.
- A configured provider has a visible "test connection" or "test import" action.
- Missing customer credentials are explained as customer-owned prerequisites.

### UX4 - Content Library Closure

Goal: make AI-generated ideas visibly flow into campaign content and scheduling.

Scope:

- Add or strengthen a content library view.
- Show saved ideas/posts by event, campaign, platform, and status.
- Add actions: edit, send to review, mark ready for scheduling, delete.
- On event workspace, show event-linked content from the Content tab.

Acceptance:

- After generating an idea, the user can find it again without guessing.
- Content has a clear path to review and scheduling.

### UX5 - Executive Dashboard Polish

Goal: make the Home page feel like a business control room, not a technical report.

Scope:

- Lead with today's required actions.
- Show event health, revenue, spend, lead funnel, no-show risk, and blocker count.
- Use stable chart/card dimensions.
- Avoid showing empty dashboards as failure; show the next setup action.

Acceptance:

- A CEO or marketing manager can understand event health in under 10 seconds.
- The dashboard tells the team what to do next.

### UX6 - Browser And Visual QA

Goal: prevent regressions before customer release.

Scope:

- Add Playwright smoke tests for admin, marketing manager, sales manager, social media manager, and viewer.
- Test desktop and mobile breakpoints.
- Assert no console errors on the main path.
- Assert no horizontal overflow on customer pages.
- Capture screenshots for Home, Events, Integrations, Content, Review, Scheduling, and Performance.

Acceptance:

- Browser tests pass locally and in CI where practical.
- Screenshots show no overlapping cards or unreadable text.
