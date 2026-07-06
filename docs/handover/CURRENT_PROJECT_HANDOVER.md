# Tanaghum Current Project Handover

Last updated: 2026-07-06  
Repository: `tamerabuhalaweh/Tanaghom`  
Current working branch at handover: `feature/hybrid-emergent-ux-governed-tanaghum`  
Current deployed hybrid commit at handover: `0f32140`  

This is the single current onboarding document for a new developer or delivery team. Older sprint notes remain useful as history, but this file is the current operational handover source of truth.

## 1. Product Summary

Tanaghum is a Commercial/Social AI operating platform for event-centered marketing and sales operations.

The current customer workflow is:

1. Plan an event.
2. Define event strategy, budget, channels, audience, FOMO angle, upsell path, and sales targets.
3. Prepare campaign and content work.
4. Generate AI-assisted ideas and social content.
5. Require human review and approval.
6. Prepare scheduling packages.
7. Track leads, form completions, meetings, no-shows, purchases, spend, reach, and interaction data.
8. Use GoHighLevel, Postiz, SmartLabs, Meta, YouTube, Formaloo, WhatsApp, Telegram, or CSV imports when the customer provides credentials.
9. Keep audit, tenant isolation, approval, and external execution controls authoritative in Tanaghum.

The product principle is:

**AI prepares. Human approves. The system records. External execution requires customer-owned credentials and explicit authorization.**

## 2. Current Version Strategy

There are three active comparison paths:

| Path | Purpose | URL | Notes |
| --- | --- | --- | --- |
| Main Tanaghum | Governed system of record and SaaS-grade backend | `https://tanaghum.163-123-180-104.sslip.io` | Strong governance, tenant isolation, audit, approval, safety controls. |
| Emergent A/B | UX reference and fast validation path | `https://tanaghum-ab.163-123-180-104.sslip.io` | Cleaner simple UX. Must stay untouched unless explicitly assigned. |
| Hybrid Tanaghum | Emergent-style UX patterns over Tanaghum backend | `https://tanaghum-hybrid.163-123-180-104.sslip.io` | Current active implementation path for combining usability with governed backend. |

Do not delete or overwrite any of these deployments without explicit approval.

## 3. Current Development State

Current focus:

- Keep the hybrid path as the main active productization lane.
- Keep main Tanaghum as the governed source-of-record backend.
- Keep Emergent A/B as the visual and workflow reference.
- Continue removing confusing backend jargon from customer-facing UI.
- Keep runtime infrastructure such as `agentgateway`, `OpenClaw`, and `AgentScope` out of normal customer setup screens.

Current branch:

```bash
feature/hybrid-emergent-ux-governed-tanaghum
```

Current R5A implementation commit:

```bash
82e160b feat: accept GHL credentials and validate mappings
```

Current deployed hybrid commit:

```bash
0f32140 docs: record R5A implementation evidence
```

## 4. Architecture Truth

Tanaghum owns:

- tenant data
- users and roles
- AgentRep/work profile records
- campaign/event state
- content and approval state
- KPI records
- lead lifecycle records
- publishing packages
- integration credential status
- audit records
- safety gates
- runtime bridge evidence

External platforms own their native systems:

- Postiz owns social channel OAuth and scheduling surface.
- GoHighLevel owns CRM contacts, opportunities, tags, stages, workflows, and customer messaging setup.
- Meta/Instagram owns official ads and analytics access.
- YouTube owns official video/channel analytics access.
- Formaloo owns forms and submissions.
- SmartLabs owns voice/chat agent execution.
- WhatsApp/Telegram providers own messaging execution.

Internal runtime infrastructure:

| Service | Current truth |
| --- | --- |
| `agentgateway` | R3 sandbox dry-run policy mediation is live-accepted on hybrid. Full production gateway/proxy data-plane is not deployed yet. |
| `OpenClaw` | Not production-orchestrating Tanaghum workflows yet. It must never bypass STITCH, tenant, approval, or audit controls. |
| `AgentScope` | Not executing production agent sessions yet. It remains a future runtime/session-isolation candidate. |
| LangGraph | Dependency exists, but the product is not yet a full durable LangGraph workflow engine. |

