# Tanaghum Project Handover For GPT 5.6 Sol

Last updated: 2026-07-20

Repository: `tamerabuhalaweh/Tanaghom`

Local path: `C:\Users\tamer\Desktop\New\tanaghum-platform`

Current branch: `main`

Current product baseline: `6553960 Merge pull request #207 from tamerabuhalaweh/test/hybrid-live-stitchi-response`

Canonical recovery tag: `hybrid-recovery-2026-07-19`

Source-of-truth documentation checkpoint: PR `#209`

Primary active deployment: Hybrid

Hybrid URL: `https://tanaghum-hybrid.163-123-180-104.sslip.io`

Backup Hybrid standby URL: `https://tanaghum-backup.155-117-45-45.sslip.io`

Backup deployment runbook: [`docs/deployment/BACKUP_HYBRID_STANDBY.md`](../deployment/BACKUP_HYBRID_STANDBY.md)

The backup URL is a warm code standby deployed from `hybrid-recovery-2026-07-19` at commit `a1a7ede`. Its five-scenario live browser gate and isolated database restore/application-login drill passed. It currently has an isolated seeded database and must not be represented as synchronized primary customer data.

The SRD-R14 historical-learning and hierarchical-planning wave is implemented through the governed annual -> monthly initiative -> execution plan path. The latest product closure was `#201 / UX-R1G`; follow-up bug `#204` and live acceptance issue `#206` are closed. The next recommended product issue is `#208 / UX-R1H: Weekly operating cadence below execution plans`. Production-operations closure remains tracked by `#171`.

AB reference URL: `https://tanaghum-ab.163-123-180-104.sslip.io`

Main legacy/governed URL: `https://tanaghum.163-123-180-104.sslip.io`

This file is the single current onboarding source of truth for a new developer, delivery team, or GPT 5.6 Sol. Older sprint notes remain historical evidence, but this file tells the next agent what the project is, where it stands, what must not be touched, what was last completed, and what should happen next.

## 1. Read This First

The active work lane is **Hybrid only**.

Do not modify, redeploy, or experiment on the AB reference system unless the user explicitly says so. AB is under customer comparison/testing and must stay isolated.

Do not claim production readiness for any external integration unless it has been tested with customer-owned credentials and evidence has been added to the relevant GitHub issue.

Do not close GitHub issues just because a foundation exists. Close only when the issue definition of done is genuinely met. If something is partial, update the issue with exact evidence and exact remaining gap.

The product principle is:

**AI prepares. Human approves. The system records. External execution requires customer-owned credentials and explicit authorization.**

The current customer is evaluating Tanaghum for Commercial/Sales/Marketing operations. The system must help their team run revenue lines, events, campaigns, content, leads, CRM follow-up, reporting, and AI-assisted work. The customer expects a usable business product, not a technical demo.

## 2. Non-Negotiable Rules

- Hybrid is the implementation lane.
- AB reference must remain untouched unless explicitly assigned.
- Customer-facing pages must use business language, not internal STITCH/SAIF/MCP/M5/runtime jargon.
- Stitchi must be wired into new useful business workflows where appropriate.
- Stitchi must never bypass tenant isolation, RBAC, audit, approval, or external execution gates.
- No secrets go into code, docs, GitHub issues, comments, screenshots, or commits.
- VPS credentials, API keys, Gemma keys, GHL keys, SmartLabs keys, Postiz keys, OAuth tokens, and database passwords must remain out of the repository.
- External systems are customer-owned. The customer must provide credentials and approve scopes/mappings.
- Manual data entry is acceptable only as fallback or pre-credential mode. Production truth should come from official integrations when credentials are available.
- Every completion report must say what passed, what failed, what remains, and what is blocked by customer credentials/decisions.

## 3. Current Version Strategy

