# Sprint 60 - Per-Event Dashboard And Manual KPI Tracking

## Status

In implementation on branch `feature/sprint-60-per-event-dashboard-kpi-tracking`.

This sprint is owned by Codex for product UX, dashboard composition, KPI behavior, and acceptance testing.

## Product Context

Amro is the Marketing and Sales Manager. His work is event-centered:

1. Choose an event.
2. Review the event strategy.
3. Track campaign execution.
4. Monitor leads, forms, meetings, purchases, no-shows, spend, and interaction.
5. Decide what needs attention today.
6. Learn what to improve for the next event.

When Amro logs in, he should not see an engineering dashboard. He should see his event operating dashboard.

## Primary User

### Amro - Marketing/Sales Manager

Role expectation:

- Can view and operate assigned events.
- Can see event-level KPIs.
- Can enter manual KPI updates where integrations are not connected.
- Can inspect lead and sales funnel state.
- Can identify next required actions.
- Can prepare customer-owned connector handoff, but cannot bypass approval or tenant credential rules.

### Admin

Role expectation:

- Can view all tenant events.
- Can configure tenant credentials and users.
- Can oversee event dashboard data quality.
- Can review audit/evidence.

## Sprint Goal

Create a production-quality per-event dashboard that can replace Amro's event Google Sheet for the first release.

The dashboard must be real tenant data. Where integrations are not connected yet, the platform must support manual KPI entry/import rather than fake static values.

## Required Sprint 59 API Dependencies

Sprint 60 consumes the Sprint 59 event foundation and adds/uses these APIs:

- `GET /events`
- `GET /events/:eventId`
- `POST /events`
- `PUT /events/:eventId`
- `POST /events/:eventId/transition`
- `GET /events/:eventId/dashboard`
- `POST /events/:eventId/kpis`
- `PUT /events/:eventId/kpis/:kpiId`
- `GET /events/:eventId/leads`
- `GET /events/:eventId/campaigns`

The customer-facing route alias is `/events`; `/commercial-events` remains available for explicit module naming.

If endpoint names change, update `frontend/src/api.ts` and this sprint doc before implementation.

## Dashboard Sections

### 0. Event Strategy Wizard

Route:

- `/events/new`

Purpose:

Create the event workspace from Amro's planning process before KPI tracking begins.

Fields:

- event type
- event date
- location
- expected attendance
- revenue target
- planned budget
- campaign timing
- offer
- audience
- geography
- FOMO angle
- upsell plan
- channels
- content department requirements
- sales team requirements

Rules:

- Saves through the real `/events` API.
- Does not send messages, ads, CRM writes, or external actions.
- Uses templates only as editable starting points, not fake saved records.
- Routes to the per-event dashboard after successful creation.

### 1. Event Header

Show:

- event name
- event type
- event date
- location
- campaign start date
- days remaining
- owner
- status

User value:

Amro immediately understands which event he is operating.

### 2. Executive KPI Strip

Show:

- new leads
- form completions
- meetings booked
- purchases
- no-shows
- planned budget
- actual spend
- budget variance
- interaction rate

User value:

Amro sees whether the event is selling, stuck, or needs urgent action.

### 3. Funnel

Stages:

- reach
- interactions
- form completions
- leads
- meetings booked
- purchases
- no-shows

User value:

Amro can identify the weak point in the campaign.

### 4. Budget And Spend

Show:

- planned budget
- actual spend
- remaining budget
- cost per lead
- cost per purchase
- spend status

Manual entry allowed until Meta/YouTube integrations are connected.

### 5. Channel Performance

Channels:

- Instagram
- Meta Ads
- YouTube
- WhatsApp
- Email
- Organic
- Dark Ads
- Referral

Show:

- reach
- interactions
- leads
- purchases
- conversion rate

### 6. Lead Temperature

Groups:

- cold
- warm
- hot
- buyer
- no-show

Show counts and recommended follow-up action.

### 7. Next Actions

Examples:

- Add actual spend for Meta Ads.
- Review WhatsApp sequence.
- Follow up with hot leads.
- Improve low interaction creative.
- Prepare buyer reminder email.
- Check no-show list.

### 8. Manual KPI Entry

Required fields:

- metric date
- channel
- reach
- impressions
- interactions
- clicks
- form completions
- leads
- meetings booked
- meetings attended
- purchases
- no-shows
- spend
- notes

Rules:

- Data must be tied to one event.
- Data must be tenant-scoped.
- Data source must be visible: manual, imported, connector.
- Manual records must show who entered them.

### 9. Event Lead Table

Show:

- lead name
- source/channel
- temperature
- lifecycle status
- meeting status
- purchase status
- consent status
- last action
- next follow-up

### 10. Learning Signals

Show:

- best channel
- weakest funnel stage
- best CTA
- most common customer problem
- recommended adjustment for the next event

## UX Rules

- This page must be business-first, not architecture-first.
- Do not use STITCH/SAIF/MCP/M5 jargon in Amro's main path.
- Do not show raw UUIDs in customer-facing tables.
- Do not show fake static numbers.
- Empty states must explain what to do next.
- Manual KPI entry is acceptable only when clearly marked as tenant-entered data.
- External connector gaps must say what credential/setup is missing.

## Frontend Implementation Scope

Expected files:

- `frontend/src/pages/EventDashboard.tsx`
- `frontend/src/pages/EventStrategyWizard.tsx`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`
- shared dashboard components if needed under `frontend/src/components/`

Navigation:

- Add customer-facing product nav item:
  - label: `Events`
  - description: `Event dashboard and sales results`
  - route: `/events`

Preferred route behavior:

- `/events` shows event list and selects active/nearest event.
- `/events/new` creates the event strategy/workspace.
- `/events/:eventId` shows per-event dashboard.

## Backend Implementation Scope

Sprint 60 should not duplicate Sprint 59 schema work.

If Sprint 59 does not provide KPI tables, Sprint 60 may add KPI tracking models only after the Event schema is merged.

Expected KPI entity:

- tenant key
- event id
- source type: manual, imported, connector
- source name
- metric date
- channel
- reach
- impressions
- interactions
- clicks
- form completions
- leads
- meetings booked
- meetings attended
- purchases
- no-shows
- spend
- notes
- created by user
- updated by user

## Tests Required

Backend:

- event dashboard summary uses only the current tenant
- KPI records require event ownership
- manual KPI create/update works
- dashboard calculations are deterministic
- no cross-tenant event/KPI leakage

Frontend:

- event strategy wizard creates an event through the real API
- event list renders
- event dashboard renders
- KPI cards render real API values
- manual KPI form validates required fields
- empty states render when no KPI records exist
- route is visible to Amro roles
- admin-only screens remain separate

Playwright:

- login as Amro
- open Events
- create a new event strategy
- select an event
- add manual KPI data
- verify dashboard updates
- verify no console errors

## Acceptance Criteria

- Amro can log in and access event dashboards relevant to his role.
- Event dashboard is event-specific, not generic campaign data.
- Manual KPI entry updates dashboard metrics.
- Event Strategy Wizard creates real event records.
- Lead/funnel numbers are explainable from tenant records.
- Empty states are honest and actionable.
- No fake static numbers.
- No raw technical IDs in the customer path.
- CI is green.
- Browser walkthrough passes.

## Blockers

This sprint cannot be called production-complete until Sprint 59 provides:

- event model
- event API
- event-to-campaign linkage
- event-to-lead linkage
- tenant isolation guarantees

## Out Of Scope

- Meta Ads live import.
- YouTube Ads live import.
- Formaloo live import.
- GHL two-way sync.
- WhatsApp message execution.
- Automated ad optimization writes.

## Explicit Carry-Forward Gaps

These must not be forgotten:

- Official connector import pipeline is not implemented in Sprint 60.
- Customer-owned Meta, YouTube, Formaloo, GHL, WhatsApp, and SmartLabs credentials must be entered through secure tenant settings before automated ingestion.
- Import jobs must support dry-run preview, source mapping, tenant scoping, audit evidence, and rollback/error reporting.
- Full browser Playwright walkthrough must be added before product acceptance/deployment of this branch.

## Completion Report Requirements

Completion report must include:

- implemented API endpoints
- dashboard screenshots
- manual KPI test evidence
- Amro role walkthrough result
- backend test result
- frontend build result
- GitHub CI result
- remaining connector gaps