## 5. Runtime R-Sprint Status

### R0

Runtime infrastructure was removed from normal customer-facing setup positioning. `agentgateway`, `OpenClaw`, and `AgentScope` are internal Admin/Ops concepts, not business integrations.

### R1

Admin/Ops runtime evidence was added for runtime bridge status.

### R2

`agentgateway` was selected as the first low-risk runtime pilot because it maps best to dry-run policy mediation and deny/allow behavior.

### R3

Live accepted on hybrid as a sandbox policy adapter, not full production agentgateway:

- `GET /runtime-bridges/agentgateway/sandbox-policy/health`
- `POST /runtime-bridges/agentgateway/sandbox-policy/connector-dry-run`

The R3 adapter:

- requires `AGENTGATEWAY_SANDBOX_POLICY_TOKEN`
- accepts only `connector_import.dry_run`
- requires `authority.sourceOfTruth = STITCH`
- requires `dryRunOnly = true`
- requires `externalWritesAllowed = false`
- requires `importWritesAllowed = false`
- denies unsupported connectors
- returns `productionGateway: false`

Important: this proves policy mediation shape. It does not mean production connector traffic is routed through a real agentgateway proxy.

R3 live acceptance evidence from 2026-07-06:

- Runtime status: configured `true`, reachable `true`, HTTP `200`, production active `false`.
- Connector dry-run: mediated `true`, decision `allowed`, status `200`.
- Safety: external writes `false`, raw secrets returned `false`.
- Postiz dry-run result: `0` rows, with an honest warning that no read-only Postiz adapter exists yet.
- Deny path: unsupported connector returned `deny`, `externalWritesAllowed: false`, `productionGateway: false`.

Do not overstate this. R3 proves sandbox policy mediation and deny/allow behavior. It does not prove real production `agentgateway` proxy routing.

### R5

GoHighLevel read-sync adapter is deployed to hybrid.

Current truth:

- GHL is treated as the CRM source of truth.
- Tanaghum is the operating and reporting layer.
- The backend can pull contacts, opportunities, tags, pipeline stages, purchases, and per-contact appointments/meetings.
- Tanaghum mirrors those records into tenant-scoped lead records when read sync is enabled.
- Raw GHL payloads and secrets are not returned.
- Real read sync requires:
  - customer-owned GHL API key
  - customer-owned GHL location ID
  - GHL tag/stage mappings
  - `GHL_READ_SYNC_ENABLED=true`

### R5A

R5A adds customer credential acceptance and mapping validation.

New backend contract:

- `POST /ghl-setup/test-connection`
  - uses the secure tenant vault
  - performs a read-only GHL contact search
  - marks `last_validated_at` on success
  - returns status and next action only
  - never returns raw secrets or raw GHL payloads
- `POST /ghl-setup/validate-mappings`
  - checks whether saved GHL mappings cover the required sales outcomes:
    - meeting booked
    - meeting attended
    - no-show
    - purchased
    - lost
    - follow-up needed
    - warm / hot / buyer temperature
  - reports missing outcomes clearly

Current limitation:

- R5A cannot be fully live-accepted without a customer-owned GHL API key and location ID.
- CRM writes remain blocked unless separately authorized through `GHL_WRITE_BACK_ENABLED=true`.

Hybrid deployment verification from 2026-07-06:

- Hybrid is deployed at commit `0f32140`.
- `GET /api/health` returned healthy app, database, and Redis status.
- `POST /api/ghl-setup/test-connection` returned the expected `requires_credentials` state with no raw secrets or raw payload.
- Browser smoke on `/ghl-wizard` clicked "Validate GHL Mappings" and received HTTP 200, status `not_ready`, 9 missing required outcomes, `readyForReadSync: false`, 0 console errors, and 0 failed requests.

### R5B

R5B adds live customer GHL credential validation.

New backend contract:

- `POST /ghl-setup/live-validation`
  - uses the secure tenant vault
  - calls only read-only GHL surfaces:
    - contacts search
    - opportunities search
    - location tags
    - opportunity pipelines and stages
  - returns status/counts/blockers only
  - compares saved Tanaghum mappings against live GHL tags and pipeline stages when those read scopes are available
  - never returns raw secrets or raw GHL payloads

