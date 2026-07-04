# Integration UX Correction Plan

Status: Approved - Sprint I1 implemented; Sprint R0 truth cleanup implemented; Sprint R1 runtime evidence implemented; runtime integration phases pending  
Scope: Hybrid Tanaghum product UI and integration architecture  
Date: 2026-07-04

## Decision

The current Connector Setup experience is too technical for customers. It exposes backend infrastructure as if it were customer-owned business integrations. This must be corrected.

The customer-facing product should show business systems:

- GoHighLevel CRM and messaging
- Postiz scheduling
- Meta / Instagram Ads and analytics
- YouTube analytics
- Formaloo / forms
- SmartLabs voice/chat
- AI model provider
- CSV/manual KPI fallback

The customer-facing product should not show backend infrastructure as setup cards:

- agentgateway
- AgentScope
- OpenClaw
- MCP runtime
- runtime bridges
- connector import jobs

Those remain internal platform services or Admin/Ops evidence only.

## Product Principle

Customers should not configure architecture. Customers should connect business accounts.

Tanaghum should feel like:

1. Connect my business systems.
2. Let AI prepare campaigns and content.
3. Let humans approve decisions.
4. Pull real lead, spend, reach, meeting, and purchase data.
5. Show what is working and what needs action.

## Corrected Architecture

Customer-facing:

```text
Tanaghum UI
  -> GoHighLevel CRM
  -> Meta / Instagram Ads
  -> YouTube Analytics
  -> Postiz
  -> Formaloo / Forms
  -> SmartLabs Voice
  -> AI Provider
```

Internal platform:

```text
Tanaghum Backend
  -> RBAC / Tenant / Audit / Approval
  -> Connector adapters
  -> agentgateway, where network policy mediation adds value
  -> AgentScope, where agent runtime/session isolation adds value
  -> OpenClaw, where channel orchestration adds value
  -> MCP/tool mediation where tool import and governance add value
```

The internal runtime must not become the source of truth. Tanaghum remains the source of truth for tenant data, approvals, audit, and business state.

## GoHighLevel Product Position

GoHighLevel should be promoted to a primary integration because it can cover many of the customer's daily operating needs:

- Leads and contacts
- Tags
- Pipeline stages
- Opportunities
- Purchases and sales outcomes
- Meeting/appointment states where available
- Conversations and messaging readiness
- WhatsApp, when configured through the customer's GHL/LeadConnector setup
- Workflow visibility and future workflow triggering, if authorized

Tanaghum's role:

- GHL is the CRM source of truth.
- Tanaghum is the AI operating, approval, orchestration, and reporting layer.
- Tanaghum should pull from GHL, map into event dashboards, and prepare/write back only when explicitly authorized.

GHL does not fully replace:

- Meta / Instagram Ads performance APIs
- YouTube analytics APIs
- Postiz scheduling
- SmartLabs voice/chat execution

## Corrected Information Architecture

### Customer Navigation

The customer-facing navigation should stay simple:

- Dashboard
- Events
- Growth Engine
- Content Creator
- Review & Approve
- Scheduling
- Performance
- Integrations

### Integrations Page

Rename "Connector Setup" to "Integrations".

Primary cards:

1. GoHighLevel CRM
   - Leads, tags, stages, purchases, meetings, WhatsApp readiness.
2. Meta / Instagram Ads
   - Spend, reach, dark ads, forms, campaign performance.
3. YouTube Analytics
   - Video reach and engagement.
4. Postiz Scheduling
   - Approved content scheduling.
5. Formaloo / Forms
   - Form submissions and event interest.
6. SmartLabs Voice
   - Voice/chat agent handoff and response validation.
7. AI Model
   - Tenant-owned AI provider key.
8. CSV Import
   - Controlled fallback when official APIs are not connected.

Admin/Ops hidden section:

- Runtime Infrastructure
- agentgateway health
- AgentScope health
- OpenClaw health
- MCP tool registry
- Connector import evidence

This section must be hidden from normal marketing/sales users.

## Required UX Changes

### 1. Replace Technical Setup Cards

Remove these from the customer-facing integration grid:

- agentgateway
- AgentScope
- OpenClaw

Do not delete backend readiness. Move it to Admin/Ops.

### 2. Make GoHighLevel First

The first integration flow should be "Connect GoHighLevel".

Wizard steps:

1. Choose auth method:
   - Private Integration Token for one customer/location.
   - OAuth for SaaS/multi-location later.
2. Enter token and location ID.
3. Test connection.
4. Pull tags, pipelines, stages.
5. Map GHL tags/stages to Tanaghum lead status and temperature.
6. Preview leads/opportunities.
7. Enable read sync.
8. Keep write sync approval-gated.

