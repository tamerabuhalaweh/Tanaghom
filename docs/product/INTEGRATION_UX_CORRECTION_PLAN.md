# Integration UX Correction Plan

Status: Approved - Sprint I1 implemented; Sprint R0 truth cleanup implemented; Sprint R1 runtime evidence implemented; Sprint R2 agentgateway dry-run mediation foundation implemented; Sprint R3 sandbox policy pilot live-accepted; Sprint R4 Postiz read-only adapter live-accepted; Sprint R4A Postiz channel UX deployed/live-validated; Sprint R5 GoHighLevel read-sync adapter deployed with honest customer-credential blocker; Sprint R5A GoHighLevel customer credential acceptance and mapping validation in verification; full production runtime pilots still pending
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

R5A acceptance rule:

- Saving a credential is not enough.
- The customer-owned GHL API key and location ID must pass a read-only connection test.
- The read-only test uses contact search only and never returns raw GHL payloads or secrets.
- Successful acceptance records `last_validated_at` on the tenant credential.
- Failed acceptance returns precise required actions without exposing the key.

R5A mapping rule:

- Tags and pipeline stages must be mapped to valid Tanaghum lead status/temperature values.
- Required production reporting outcomes are:
  - meeting booked
  - meeting attended
  - no-show
  - purchased
  - lost
  - follow-up needed
  - warm / hot / buyer temperature
- The UI must not show "ready" until required outcomes are covered and read sync is environment-authorized.

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

### Sprint R2 - Non-Admin Permission Cleanup + agentgateway Dry-Run Mediation Foundation

Status: Implemented.

Decision: choose agentgateway before OpenClaw for the first runtime pilot.

Reason:

- Connector dry-runs are read/preview operations and are lower risk than workflow/channel orchestration.
- agentgateway's value maps directly to policy mediation, deny/allow behavior, and external-service traffic control.
- OpenClaw remains useful later for channel/orchestration workflows, but it should not be the first runtime pilot because orchestration has a wider blast radius.

What R2 implements:

- The hybrid event workspace no longer calls the forbidden event-problem dashboard endpoint for roles that do not have dashboard permission.
- Normal users can still read event problem records they are allowed to read; the UI computes a local summary instead of producing hidden 403 browser noise.
- Connector dry-runs now pass through a STITCH-owned `mediateConnectorDryRunPolicy` hook before repository execution.
- The hook is disabled by default and returns explicit "not enabled" evidence.
- If `AGENTGATEWAY_DRY_RUN_POLICY_ENABLED=true`, dry-runs require an active tenant `agentgateway` runtime endpoint credential.
- When enabled, STITCH sends a dry-run-only policy payload to agentgateway. The payload explicitly sets `externalWritesAllowed: false` and `importWritesAllowed: false`.
- A denial from agentgateway blocks the dry-run before connector preview execution.

Truth after R2:

- agentgateway is selected as the first low-risk runtime pilot path.
- agentgateway is not yet deployed as production infrastructure on the VPS by this sprint.
- No connector production traffic is routed through agentgateway unless the env flag and tenant runtime credential are configured.
- No external writes, CRM writes, publishing, messaging, voice execution, or OpenClaw orchestration are enabled by this sprint.

### Sprint R3 - agentgateway Sandbox Policy Pilot Activation

Status: Live accepted on the hybrid deployment as a sandbox policy adapter, not full production agentgateway.

Official agentgateway documentation positions agentgateway as a proxy/data plane with routes, listeners, backends, and policies for HTTP, gRPC, MCP, and A2A traffic. It is not a simple built-in custom REST decision API for Tanaghum connector imports. Because of that, R3 activates a narrow sandbox policy target that matches the future gateway contract and can later sit behind a real agentgateway route.

What R3 implements:

- Adds an internal sandbox policy endpoint:
  - `GET /runtime-bridges/agentgateway/sandbox-policy/health`
  - `POST /runtime-bridges/agentgateway/sandbox-policy/connector-dry-run`
- Protects the sandbox policy endpoint with `AGENTGATEWAY_SANDBOX_POLICY_TOKEN`.
- Accepts only `connector_import.dry_run` policy payloads.
- Requires `authority.sourceOfTruth = STITCH`.
- Requires all write flags to be false:
  - `dryRunOnly: true`
  - `externalWritesAllowed: false`
  - `importWritesAllowed: false`
- Allows only supported connector IDs.
- Denies unsupported connector IDs.
- Keeps `productionGateway: false` in responses so nobody mistakes this for full agentgateway production traffic.
- Documents `AGENTGATEWAY_DRY_RUN_POLICY_ENABLED` and `AGENTGATEWAY_SANDBOX_POLICY_TOKEN` in `.env.example`.

Truth after R3:

- The STITCH dry-run mediation hook can now be pointed at a live sandbox policy endpoint.
- The sandbox endpoint proves allow/deny behavior and policy payload shape.
- The VPS can enable `AGENTGATEWAY_DRY_RUN_POLICY_ENABLED=true` only after a tenant runtime credential is saved.
- The hybrid VPS has `agentgateway` runtime evidence configured and reachable.
- A live Postiz connector dry-run was mediated through the sandbox policy adapter and allowed with `externalWritesAllowed: false`.
- A live unsupported connector policy request was denied with `externalWritesAllowed: false` and `productionGateway: false`.
- This is still not full production agentgateway deployment.
- No connector adapter imports real external data because read-only provider adapters are still separate work.
- No external writes, import approvals, publishing, CRM writes, messaging, voice calls, OpenClaw orchestration, or M5 execution are enabled by this sprint.

Live acceptance evidence on 2026-07-06:

- Runtime status: configured `true`, reachable `true`, HTTP `200`, production active `false`.
- Dry-run mediation: mediated `true`, decision `allowed`, policy status `200`.
- Dry-run safety: external writes `false`, raw secrets returned `false`.
- Postiz rows imported: `0`.
- Postiz warning: no read-only Postiz adapter is implemented yet; no external API calls were made and no rows are importable.
- Deny path: unsupported connector returned decision `deny`, dry-run only `true`, external writes `false`, production gateway `false`.

### Sprint R4 - First Real Read-Only Connector Adapter Through Governed Runtime Path

Goal: Turn the R3 policy proof into customer-visible value by wiring one read-only connector preview through the governed runtime path.

Status: Implemented, deployed to hybrid, and live-accepted with Postiz as the first read-only adapter.

Recommended target order:

1. Postiz channel/status and platform analytics adapter.
2. GoHighLevel read sync if the customer provides a token, location ID, tag/stage mapping, and acceptance data.
3. Formaloo read/import adapter if the customer provides form access.
4. Meta/Instagram or YouTube analytics only after customer/provider account access and scopes are confirmed.

What R4 implements:

- Adds a Postiz read-only adapter under `modules/connector-imports/adapters/postiz.ts`.
- Uses Postiz Public API read endpoints only:
  - `GET /integrations`
  - `GET /analytics/{integration}?date=30`
- Uses the tenant-owned `postiz/api_key/default` credential.
- Requires `baseUrl` and `apiKey`.
- Uses optional `integrationId` to select the channel for analytics.
- Returns provider status:
  - channels found
  - selected integration ID
  - selected channel summary
  - analytics fetched yes/no
  - metric labels returned
  - raw secrets returned false
- Maps recognized Postiz analytics labels into KPI dry-run rows:
  - reach
  - impressions/views
  - clicks
  - engagement/interactions/likes/comments/shares/reactions
  - leads
  - form submissions/completions
- Reports unmapped metrics honestly instead of inventing values.
- Keeps unsupported connectors on the existing honest empty-state path.
- Keeps writes blocked:
  - dry-run writes no KPI records
  - import still requires separate approval
  - no scheduling/publishing/CRM/message/voice write occurs

Acceptance:

- Tenant-owned credential is configured.
- Read-only dry-run produces real preview rows or a real provider status result.
- R3 policy mediation remains enabled and records allow/deny evidence.
- No external writes happen.
- Human approval is required before any import/write.
- Audit evidence is recorded.
- UI explains the business outcome in customer language.
- If the provider has no available data, the system reports an honest empty state instead of fake rows.

Verification on 2026-07-06:

- Focused connector tests: 28 passed.
- Full backend tests: 117 files passed, 1763 tests passed.
- Backend lint: passed.
- Backend typecheck: passed.
- Backend build: passed.
- Frontend lint: passed.
- Frontend build: passed.

R4 live acceptance evidence on 2026-07-06:

- Hybrid health: healthy.
- R3 mediation still wraps the dry-run: mediated `true`, decision `allowed`.
- Safety: `externalWritesAllowed: false`, `rawSecretsReturned: false`.
- Provider: Postiz Public API adapter.
- Live tenant credential was valid enough to call Postiz.
- Channels found: `0`.
- KPI rows: `0`.
- Honest blocker returned: Postiz returned zero connected channels. The customer must connect a supported social channel inside Postiz before analytics can return KPI rows.

### Sprint R4A - Postiz Channel Selection UX + Live Channel Validation

Goal: Make the Postiz setup usable for a production customer who owns the Postiz workspace, API key, and social channel setup.

Status: Implemented, deployed to hybrid, and live-validated.

What R4A implements:

- Rebuilds the Postiz section inside `frontend/src/pages/IntegrationCredentials.tsx` into a three-step user workflow:
  1. Save Postiz access.
  2. Choose or paste a Postiz integration/channel ID.
  3. Run a read-only analytics test.
- Keeps the language customer-facing:
  - credential saved
  - channel selected
  - analytics tested
  - no scheduling or publishing from this page