Current limitation:

- R5B cannot be live-accepted without a customer-owned GHL API key, location ID, and read scopes.
- CRM writes remain blocked unless separately authorized through `GHL_WRITE_BACK_ENABLED=true`.
- Actual read sync still requires `GHL_READ_SYNC_ENABLED=true`.

## 6. Local Development Setup

Prerequisites:

- Node.js 20+
- Docker
- PostgreSQL
- Redis

Backend setup:

```bash
cd tanaghum-platform
npm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Frontend setup:

```bash
cd tanaghum-platform/frontend
npm install
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Backend health: `http://localhost:4000/health`

## 7. Required Verification Commands

Run these before claiming work is complete:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

For browser paths:

```bash
npx playwright test --reporter=list
```

Do not claim completion based only on TypeScript/build success. UI work requires browser walkthrough evidence or an honest note that browser QA was not run.

## 8. Deployment Shape

Main and hybrid deployments run on the VPS behind Caddy/SSL.

Hybrid deployment root on VPS:

```bash
/opt/tanaghum-hybrid
```

Hybrid compose file on VPS:

```bash
docker-compose.hybrid.yml
```

Hybrid app services:

- `tanaghum-hybrid-app`
- `tanaghum-hybrid-frontend`

Useful deployment check:

```bash
cd /opt/tanaghum-hybrid
git rev-parse --short HEAD
docker compose -f docker-compose.hybrid.yml ps app frontend
```

Never put VPS passwords, API keys, customer tokens, Postiz keys, GHL keys, SmartLabs keys, or AI provider keys in this repository.

## 9. Environment Variables

Use `.env.example` as the starting point.

Important variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `JWT_SECRET` | JWT signing secret, 32+ chars |
| `SECRET_VAULT_ENCRYPTION_KEY` | tenant credential encryption |
| `CORS_ORIGIN` | exact allowed frontend origin |
| `DEMO_MODE` | controlled mode flag |
| `EXTERNAL_EXECUTION_ENABLED` | master external execution switch |
| `M5_WRITE_EXECUTION_ENABLED` | write execution switch |
| `POSTIZ_LIVE_ENABLED` | real Postiz scheduling switch |
| `CRM_LIVE_ENABLED` | real CRM write switch |
| `WHATSAPP_LIVE_ENABLED` | real WhatsApp switch |
| `TELEGRAM_LIVE_ENABLED` | real Telegram switch, when present |
| `VOICE_CHAT_LIVE_ENABLED` | voice/chat execution switch |
| `AGENTGATEWAY_DRY_RUN_POLICY_ENABLED` | R2/R3 dry-run mediation flag |
| `AGENTGATEWAY_SANDBOX_POLICY_TOKEN` | service token for R3 sandbox policy endpoint |

All live/write flags should remain false unless there is explicit customer approval, customer-owned credentials, test evidence, rollback path, and audit acceptance.

## 10. Customer-Owned Credentials

Tanaghum must not hardcode shared customer credentials.

Each tenant/customer provides and owns:

- AI provider API key
- Postiz API key and connected channel
- GoHighLevel API key or OAuth setup and location ID
- Meta/Instagram business account and API/OAuth setup
- YouTube analytics API/OAuth setup
- Formaloo API/form access
- WhatsApp/Telegram provider credentials if used outside GHL
- SmartLabs voice/chat API key and agent ID
- SMTP settings for invite/reset email
- backup destination
- alert destination

Credential rule:

- Save secrets only through credential vault or deployment secret process.
- Show only configured/missing/validated state.
- Never display raw keys after save.
- Never paste real secrets into GitHub issues or docs.

## 11. Product Roles

| Role | Current expectation |
| --- | --- |
| Admin | Tenant setup, users, credentials, security, operations, runtime evidence. |
| Marketing/Sales Manager | Event strategy, campaigns, KPIs, leads, sales outcomes, closeout learning. |
| Social Media Manager | Content drafts, platform adaptation, review submission, scheduling preparation. |
| Reviewer/Approver | Human content approval, reject, request changes. |
| Sales Manager | Lead follow-up, meetings, no-shows, purchases, next actions. |
| Lead Qualification Manager | Lead temperature/status and CRM/voice handoff readiness. |
| Viewer | Read-only business visibility. |