| Path | Purpose | Current rule |
| --- | --- | --- |
| Hybrid | Active productization lane. Emergent-style user friendliness over Tanaghum governance. | Work here now. Deploy here for testing. |
| AB reference | Clean UX comparison path from Emergent A/B. | Do not touch. Use as UX reference only. |
| Main legacy/governed | Earlier full governance path. | Keep as historical/governance reference. Do not prioritize unless asked. |

The strategic direction is:

```text
Emergent-style UX
  -> Tanaghum frontend API adapter
  -> Tanaghum backend
  -> tenant, RBAC, audit, approvals, integrations, workflows, evidence
```

## 4. Current Repository State

At this handover:

```bash
git branch --show-current
# main

git log -5 --oneline
# 6553960 Merge pull request #207 from tamerabuhalaweh/test/hybrid-live-stitchi-response
# 728ef25 Harden live Stitchi acceptance
# 265e0ed Merge pull request #205 from tamerabuhalaweh/hotfix/stitchi-annual-intent-boundary
# a10ed18 Fix Stitchi standalone intent routing
# bb826e8 Merge pull request #203 from tamerabuhalaweh/hotfix/hybrid-live-ai-evidence
```

`tmp/` and `.playwright-mcp/` may contain local screenshots and browser snapshots from live QA. They are ignored and must not be committed. Durable evidence belongs under `docs/evidence/` with a matching acceptance note.

Remote:

```bash
origin https://github.com/tamerabuhalaweh/Tanaghom.git
```

## 5. Last Completed Job

Last product job completed: `#201 / UX-R1G: Annual Plan To Monthly Initiative To Execution Plan Product Closure`

Latest QA closure: `#206 / Make live Stitchi acceptance verify the current orchestration response`

Current product baseline commit: `6553960`

Canonical recovery point: Git tag `hybrid-recovery-2026-07-19`

Deployment: Hybrid VPS deployed successfully.

What is now implemented:

- Tenant-scoped historical assessment with frozen evidence, AI findings, executive approval, and reusable approved learning.
- Governed annual lifecycle: draft, pending approval, approved/rejected, active, closed, and archived.
- Twelve-month portfolio with AED default, monthly initiatives, budget/revenue allocation, readiness, event links, and approved learning.
- Default execution-plan creation from a monthly initiative, inheriting annual plan, month, revenue line, currency, targets, event, and learning.
- Standalone execution plans remain an explicit governed exception requiring a reason.
- Stitchi can read planning context, ask for missing information, prepare internal actions, wait for human approval, and save through backend policy/audit paths.
- Hybrid navigation separates Assessment, Annual Plan, Execution Plans, Discipline Workspaces, and Event Operations.
- Live acceptance verifies the current Stitchi orchestration response and guards the annual-intent/standalone-exception boundary.

Verification:

- GitHub CI for product baseline `6553960` passed on 2026-07-16.
- GitHub CI for source-of-truth PR `#209` passed on 2026-07-19.
- CI covered backend, frontend, frontend E2E, Docker, production acceptance, security/static analysis, production operations, and CodeQL according to the merged PR checks.
- Hybrid external uptime checks for `6553960` are passing on 2026-07-19.
- Live Hybrid acceptance passed the planning/Stitchi path without external writes.
- Customer-owned integrations remain honestly blocked until credentials, mappings, provider access, and customer authorization are supplied.

## 6. Product Context

The customer requirement began around Amro, the Commercial/Sales/Marketing manager workflow, but the product is not being built only for Amro. It is a SaaS-style platform where roles and user names are tenant/customer-specific.

Commercial department needs include:

- Revenue lines:
  - Live Events
  - Online Courses
  - Books
  - Merchandise
  - B2B
  - Platinum Elite
  - Certified Trainer Network
  - Loyalty & Community
- Event strategy and campaign planning.
- Budget target vs actual spend.
- Revenue target vs known revenue.
- Leads, form completions, meetings booked, no-shows, purchases.
- Content planning, ads, email, WhatsApp, GHL follow-up, upsell.
- CEO/GM/CCO executive reporting.
- Discipline workspaces for brand, acquisition, conversion, customer growth, and revenue operations.
- Stitchi as the AI work assistant that can prepare and execute approved internal work.