- Adds event selection for analytics validation.
- Creates the Postiz connector import job automatically when needed for the selected event.
- Runs `POST /connector-imports/dry-run` from the UI and shows:
  - channels found
  - KPI rows found
  - first provider warning
  - preview rows if Postiz analytics returns recognized metrics
- Adds a manual Postiz integration ID fallback:
  - `POST /postiz/select-channel` accepts `validationMode: manual`.
  - The ID is saved as `manual_pending_analytics_validation`.
  - It is not treated as proven until the analytics dry-run succeeds.
- Updates the Postiz adapter so a pasted ID can be tested against `GET /analytics/{integration}?date=30` even if it was not returned by `GET /integrations`.
- Keeps safety unchanged:
  - no import approval
  - no scheduling
  - no publishing
  - no external writes
  - no raw secrets returned

Verification on 2026-07-06:

- Focused Postiz adapter tests: 5 passed.
- Backend lint: passed.
- Backend typecheck: passed.
- Full backend tests: 117 files passed, 1764 tests passed.
- Backend build: passed.
- Frontend lint: passed.
- Frontend build: passed.

R4A live acceptance:

- Hybrid health check passed after deployment.
- `/integration-credentials` ships the three-step Postiz production workflow.
- Manual integration ID can be saved as pending validation.
- Analytics test runs read-only and reports either real KPI rows or precise setup blockers.
- Live provider result on 2026-07-06: credential valid, zero connected channels returned by Postiz, zero KPI rows, no writes.
- Customer action required: connect/select a supported social channel in Postiz before Postiz analytics can produce KPI rows.

### Sprint R5 - GoHighLevel Read-Sync Adapter / Production CRM Validation

Goal: Make GoHighLevel the production CRM read source while Tanaghum remains the governed operating/reporting layer.

Status: Implemented, deployed to hybrid, and smoke-validated with the expected customer-credential blocker.

What R5 implements:

- Uses the tenant-owned `gohighlevel/api_key/default` credential only.
- Requires customer-provided:
  - Private Integration/API token
  - location ID
  - tag mapping
  - pipeline/stage mapping
- Keeps read sync gated by `GHL_READ_SYNC_ENABLED=true`.
- Keeps write-back separately gated by `GHL_WRITE_BACK_ENABLED=true`.
- Pulls:
  - contacts
  - opportunities
  - per-contact appointments/meetings
  - tags
  - pipeline/stage IDs
  - purchases/won opportunities
  - meeting booked / attended / no-show status where provider data supports it
- Maps GHL data into Tanaghum lead mirrors:
  - lead status
  - lead temperature
  - purchase amount/reference
  - meeting date/type/outcome
  - external CRM IDs
  - sync fingerprint
- Records sync-run evidence:
  - contacts pulled
  - opportunities pulled
  - appointments pulled
  - mapped tags/stages
  - raw payload returned false
- Keeps GHL as the CRM source of truth. Tanaghum mirrors the state for event operations, dashboards, closeout reports, and lead follow-up.

Acceptance:

- With missing credentials, the UI/API must clearly say customer-owned GHL credentials are required.
- With read sync disabled, the UI/API must say `GHL_READ_SYNC_ENABLED=true` is required.
- With credentials and flag enabled, pull preview must call GHL read endpoints and return mapped lead previews without raw payloads.
- Pull sync must upsert tenant-scoped GHL lead mirrors and record lifecycle evidence.
- Purchase, meeting booked, meeting attended, no-show, and lead temperature outcomes must map from customer GHL tags/stages/opportunities/appointments.
- No write-back, WhatsApp send, or CRM mutation is enabled by R5.

Remaining R5 live acceptance:

- Customer must provide a valid GHL token and location ID.
- Customer must confirm which tags and pipeline stages mean hot/warm/cold, purchased, booked meeting, attended, and no-show.
- `GHL_READ_SYNC_ENABLED=true` must be enabled only for an approved test tenant/environment.
- Run pull preview and sync against customer data.
- Confirm dashboard lead counts and sales outcomes match GHL.

R5 deployed smoke on 2026-07-06:

- Hybrid health returned HTTP 200.
- Hybrid app and frontend containers were rebuilt and restarted for R5; backend correction redeployed at commit `1042abe`.
- Migration `20260706_ghl_appointments_sync` applied successfully.
- `/api/ghl-sync/status` returned:
  - credential missing
  - mapping missing
  - read sync disabled
  - write-back disabled
  - required customer actions listed
- `/api/ghl-sync/pull-preview` returned `requires_credentials`, `appointmentsPulled: 0`, and `rawPayloadReturned: false`.
- Browser smoke logged in, opened Events, dismissed setup guide, and showed no console errors or failed API responses.

Verification on 2026-07-06:

- Focused GHL tests: 3 files passed, 13 tests passed.
- Backend lint: passed.
- Backend typecheck: passed.
- Full backend tests: 118 files passed, 1769 tests passed.
- Backend build: passed.
- Frontend lint: passed.
- Frontend build: passed.

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
