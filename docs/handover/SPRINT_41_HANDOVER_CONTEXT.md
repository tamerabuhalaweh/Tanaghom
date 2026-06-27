# Tanaghum STITCH Handover Context — Sprint 41

Date: 2026-06-27  
Repository: `tamerabuhalaweh/Tanaghom`  
Current branch: `feature/sprint-41-deepseek-postiz-handover`  
Base work: Sprint 40 PR #41, Commercial/Social workflow orchestrator

## Product Goal

Tanaghum is being shifted from demo-only screens into a sellable Commercial/Social product module.

The product story remains:

1. AI prepares.
2. Human approves.
3. System records.
4. External execution stays blocked unless explicitly authorized.

## Current Deployed Environment

- Frontend: `http://163.123.180.104:3000`
- Backend: `http://163.123.180.104:4000`
- Postiz: `https://postiz.163-123-180-104.sslip.io`
- Backend health: `GET /health`
- Workflow state: `GET /commercial-workflow/state`

Do not put raw secrets in this repository. VPS passwords, JWT secret, Postiz API key, DeepSeek key, and future CRM/social credentials must stay in deployment secrets or encrypted credential vault tables.

## Completed Before Sprint 41

### Sprint 39

- Stabilized live acceptance path.
- Added stricter acceptance smoke for deployed Command Center.
- Confirmed deployed blocked-state acceptance can pass.

### Sprint 40

- Added `/commercial-workflow/state`.
- Command Center now consumes backend workflow state for:
  - KPI counts
  - readiness score
  - next action
  - workflow rail
  - workflow orchestrator status
- Workflow state is derived from real backend records:
  - `ContentRequest`
  - `ContentItem`
  - `Approval`
  - `PublishingPackage`
  - `CampaignPerformanceReport`
  - `LeadCaptureRecord`
  - LLM provider credentials
  - Postiz credential/channel status
  - execution safety flags
- Sprint 40 deployed to VPS and browser-smoke tested.

## Sprint 41 Scope

### DeepSeek LLM Provider

Add DeepSeek as a first-class backend LLM provider:

- Provider type: `deepseek`
- Default model: `deepseek-v4-flash`
- Endpoint: `https://api.deepseek.com/chat/completions`
- Auth: `Authorization: Bearer <key>`
- Request mode: OpenAI-compatible chat completions
- Important: include `thinking: { type: "disabled" }` so the API returns normal draft text.

DeepSeek key must be stored through the existing user-owned encrypted LLM credential vault, not frontend local storage and not hardcoded env.

### Postiz Channel Visibility

Facts found during Sprint 41 investigation:

- Postiz public integrations endpoint is reachable.
- Provided Postiz API key returns HTTP 200.
- Endpoint returns zero integrations.
- Postiz database table `Integration` also has zero rows.
- Therefore Tanaghum is not hiding a connected Instagram channel; Postiz has no persisted connected social channel.

Likely cause:

- Postiz compose has social provider OAuth credentials empty, including `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.
- Instagram/Facebook channel connection cannot become a valid public API integration until Postiz has a working Meta app configuration and the user completes OAuth.

Do not fake a Postiz integration row. The correct fix is configuration plus verified OAuth.

## Required Postiz Next Steps

1. Add real sandbox Meta/Facebook app credentials to the Postiz deployment:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`
2. Restart Postiz.
3. Login to Postiz.
4. Connect Instagram/Facebook test account through Postiz OAuth.
5. Verify:
   - `GET https://postiz.163-123-180-104.sslip.io/api/public/v1/integrations`
   - header `Authorization: <Postiz API key>`
   - expected count: `>= 1`
6. Return to Tanaghum Credentials / Postiz channel picker.
7. Select the channel for sandbox scheduling packages.

## Runtime Safety Rules

Keep these blocked unless explicitly approved:

- `EXTERNAL_EXECUTION_ENABLED`
- `M5_WRITE_EXECUTION_ENABLED`
- `POSTIZ_LIVE_ENABLED`
- `CRM_LIVE_ENABLED`
- `WHATSAPP_LIVE_ENABLED`
- `TELEGRAM_LIVE_ENABLED`
- `VOICE_CHAT_LIVE_ENABLED`

Real draft generation through DeepSeek is allowed because it is not external write execution. Scheduling, publishing, CRM writes, messaging, and calls remain gated.

## Important APIs

### Auth

- `POST /auth/login`

### AI Provider

- `GET /ai-provider/status`
- `GET /ai-provider/credentials`
- `POST /ai-provider/credentials`
- `POST /ai-provider/test`
- `POST /ai-provider/select`

### Commercial/Social Workflow

- `GET /commercial-workflow/state`

### Postiz

- `GET /postiz/status`
- `GET /postiz/channels`
- `POST /postiz/select-channel`
- `POST /postiz/schedule-payload`
- `POST /postiz/sandbox-schedule`

## Verification Commands

Local:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

Deployed smoke:

```bash
curl http://163.123.180.104:4000/health
```

Authenticated workflow smoke:

1. Login through `POST /auth/login`.
2. Call `GET /commercial-workflow/state` with bearer token.
3. Confirm:
   - `sourceOfTruth` is `STITCH`
   - `counts` contain real nonzero values
   - `provider.ready` reflects actual user LLM credential state
   - `safety.externalWritesBlocked` is true unless explicitly authorized
   - no raw secrets are returned

## Known Remaining Gaps

1. Postiz social channel is not connected yet. Public API and DB both show zero integrations.
2. Real sandbox scheduling cannot be tested until a Postiz channel exists and is selected.
3. GHL remains credential/wizard/handoff oriented unless sandbox credentials are supplied and explicit flags are enabled.
4. WhatsApp, Telegram, and voice execution remain blocked by default.
5. OpenClaw, agentgateway, and AgentScope are runtime bridge surfaces, not full production orchestration yet.
6. The full Commercial/Social lifecycle is not yet a complete durable LangGraph graph. Sprint 40 state is derived from backend records.

## Sprint 41 Definition Of Done

- DeepSeek appears in AI Provider Settings.
- DeepSeek credential can be saved, tested, and selected by a user.
- Command Center no longer blocks on LLM provider after DeepSeek is configured.
- A real DeepSeek-generated draft can be created from a campaign.
- Postiz channel visibility accurately reports the real Postiz state.
- If no Postiz channel exists, Tanaghum explains the exact setup blocker.
- Handover document exists and contains enough context for recovery.
- All CI checks pass.