Customer copy:

"GoHighLevel remains your CRM. Tanaghum reads CRM activity, shows event performance, and prepares AI-assisted next actions."

### 3. Move WhatsApp Under GoHighLevel

Do not show WhatsApp as a first-level integration unless the customer uses a non-GHL WhatsApp provider.

Default model:

```text
GoHighLevel
  -> WhatsApp setup/status
  -> conversations/messages readiness
  -> workflow readiness
```

The UI should say:

"WhatsApp is managed through your GoHighLevel/LeadConnector account when enabled there."

### 4. Keep Meta / Instagram Separate

Meta / Instagram is still required for ad-level truth:

- spend
- reach
- impressions
- dark ads
- audience targeting
- forms/leads where applicable
- campaign/ad set/ad performance

Wizard steps:

1. Connect Meta account/OAuth.
2. Select ad account/page/Instagram business account.
3. Select event/campaign mapping.
4. Run read-only preview.
5. Approve KPI import.

### 5. Keep YouTube Separate

YouTube is still required for video analytics.

Wizard steps:

1. Connect YouTube/Google OAuth or configured API credentials.
2. Select channel/videos/campaign mapping.
3. Run read-only preview.
4. Approve KPI import.

### 6. Keep Postiz Focused

Postiz is scheduling/publishing surface only.

Wizard steps:

1. Save Postiz API key/base URL.
2. Show Postiz workspace status.
3. Show eligible channels.
4. Select event/channel mapping.
5. Prepare scheduling payload only after approval.
6. Real scheduling remains gated by approval and environment flags.

### 7. SmartLabs Voice

SmartLabs should be shown as:

"Voice/Chat Agent"

Wizard steps:

1. Save SmartLabs API key.
2. Test agents list.
3. Test voices list.
4. Prepare lead handoff payload.
5. Execute only against test lead when explicitly authorized.

## Backend Service Positioning

### agentgateway

Use internally when it adds:

- network policy enforcement
- MCP/tool traffic mediation
- observability
- external service routing
- rate/policy controls

Do not show as a customer connector.

### AgentScope

Use internally when it adds:

- agent runtime isolation
- session/workspace separation
- tool sandboxing
- observable agent execution
- multi-agent coordination

Do not show as a customer connector.

### OpenClaw

Use internally or as channel infrastructure when it adds:

- WhatsApp/Telegram/Slack/Teams channel orchestration
- chat command routing
- approval notifications
- channel-to-Tanaghum API calls

Do not show as a customer connector unless the customer is explicitly managing channels through OpenClaw.

## Implementation Phases

### Sprint R0 - Runtime Truth Cleanup

Status: Implemented.

Customer-facing setup no longer treats OpenClaw, agentgateway, or AgentScope as customer-owned connectors. Legacy dashboard wording no longer presents OpenClaw as ready/checking. Product docs now describe these services as optional Admin/Ops runtime infrastructure with production pilots still pending.

### Sprint R1 - Admin/Ops Runtime Infrastructure Evidence

Status: Implemented.

Runtime infrastructure evidence now lives on an Admin/CCO-only page, separate from the customer-facing Integrations page. The backend `/runtime-bridges/status` endpoint is role-gated to Admin/Ops and returns configured/not configured, reachable/not reachable, execution flags, last check time, production-active state, blockers, and the next production gate for OpenClaw, agentgateway, and AgentScope.

Truth after R1:

- OpenClaw is visible as internal runtime evidence only; it is not orchestrating production customer workflows.
- agentgateway is visible as internal runtime evidence only; no production connector traffic is routed through it.
- AgentScope is visible as internal runtime evidence only; it is not executing production agent sessions.
- The customer-facing Integrations page remains focused on business systems: GHL, Meta/Instagram, Postiz, YouTube, Formaloo, SmartLabs, AI provider, and CSV/manual fallback.

### Sprint I1 - Integration UX Simplification

Goal: Make the page understandable in 30 seconds.

Tasks:

- Rename page to "Integrations".
- Replace setup grid with business integrations only.
- Hide backend runtime services under Admin/Ops.
- Add simple status labels:
  - Not connected
  - Credentials saved
  - Account connected
  - Read sync ready
  - Import approved
  - Write actions blocked
- Add clear "What this powers" copy for each card.
- Remove MCP/runtime jargon from customer-facing copy.

Acceptance:

- A marketing manager understands what to connect.
- No customer-facing cards for agentgateway, AgentScope, OpenClaw.
- Backend infrastructure still visible to admin/ops only.
- No raw secrets displayed.
- No fake connected states.

### Sprint I2 - GoHighLevel Primary Wizard