The Event workspace is one operational workflow inside the Commercial product. Do not collapse the whole product into Events only.

## 7. SRD And Customer Documents

Customer-supplied documents referenced during development:

- `Tanaghum_Commercial_System_SRD_v4-3.docx`
- `Tanaghum_CCC_Executive_Brief.docx`
- customer response/walkthrough docs shared in the conversation

Repo traceability docs:

- `docs/product/SRD_V4_3_ACCEPTANCE_MATRIX.md`
- `docs/product/CUSTOMER_ONBOARDING_AND_OPERATOR_GUIDE.md`
- `docs/product/STITCHI_DEVELOPMENT_PLAN.md`
- `docs/product/INTEGRATION_UX_CORRECTION_PLAN.md`
- `docs/product/UAE_PDPL_PRIVACY_REVIEW_GUIDE.md`
- `docs/integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md`
- `docs/sprints/SRD_ALIGNMENT_SPRINT_2_COMMERCIAL_REVENUE_DASHBOARDS.md`

GitHub issues are now the source of truth for remaining SRD work. Refresh issue state before acting:

```bash
gh issue list --repo tamerabuhalaweh/Tanaghom --state open --limit 100
```

## 8. Current Open GitHub Issues

Snapshot from 2026-07-19: 18 open issues. Always refresh before work.

| Issue | Current truth |
| --- | --- |
| #208 UX-R1H: Weekly operating cadence | Recommended next product sprint. Weekly work must remain below the execution plan and inherit the approved hierarchy. |
| #172 Hybrid test coverage and bundle budgets | Open P1 quality improvement. |
| #171 Production operations, DR, security closure | Open P0. External alert routing, off-server backup, incident ownership/RPO/RTO, MFA coverage, and independent penetration testing remain. |
| #145 Hybrid workflow/design-system rebuild | Parent UX issue remains open for customer acceptance and remaining UX work. |
| #143 Data retention/export/delete and UAE PDPL | Implemented foundation; customer/legal decisions remain. |
| #142 Forms intake strategy | Customer/product decision remains between Tanaghum forms and governed GHL/Zapier intake. |
| #141 Executive reporting workflow | Foundation exists; customer recipients, KPI thresholds, cadence, and real delivery channel remain. |
| #140 Role access and approval policy | Foundation exists; final customer role/approval acceptance remains. |
| #138 Discipline definitions | Customer confirmation of final discipline responsibilities and records remains. |
| #135 Social and voice AI safety layer | Open P0 implementation/acceptance work. |
| #132 SmartLabs voice/inbound leads | Blocked on customer tenant key, agent configuration, and approved live test. |
| #131 WhatsApp through GHL | Blocked on customer GHL/WhatsApp configuration, mappings, and live authorization. |
| #130 Meta, YouTube, Formaloo ingestion | Blocked on customer provider credentials/app access and live data validation. |
| #129 Kajabi revenue/enrollment sync | Requires customer Kajabi access and contract discovery/live acceptance. |
| #128 GHL production read sync | Adapter/readiness exists; live acceptance is blocked on customer credentials and mappings. |
| #126 SRD v4.3 completion epic | Remains open until the production-readiness target and child closures are honest. |
| #124 Unified commercial data layer epic | Remains open for live GHL/Kajabi/Meta/YouTube/Formaloo data truth. |
| #73 Postiz channel selection/scheduling | Blocked on customer Postiz channel/integration validation and authorized live execution. |

## 9. Recently Closed Issues To Know

Recent closure history:

- #206 QA: verify the current live Stitchi orchestration response.
- #204 Bug: prevent annual-planning language from misrouting explicit standalone exceptions.
- #201 UX-R1G: close annual plan -> monthly initiative -> execution plan hierarchy.
- #187 SRD-R14G: role-based E2E/browser/live Hybrid acceptance.
- #186 SRD-R14F: Stitchi historical-assessment and annual-planning operator.
- #184 SRD-R14D: hierarchical budget allocation and reconciliation foundation.
- #183 SRD-R14C: annual-to-execution hierarchy and traceability.
- #180 SRD-R14 parent epic for the completed wave.

- #144 QA: Separate Live Hybrid Playwright Acceptance From Local Mocked Specs.
- #139 SRD-R9: Revenue Lines, Currency, Books/Merchandise, And Product-Based Reporting Configuration.
- #134 SRD-R7: CEO Dashboard Scheduled Reports And Commercial Analytics.
- #133 SRD-R6: Discipline Workspaces For Brand Acquisition Conversion Growth And Operations.
- #127 SRD-R0: GitHub Truth Repair And SRD Traceability Reset.
- #125 Unified Data Layer: Kajabi Discovery And Connector Foundation.
- #117 to #123 Sprint 2 Commercial Revenue Dashboards And Planning Workflows.
- #111 to #116 Sprint 1 Commercial Command Center Foundation.

Important: some closed issues are foundation-complete, not necessarily "every SRD dream is live with real external data". The truth is in the issue comments and remaining open issues.

## 10. Best Next Move

The best next product sprint is `#208 / UX-R1H: Weekly operating cadence below execution plans`.

The weekly layer must inherit annual plan, month, monthly initiative, execution plan, revenue line, currency, targets, and event context. It must not become a second independent planning system. Stitchi should prepare weekly work, ask for missing owner/due date/outcome, and use approval-gated internal actions. External execution remains separately authorized.

Before or alongside product work, continue `#171` production-operations closure where external destinations and customer decisions are available. Do not claim `#128`-`#132`, `#130`, or `#73` live-complete without customer-owned credentials and acceptance evidence.

Do not start `#128` live GHL acceptance until customer-owned GHL credentials and mapping data are available.

Do not start live SmartLabs validation until customer-owned SmartLabs key, agent ID, and approved test scenario are available.

## 11. Stitchi Current Status

Stitchi is the governed AI work assistant.

Current implemented foundation:

- Conversation foundation.
- Read-only assistant foundation.
- Backend action workflow and approval foundation.
- SSE streaming lifecycle and token streaming via provider adapters.
- LangGraph is used for action approval interrupts and workflow snapshots.
- Hybrid UI surface exists.
- Commercial Command Center context is available to Stitchi.
- Stitchi can prepare approved internal commercial work, including commercial plan creation.
- LLM-assisted commercial operator behavior exists: LLM enriches plan details, backend validates, human approves, then Tanaghum saves.

Important truth:

- Stitchi is not allowed to call external systems directly.
- Stitchi must not publish, schedule, send WhatsApp/Telegram, write CRM, or trigger SmartLabs voice/chat unless required customer credentials, flags, and approvals exist.
- Stitchi should be connected to every new useful business workflow where safe.
- If a domain creates useful work, add:
  - read context
  - approval-gated internal actions
  - blocked/preview status for external actions
  - audit evidence

Stitchi development plan:

- `docs/product/STITCHI_DEVELOPMENT_PLAN.md`

## 12. Architecture Truth

Backend:

- Node.js 20+
- Express 5
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ available
- Vitest
- LangGraph
- MCP SDK dependency

Frontend:

- React 19
- Vite
- Tailwind CSS v4
- lucide-react
- Radix UI primitives

Key backend directories:

- `src/index.ts`: Express app entry and route registration.
- `shared/`: auth, errors, database, policy, providers, validation, crypto, logging.
- `modules/auth`: login/session/MFA/onboarding.
- `modules/commercial-command-center`: revenue lines, plans, assessment signals, dashboard context.
- `modules/commercial-disciplines`: discipline workspace foundation.
- `modules/commercial-executive-reporting`: executive report templates/schedules/preview records.
- `modules/commercial-events`: event foundation.
- `modules/event-campaign-planner`: email/WhatsApp/upsell/content/sales task plans.
- `modules/lead-lifecycle`: lead statuses, temperature, meetings, purchases.
- `modules/ghl-sync` and `modules/ghl-setup`: GHL read-sync/mapping/credential validation foundations.
- `modules/connector-*`, `modules/csv-import`: connector readiness/import/mapping.
- `modules/postiz-*`: Postiz integration/channel selection.
- `modules/smartlabs-*`: SmartLabs connector/validation.
- `modules/stitchi`: Stitchi conversations, context, workflow, actions.
- `modules/tenant-admin`: tenant lifecycle, export, deletion readiness, privacy governance.
- `modules/runtime-bridges`: agentgateway/OpenClaw/AgentScope bridge evidence/pilots.

Key frontend files:

- `frontend/src/App.tsx`: routes.
- `frontend/src/components/Layout.tsx`: Hybrid shell/navigation.
- `frontend/src/pages/DemoCommandCenter.tsx`: Commercial Command Center / dashboard path.
- `frontend/src/pages/CommercialCommandCenter.tsx` or related command-center components if present in current tree.
- `frontend/src/pages/TenantAdmin.tsx`: tenant lifecycle, privacy governance, export/delete.
- `frontend/src/pages/Stitchi*` and shared Stitchi components if present.
- `frontend/src/api.ts`: frontend API contract.

## 13. Integrations Truth

Customer-owned credentials are required for real connector activation.

| Connector | Current truth |
| --- | --- |
| GHL | Foundation exists for readiness, mappings, read-sync, live validation. Real acceptance requires customer GHL API key/location/mapping. |
| Kajabi | Discovery/foundation exists, but real sync requires customer Kajabi access/API path confirmation. |
| Meta/Instagram | Readiness/import foundation exists. Real ingestion requires customer Meta business/app/OAuth/ad account setup. |
| YouTube | Readiness foundation exists. Real ingestion requires customer Google/YouTube access. |
| Formaloo | Import readiness exists. Real connector requires customer API/form IDs/field mapping. |
| Postiz | Channel selection and payload prep exist. Real scheduling requires customer Postiz channel/integration ID and explicit flags/approval. |
| WhatsApp | Should usually go through GHL/customer provider where possible. Real sending blocked until credentials, consent, templates, and authorization. |
| SmartLabs | Connector path exists. Real tenant validation needs SmartLabs key, agent ID, and approved test scenario. |
| Telegram | Provider readiness/gating exists; real execution needs customer bot and allowed destination config. |
| AI providers | Tenant-owned provider keys can be configured. Never expose raw keys. |

Customer credential checklist:

- `docs/integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md`

## 14. Runtime Infrastructure Truth

These are not customer-facing integrations:

| Runtime | Current truth |
| --- | --- |
| agentgateway | Selected first runtime pilot. Sandbox dry-run policy mediation exists. Full production gateway data-plane is not deployed. |
| OpenClaw | Not orchestrating production workflows. Future adjacent/channel orchestration candidate only. |
| AgentScope | Not executing production agent sessions. Future multi-agent/session-isolation candidate only. |
| LangGraph | Present and used for Stitchi/action workflow interruptions. Not yet the full durable workflow brain for every workflow. |

Do not list OpenClaw, agentgateway, or AgentScope as connectors the customer must configure. They are internal platform services/Admin-Ops evidence only.

## 15. Privacy, Retention, And Legal Review

Current state:

- Privacy governance implemented in Tenant Admin.
- Export/delete authority is limited to `admin` and `cco` system roles.
- Customer-facing authority is CEO/GM/CCO.
- Dedicated GM system role does not exist yet. If customer requires it, create a specific role model sprint.
- Live social, CRM, voice, and AI-agent workflows are gated until privacy review is approved.
- UAE PDPL explanation exists in:
  - `docs/product/UAE_PDPL_PRIVACY_REVIEW_GUIDE.md`