Normal marketing/sales users should not see tenant-admin, runtime infrastructure, or backend configuration pages.

## 12. Current Customer Workflow

The current customer-centered event workflow is:

1. Create or select event.
2. Define event date, location, audience, offer, campaign dates, planned budget, revenue target, expected attendance.
3. Plan email, WhatsApp, upsell, content, and sales tasks.
4. Create campaigns for the event.
5. Generate AI ideas and drafts.
6. Review and approve content.
7. Prepare scheduling package and Postiz payload.
8. Track KPI records from connectors or CSV/manual fallback.
9. Sync or view leads from GHL when configured.
10. Track meetings, no-shows, purchases, and lead temperature.
11. Record barriers and risks.
12. Generate closeout report and learning recommendations.

## 13. Current Important APIs

Representative API groups:

- `/auth/*`
- `/events`
- `/planner/*`
- `/leads/*`
- `/event-problems/*`
- `/closeout/*`
- `/learning-recommendations/*`
- `/connector-imports/*`
- `/connector-mappings/*`
- `/connector-readiness/*`
- `/integration-credentials/*`
- `/runtime-bridges/*`
- `/ai-provider/*`
- `/postiz/*`
- `/ghl/*`
- `/smartlabs/*`

Check route registration in `src/index.ts` before adding new routes.

## 13A. Current Connector Adapter Status

| Connector | Current implementation truth |
| --- | --- |
| Postiz | R4 read-only adapter deployed and live-accepted for Public API integrations and analytics preview. R4A channel selection UX is implemented locally. Requires tenant Postiz `baseUrl`, `apiKey`, and a connected/validated `integrationId` for KPI rows. No scheduling or publishing happens in this adapter. |
| GoHighLevel | Dedicated setup/sync modules exist. Customer credentials, mappings, and acceptance data are still required before production validation. |
| Formaloo | CSV/import foundations exist. Official API adapter still pending customer credentials and mapping. |
| Meta / Instagram | Readiness/mapping foundation exists. Official analytics adapter requires customer Meta account/API/OAuth access. |
| YouTube | Readiness/mapping foundation exists. Official analytics adapter requires customer Google/YouTube access. |
| WhatsApp / Telegram | Provider readiness paths exist. Production execution remains blocked until customer credentials, consent, templates/destinations, and approval are configured. |
| SmartLabs | Validation path exists. Production execution requires tenant SmartLabs key, agent ID, explicit authorization, and evidence. |

## 14. Known Production Gaps

These are not bugs to hide. They are real gaps to plan and close:

- Full production agentgateway proxy/data-plane is not deployed.
- OpenClaw is not orchestrating STITCH workflows.
- AgentScope is not executing production agent sessions.
- Full durable LangGraph workflow runtime is not complete.
- Postiz real scheduling requires a connected customer social channel and explicit flags.
- GHL read/write flows require customer credentials, mapping, validation, and approval.
- Meta/Instagram and YouTube official analytics require customer provider access and validation.
- Formaloo production import requires customer form credentials and mapping.
- WhatsApp/Telegram production execution requires customer setup and consent controls.
- SmartLabs execution requires tenant key, agent ID, explicit test authorization, and evidence.
- Off-server backups require a real storage target.
- External alert routing requires webhook/email destination.
- Billing/subscription payment collection is not fully automated through a payment provider.
- Independent penetration testing is still required.
- Some older docs and sprint files are historical and may contain stale status.

## 15. GitHub Workflow

Use GitHub issues and PRs as the coordination system.

Rules:

- One sprint or focused fix per branch.
- One PR per branch.
- CI green before merge.
- Include scope, out-of-scope, tests, screenshots for UI, and remaining gaps.
- Do not close issues unless the actual acceptance criteria are met.
- Backend schema/migration work must have a single owner per sprint to avoid migration conflicts.
- UI work must include browser evidence when customer-facing.
- No AI/dev agent reviews and merges its own work.