Goal: Make GHL the main lead/sales/WhatsApp integration.

Tasks:

- Build GHL wizard around Private Token and Location ID.
- Show SaaS note: OAuth will be used for multi-customer SaaS later.
- Test connection without exposing token.
- Pull/preview tags and pipeline stages.
- Map GHL tags/stages to:
  - Tanaghum lead status
  - Tanaghum lead temperature
  - event purchase/no-show/meeting states where possible
- Show WhatsApp readiness as part of GHL.
- Keep GHL writes disabled unless explicitly enabled and approved.

Acceptance:

- User can understand GHL as CRM source of truth.
- User can see required credentials and exact next step.
- User can preview tags/stages before syncing.
- No real write-back occurs without approval and runtime flags.

### Sprint I3 - Advertising Analytics Setup

Goal: Make real campaign KPI import understandable.

Tasks:

- Meta / Instagram wizard:
  - connect account
  - select ad account/page/Instagram account
  - map event/campaign
  - preview KPI rows
  - approve import
- YouTube wizard:
  - connect channel/API
  - map event/campaign
  - preview KPI rows
  - approve import
- Keep CSV/manual import as fallback, not the default production path.

Acceptance:

- User knows how verified metrics enter dashboards.
- "Verified metrics pending" points to a specific integration step.
- Event dashboard distinguishes:
  - no verified data
  - imported data
  - connector data
  - manual fallback data

### Sprint I4 - Postiz Scheduling Setup

Goal: Make scheduling path simple and safe.

Tasks:

- Show Postiz workspace status.
- Show channel list/status.
- Select default scheduling channel per event.
- Show approved package -> Postiz payload.
- Keep real scheduling blocked unless:
  - package approved
  - channel selected
  - sandbox/test flag enabled
  - audit record created

Acceptance:

- User sees what Postiz will do.
- User does not confuse "credential saved" with "publishing active".
- Scheduling path is visible but safely gated.

### Sprint I5 - Runtime Infrastructure Admin/Ops

Goal: Use backend runtime power without confusing customers.

Tasks:

- Create Admin/Ops Runtime page.
- Move agentgateway, AgentScope, OpenClaw there.
- Show only:
  - configured/not configured
  - reachable/not reachable
  - last health check
  - what backend capability it powers
- No normal user navigation entry.

Acceptance:

- Customer-facing UI is clean.
- Admin can still inspect runtime services.
- No runtime service appears as a business connector.

### Sprint I6 - Evidence And QA

Goal: Prove the corrected flow works.

Tasks:

- Browser walkthrough test:
  - login as admin
  - open Integrations
  - configure GHL credential status
  - verify WhatsApp is nested under GHL
  - verify runtime infrastructure hidden from customer role
  - verify no failed API calls
  - verify no console errors
- Role test:
  - admin can configure
  - marketing manager can configure allowed business integrations
  - social/sales users cannot see tenant/admin infrastructure
- Regression:
  - existing backend tests green
  - frontend build green
  - GitHub CI green

Acceptance:

- No implementation is marked complete without functional/browser evidence.

## Open Questions Before Implementation

These should be answered before or during Sprint I2:

1. Is the first customer using a single GHL location or multiple sub-accounts?
2. Will the first connection use Private Integration Token first, then OAuth later?
3. Which GHL pipeline represents event sales?
4. Which tags indicate purchased, booked meeting, no-show, warm, hot, cold?
5. Is WhatsApp fully configured inside GHL/LeadConnector for this customer?
6. Which Meta assets will be connected:
   - ad account
   - Facebook page
   - Instagram business account
   - lead forms
7. Which YouTube channel/videos map to the event campaigns?

## Non-Negotiable Rules

- No raw API keys or tokens displayed after save.
- No fake "connected" states.
- No write-back without explicit approval.
- No auto messages, auto CRM writes, voice triggers, or publishing by default.
- No customer-facing backend jargon.
- No runtime infrastructure listed as a business integration.
- All visible actions must either work or clearly explain what is needed.

## GitHub Execution Discipline

Each sprint must have:

- One issue or clearly referenced issue set.
- One branch.
- One PR.
- CI green before merge.
- Browser evidence for UI-heavy work.
- Completion report listing:
  - fixed
  - tested
  - still blocked
  - customer action needed

## Suggested First GO Scope

If owner approves, start with Sprint I1 only:

1. Rename and simplify the Integrations page.
2. Remove agentgateway, AgentScope, OpenClaw from customer-facing cards.
3. Put GHL first and move WhatsApp under GHL.
4. Preserve existing backend endpoints.
5. Deploy to hybrid.
6. Run browser smoke test.

Do not start GHL live sync changes until Sprint I1 is accepted visually.