Customer still must confirm:

- Applicable data protection laws/countries.
- Whether forever retention is legally acceptable.
- Customer legal/privacy owner.
- Privacy contact.
- Business/legal reason for storing Stitchi conversations, CRM records, voice summaries/transcripts, and social DM/comment logs.
- Whether GM needs a dedicated system role.

## 16. Data And Analytics Truth

Dashboard values must be honest.

Allowed data sources:

- internal commercial plans
- internal event records
- internal lead lifecycle records
- internal KPI records
- approved CSV imports
- approved connector imports
- real external API data only after customer credentials and dry-run/approval evidence exist

Not allowed:

- fake social metrics
- fake GHL data
- fake Kajabi revenue
- fake Meta/YouTube analytics
- claims about "latest social algorithm" without official/approved data source
- scraping private social platforms

If data is missing, the UI must say what is missing and how to connect/import it.

## 17. Local Setup

From repo root:

```bash
npm ci
npm --prefix frontend ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
npm --prefix frontend run dev
```

Common test accounts are seeded in `prisma/seed.ts`. The seed password is present in that file for local/test use only. Rotate or replace for production customer accounts.

Important seeded emails include:

- `admin@tanaghum.com`
- `cco@tanaghum.com`
- `brand.head@tanaghum.com`
- `demand.specialist@tanaghum.com`
- `conversion.reviewer@tanaghum.com`
- `growth.viewer@tanaghum.com`
- `revops.head@tanaghum.com`

Do not document real customer passwords in Git.

## 18. Verification Commands

Run before reporting completion:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

Hybrid live E2E:

```bash
npm run test:e2e:hybrid-live
```

If Playwright rate limits or live data state causes a failure, record the exact reason and do not hide it.

CI shortcut:

```bash
npm run ci
```

## 19. Deployment Notes

Hybrid deploy is on VPS `163.123.180.104`.

Do not commit VPS credentials. Use the approved out-of-band credential channel.

The server has used a compose file named `docker-compose.hybrid.yml` under `/opt/tanaghum-hybrid`.

Typical deploy shape:

```bash
cd /opt/tanaghum-hybrid
git fetch origin main
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.hybrid.yml up -d --build app frontend
docker compose -f docker-compose.hybrid.yml run --rm app npm run db:migrate:prod
docker compose -f docker-compose.hybrid.yml restart app
docker compose -f docker-compose.hybrid.yml ps app frontend
```

Smoke checks:

```bash
curl -I https://tanaghum-hybrid.163-123-180-104.sslip.io/
curl https://tanaghum-hybrid.163-123-180-104.sslip.io/api/health
```

For authenticated smoke tests, use seeded/test accounts only where appropriate and do not paste tokens into issues/docs.

## 20. GitHub Working Rules

Use GitHub issues as the source of truth.

Before coding:

```bash
gh issue view <number> --repo tamerabuhalaweh/Tanaghom
gh issue list --repo tamerabuhalaweh/Tanaghom --state open --limit 100
```

After coding:

- comment on the issue with:
  - commit SHA
  - deployed URL if deployed
  - tests run
  - live smoke/e2e result
  - remaining gaps
  - customer credentials/decisions still needed
- close only if the definition of done is truly met
- keep blocked/customer-decision and blocked/customer-credential issues open until actually resolved

GitHub CI should be checked after push:

```bash
gh run list --repo tamerabuhalaweh/Tanaghom --branch main --limit 5
```

## 21. Coding Standards

