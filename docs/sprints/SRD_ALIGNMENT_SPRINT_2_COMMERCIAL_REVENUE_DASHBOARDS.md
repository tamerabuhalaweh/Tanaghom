# SRD Alignment Sprint 2 - Commercial Revenue Dashboards And Planning Workflows

## Purpose

Sprint 1 created the Commercial Command Center foundation: revenue lines, the three-stage operating model, and Stitchi-safe internal actions.

Sprint 2 turns that foundation into a daily operating workspace for the Commercial department. The goal is to help a marketing and sales manager understand each revenue line, plan what needs to happen, track commercial outcomes, and ask Stitchi to prepare safe internal work.

This sprint must keep the Event workspace strong, but it must not make Events the whole product. Events are one revenue line and one operating workflow inside the larger Commercial Command Center.

## Product Scope

### Revenue-Line Dashboards

Create a dashboard view for each SRD revenue line:

- Live Events
- Online Courses
- B2B
- Platinum Elite
- Certified Trainer Network
- Loyalty And Community

Each dashboard should show honest data only:

- planned revenue target
- known revenue from existing internal records where available
- lead count
- purchase count
- active plans
- open risks or assessment signals
- linked events or campaigns
- connector/data status
- next recommended work item

If the data source is missing, the UI must say what is missing and what the user should do next. Do not invent performance.

### Three-Stage Planning Workspace

Expand the Commercial Command Center into usable stage panels:

1. Assess
   - market/customer signals
   - barriers and risks
   - current performance summary
   - missing-data checklist

2. Strategy And Planning
   - revenue-line objective
   - target audience
   - offer
   - budget target
   - campaign/event links
   - channel plan
   - owner and due dates

3. Implementation And Engagement
   - active commercial plans
   - linked event operations
   - content/sales tasks where available
   - lead/customer handoff status
   - blocked connector actions

### Budget And Revenue Rollups

Add backend and UI support for commercial-level rollups:

- revenue target vs known revenue
- planned budget vs known spend
- cost-per-lead where KPI data exists
- cost-per-purchase where KPI data exists
- conversion summary where lead lifecycle data exists

Important: customer credentials and external APIs are customer-owned. If Meta, YouTube, GHL, Formaloo, or other sources are not configured, rollups must show "missing data source" rather than fake values.

### Plan Detail Forms

Commercial plans must become editable and useful, not only a card/list.

Add or improve forms for:

- plan title
- stage
- horizon
- revenue line
- objective
- expected outcome
- owner
- due date
- budget target
- linked event
- linked campaign
- status
- notes

### Commercial-To-Event Bridge

Events remain the operational workspace for live event execution. Sprint 2 must provide a clean bridge:

- show which events are linked to a revenue line
- show which plans are linked to an event
- allow a manager to create a plan that links to an existing event
- do not duplicate event-specific functionality inside the Commercial Command Center

### Stitchi Integration

Every new useful workflow must be exposed safely to Stitchi where appropriate.

Sprint 2 Stitchi requirements:

- read revenue-line dashboard context
- read commercial rollup context
- propose a commercial plan update
- create a commercial plan after approval
- create an assessment signal after approval
- explain missing data sources in business language
- never call external connectors directly
- never publish, schedule, send, write CRM records, or trigger voice/chat

## Out Of Scope

- Real Meta Ads API import.
- Real YouTube API import.
- Real GHL pull-sync acceptance run.
- Real WhatsApp sending.
- Real Postiz scheduling.
- Autonomous external execution.
- Billing/subscriptions.

These are not ignored. They remain later integration and production-hardening tracks and are blocked until customer-owned credentials, provider app setup, and mapping validation are available.

## Backend Deliverables

- Add commercial dashboard aggregation by revenue line.
- Add revenue-line detail endpoint if needed.
- Add plan update endpoint if missing.
- Add typed DTOs for dashboard/rollup responses.
- Add tenant isolation tests.
- Add RBAC tests for normal commercial users.
- Add Stitchi context support for Sprint 2 dashboard data.
- Add Stitchi action support only for safe internal commercial actions.

## Frontend Deliverables

- Replace foundation-only Commercial Command Center cards with a product workspace.
- Add revenue-line selector/details.
- Add clear three-stage tabs or panels.
- Add plan detail form.
- Add budget/revenue rollup cards using real internal data only.
- Add event bridge section.
- Add Stitchi call-to-action using business language.
- Remove internal technical wording from customer path.
- Ensure normal users do not see admin-only controls.

## QA Deliverables

- Backend unit tests for dashboard aggregation and permissions.
- Frontend build and lint.
- Browser walkthrough for:
  1. Login as commercial/marketing manager.
  2. Open Commercial Command Center.
  3. Select a revenue line.
  4. Create or update a plan.
  5. Link a plan to an existing event where available.
  6. Ask Stitchi for next commercial action.
  7. Confirm no console errors or hidden 403s.
- Visual QA for desktop and mobile alignment.

## Acceptance Criteria

- A non-admin commercial user can understand what to do next without reading architecture notes.
- Each SRD revenue line is visible and can be planned.
- Commercial plans are editable through the UI.
- Dashboard values are derived from real internal records or shown as missing.
- Events are clearly linked as an operational workflow, not confused with the whole commercial product.
- Stitchi can read and propose safe commercial work.
- No external action is executed without customer credentials and explicit authorization.
- CI is green.
- Deployment is attempted only on the Hybrid deployment target.

## GitHub Issue Split

Created issues:

- #117 SRD-S2 Epic: Commercial Revenue Dashboards And Planning Workflows.
- #118 SRD-S2: Revenue-Line Dashboard API And Rollups.
- #119 SRD-S2: Commercial Plan Detail Forms And Update API.
- #120 SRD-S2: Three-Stage Commercial Workspace UX.
- #121 SRD-S2: Commercial-To-Event Bridge.
- #122 SRD-S2: Stitchi Commercial Planning Context And Actions.
- #123 SRD-S2: Browser QA And Visual Acceptance.

## Completion Report Requirements

The Sprint 2 completion report must include:

- commit SHA
- PR URL
- CI run URL
- backend test result
- frontend build result
- browser QA result
- deployed Hybrid smoke result, or exact deployment blocker
- remaining gaps with no sugar-coating