Recommended labels:

- `area/backend`
- `area/frontend`
- `area/integration`
- `area/qa`
- `area/docs`
- `priority/p0`
- `priority/p1`
- `blocked/customer-credential`
- `blocked/external-api`
- `needs-codex-review`
- `needs-deployment`

## 16. Current And Next Integration Sprint State

Current R4/R4A status:

- Postiz is the first real read-only adapter.
- R4 is deployed and live-accepted on hybrid.
- R4 live result: Postiz credential valid, zero channels returned by Postiz, zero KPI rows, no writes.
- R4A adds production-facing Postiz channel setup UX:
  - save/list channel
  - paste integration ID
  - run read-only analytics validation
  - show rows/warnings without scheduling or publishing
- R4A is deployed to hybrid.
- Import still requires a later human-approved `approve-import`.

Current R5 status:

- GoHighLevel read-sync adapter is implemented and deployed to hybrid as the CRM read path.
- GHL remains the CRM source of truth; Tanaghum is the operating/reporting mirror.
- Customer-owned GHL credential and location ID are required.
- Customer-owned tag/stage mappings are required for high-confidence status/temperature mapping.
- Read sync is still gated by `GHL_READ_SYNC_ENABLED=true`.
- Write-back remains separately gated by `GHL_WRITE_BACK_ENABLED=true` and should stay off unless explicitly authorized.
- The adapter now covers contacts, opportunities, per-contact appointments/meetings, purchase outcomes, tags, stages, no-shows, meeting attendance, and lead temperature/status mapping.
- Sync run evidence includes contact, opportunity, and appointment counts and never returns raw GHL payloads.
- Local verification passed on 2026-07-06: backend lint, typecheck, full backend tests (118 files, 1769 tests), backend build, frontend lint, and frontend build.
- Hybrid deployed smoke on 2026-07-06 returned the honest customer setup blocker: credential missing, mapping missing, read sync disabled, write-back disabled, and pull preview status `requires_credentials` with no raw payload returned.

Recommended target options after R5:

1. Live-validate R5 with customer-owned GHL token, location ID, and mappings.
2. Build Formaloo API import adapter if the customer provides form access.
3. Build Meta/Instagram and YouTube official analytics adapters if the customer provides eligible ad/channel accounts.

Acceptance:

- real customer-owned credential configured
- read-only dry run produces real preview rows or a real provider status result
- agentgateway policy mediation evidence attached if R3 path is enabled
- human approval required before import/write
- tenant isolation tested
- audit record created
- UI shows business language, not infrastructure jargon
- empty provider data is reported honestly instead of faked

## 17. New Developer First-Day Checklist

1. Read this file completely.
2. Read `docs/product/CUSTOMER_ONBOARDING_AND_OPERATOR_GUIDE.md`.
3. Read `docs/integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md`.
4. Read `docs/product/INTEGRATION_UX_CORRECTION_PLAN.md`.
5. Read `docs/sprints/COMMERCIAL_EVENT_AUTOMATION_SPRINT_PLAN.md`.
6. Run local setup.
7. Run full verification commands.
8. Confirm current branch and deployed commit.
9. Review open GitHub issues before writing code.
10. Ask for missing customer credentials instead of faking connector states.

## 18. Non-Negotiable Rules

- Do not expose raw secrets.
- Do not fake connected states.
- Do not use static sample data as production data.
- Do not let normal users see admin/runtime pages.
- Do not enable live external writes without explicit authorization.
- Do not publish or schedule real posts by default.
- Do not trigger CRM writes, messages, WhatsApp, Telegram, or voice calls by default.
- Do not let OpenClaw, agentgateway, AgentScope, MCP tools, or any external platform become the source of truth.
- Do not call runtime pilots production-complete until traffic actually routes through deployed runtime infrastructure and is tested.

## 19. Stale Documentation Warning

This repository contains many historical sprint reports. They are useful for audit history, but several older docs still mention:

- old demo-only state
- old test counts
- old Sprint 41/Sprint 59 context
- old deployment assumptions

When a conflict exists, use this file plus current code, schema, tests, and deployment evidence as the current source of truth.