- Read the existing module before editing it.
- Keep changes scoped to the issue.
- Prefer existing service/repository/controller patterns.
- Use Zod validation for request bodies.
- Preserve tenant scoping.
- Preserve RBAC.
- Create audit evidence for sensitive operations.
- Never return raw secrets.
- Add tests proportional to risk.
- For frontend, keep customer-facing UI clean, aligned, and business-oriented.
- Avoid exposing admin/technical concepts to normal users.
- Use stable layout dimensions and avoid text overlap.
- Do not use "Sprint", raw IDs, internal labels, or technical state names on customer-facing pages unless they are in Admin/Ops.

## 22. Current Known Gaps

Open product gaps:

- Real GHL read-sync acceptance with customer credentials.
- Real Kajabi sales/enrollment sync.
- Meta/YouTube official analytics ingestion.
- Formaloo form import with customer forms.
- WhatsApp sending through GHL or customer-approved provider.
- SmartLabs real tenant validation.
- Social comment/DM AI agent safety and workflow.
- Inbound voice agent production flow.
- Complete discipline-specific workflows after customer definitions.
- Daily/weekly/monthly report delivery through real email/WhatsApp channels.
- CEO-grade analytics from live customer data.
- B2B, Platinum Elite, trainer network, loyalty workflows in depth.
- Final UAE PDPL/legal decisions.
- Dedicated GM system role if customer requires it.

Technical/ops gaps:

- Bundle-size warning remains in frontend build.
- Some live connector flows are readiness-only until credentials exist.
- Full production agentgateway/OpenClaw/AgentScope infrastructure is not deployed.
- Off-server backups and alert routing depend on ops/customer destinations.

## 23. Customer Communication Truth

Tell the customer:

- The platform is ready to configure customer-owned integrations, but live data depends on their credentials.
- Tanaghum does not fake metrics.
- Tanaghum can show missing-data states until integrations are connected.
- Stitchi can prepare governed work and save approved internal records.
- Stitchi will not call external systems without explicit authorization.
- Privacy/legal review must be completed before live social/voice/CRM/AI-agent processing is treated as production-ready.

Do not tell the customer:

- That GHL, Meta, YouTube, Kajabi, Formaloo, WhatsApp, SmartLabs, or Postiz are fully live unless tested with their credentials.
- That OpenClaw/agentgateway/AgentScope are customer-configurable business integrations.
- That the platform knows private social media algorithms.
- That manual fallback data equals production automated sync.

## 24. Suggested Immediate Plan For GPT 5.6 Sol

1. Refresh GitHub open issues.
2. Read #208, #171, #172, #145, #126, and the credential-blocked connector issues.
3. Confirm with the user which next issue to execute.
4. If no new direction, recommend #208 as the next customer-workflow sprint.
5. Keep Hybrid only.
6. Run tests locally before pushing.
7. Deploy Hybrid when the user asks or when the sprint requires live validation.
8. Update GitHub issue evidence.

## 25. Quick Context Recovery Checklist

If context is lost:

1. Open this file.
2. Run `git status --short`.
3. Run `git log -5 --oneline`.
4. Run `gh issue list --repo tamerabuhalaweh/Tanaghom --state open --limit 100`.
5. Check the latest issue comments for the active issue.
6. Do not assume old sprint notes are current if they conflict with this file or GitHub.
7. Ask only if the decision cannot be inferred safely.

## 26. Current Truth In One Paragraph

Tanaghum Hybrid is the active customer-facing product lane at product baseline `6553960`, with canonical repository recovery tag `hybrid-recovery-2026-07-19`. Historical assessment, approved learning, annual planning, monthly initiatives, execution-plan hierarchy, budget governance, Event Operations, Discipline Workspaces, and approval-gated Stitchi planning are implemented. The latest closures are #201, #204, and #206; the recommended next product issue is #208 for weekly operating work below execution plans. Eighteen issues remain open, including production operations, customer/legal decisions, UX acceptance, and customer-credential connector validation. GitHub `main` and the recovery tag are the code recovery points; this file plus current GitHub issues are the onboarding source of truth. Do not claim external integrations live until customer-owned credentials and acceptance evidence exist.
