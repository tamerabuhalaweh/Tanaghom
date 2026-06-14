# SPRINT-00: Foundation & Repository Standards

> **Sprint**: 0A + 0B
> **Status**: 0A In Progress
> **Duration**: 0A (1–2 days) + 0B (2–3 days)

## Sprint 0A: Documentation & Repository Rules

**Goal**: Establish all documentation, policies, agent instructions, ADRs, and module READMEs before any code is written.

### Deliverables

| Deliverable | Status |
|---|---|
| Project directory structure | ✅ Done |
| README.md | ✅ Done |
| CONTEXT.md | ✅ Done |
| CLAUDE.md | ✅ Done |
| AGENTS.md | ✅ Done |
| SOUL.md | ✅ Done |
| MEMORY.md | ✅ Done |
| HEARTBEAT.md | ✅ Done |
| PLATFORM_RULES.md | ✅ Done |
| APPROVAL_POLICY.md | ✅ Done |
| SECURITY_POLICY.md | ✅ Done |
| docs/product/PRD.md | ✅ Done |
| docs/product/SRS.md | ✅ Done |
| docs/product/USER_ROLES.md | ✅ Done |
| docs/product/WORKFLOWS.md | ✅ Done |
| docs/architecture/ARCHITECTURE.md | ✅ Done |
| docs/architecture/MODULE_BOUNDARIES.md | ✅ Done |
| docs/architecture/DATA_MODEL.md | ✅ Done |
| docs/architecture/SECURITY_MODEL.md | ✅ Done |
| docs/architecture/AI_AGENT_MODEL.md | ✅ Done |
| docs/architecture/STATE_MACHINES.md | ✅ Done |
| docs/api/openapi.yaml | ✅ Done |
| docs/adr/000-template.md | ✅ Done |
| docs/adr/001-use-postgresql.md | ✅ Done |
| docs/adr/002-use-postiz-for-publishing.md | ✅ Done |
| docs/adr/003-use-department-approval-workflow.md | ✅ Done |
| docs/adr/004-use-algorithm-intelligence-mcp.md | ✅ Done |
| docs/sprints/SPRINT-00-foundation.md | ✅ Done |
| docs/quality/TESTING_STRATEGY.md | ✅ Done |
| docs/quality/RELEASE_CHECKLIST.md | ✅ Done |
| docs/quality/AI_SESSION_PROTOCOL.md | ✅ Done |
| docs/prompts/AI_CODING_SESSION_PROMPT.md | ✅ Done |
| docs/prompts/PR_REVIEW_PROMPT.md | ✅ Done |
| All 12 modules/*/README.md | ✅ Done |
| Provider interface definitions (types only) | ✅ Done |

### Acceptance Criteria

- [x] All documentation files exist and are complete
- [x] All module boundaries are documented
- [x] All ADRs are written with status Accepted
- [x] Provider interfaces defined (types only)
- [x] State machines fully documented with transition tables
- [x] Context.md reflects current sprint state

---

## Sprint 0B: Technical Foundation

**Goal**: Set up the development environment, CI/CD, database, queue system, linting, and testing infrastructure.

**Status**: Complete (pending review)

### Deliverables

| Deliverable | Status | Description |
|---|---|---|
| `package.json` | ✅ | Node.js/TypeScript project with all scripts (dev, build, lint, typecheck, test, db:migrate, etc.) |
| `tsconfig.json` | ✅ | TypeScript strict mode, ES2022, path aliases (@shared, @modules) |
| `eslint.config.js` | ✅ | ESLint 9 flat config with typescript-eslint |
| `.prettierrc` | ✅ | Prettier config (single quotes, trailing commas, 100 width) |
| `docker-compose.yml` | ✅ | PostgreSQL 16 + Redis 7 with health checks |
| `.env.example` | ✅ | All env vars with placeholders (DB, Redis, JWT, LLM, Postiz, Messaging, CRM) |
| `prisma/schema.prisma` | ✅ | Full schema: 14 models (users, departments, content_requests, content_items, draft_versions, approval_events, schedule_events, analytics_snapshots, learning_insights, platform_rules, audit_logs, reach_optimization_rules) with enums |
| `vitest.config.ts` | ✅ | Vitest with path aliases |
| `playwright.config.ts` | ✅ | Playwright E2E config |
| `.github/workflows/ci.yml` | ✅ | CI: PostgreSQL + Redis services, lint → typecheck → test → build |
| `.gitignore` | ✅ | Standard Node.js + env + build artifacts |
| `.editorconfig` | ✅ | 2-space indent, UTF-8, LF line endings |
| `shared/database/` | ✅ | Prisma client singleton, connect/disconnect, health check |
| `shared/errors/` | ✅ | 8 error types (App, Validation, NotFound, Forbidden, Unauthorized, Conflict, ExternalService, StateTransition) + tests |
| `shared/logging/` | ✅ | Pino structured logger with audit log helper |
| `shared/auth/` | ✅ | JWT sign/verify, bcrypt hash/compare, role middleware skeleton |
| `shared/events/` | ✅ | In-process event bus (on/off/emit/clear) + tests |
| `shared/validation/` | ✅ | Zod schemas (email, UUID, ISO 8601, pagination) + validateOrThrow + tests |
| `shared/queue/` | ✅ | BullMQ queue/worker factory, Redis connection, health check |
| `shared/providers/` | ✅ | 5 provider interfaces (types only) + 5 mock implementations |
| `src/index.ts` | ✅ | Express app entry point with middleware, health route, graceful shutdown |
| `src/routes/health.ts` | ✅ | GET /health returns app, database, and Redis status |
| Smoke tests | ✅ | Error types, validation, event bus tests |

### What Is NOT in Sprint 0B

- Frontend scaffold (deferred to when UI sprints begin)
- Real provider implementations (interfaces + mocks only)
- Business logic (campaigns, approvals, AI, analytics, publishing, CRM)
- Database seed data (deferred to Sprint 1)
- Real Prisma migration (requires running database — will run in Sprint 1)

---

## Sprint Execution Rules (All Sprints)

Every sprint must deliver ALL of the following:

1. **API contract** — OpenAPI spec updated in `docs/api/openapi.yaml`
2. **Database migration** — If schema changed, via Prisma
3. **Backend logic** — Service + repository + controller + validators
4. **Frontend screen** — If the sprint has a UI component
5. **Tests** — Unit, integration, permission, API
6. **Documentation update** — Sprint file, CONTEXT.md, ADR if needed
7. **PR summary** — Files changed, tests added, risks, what remains

## Revised Sprint Roadmap

| Sprint | Theme | Deliverable |
|---|---|---|
| 0A | Documentation & Repo Rules | All docs, policies, ADRs, module READMEs |
| 0B | Technical Foundation | Docker, DB, Redis, CI, linting, testing, shared infra |
| 1 | Users, Roles & Departments | Auth, users, departments, roles, permissions. Seed Tanaghum structure (8 departments) |
| 2 | Campaign Request Workflow | Campaign intake, content items, state machine, intake form UI |
| 3 | AI Draft Generation | Platform-native drafts, brand voice, risk scoring, draft review UI |
| 4 | Algorithm Intelligence MCP | Reach score, platform rules KB, optimization suggestions, score display UI |
| 5 | Approval Workflow | Approval routing, SLA, notifications, approval dashboard UI |
| 6 | Postiz Publishing Integration | Postiz adapter, scheduling, retry logic, publishing status UI |
| 7 | Analytics & Reporting | Analytics pulls, weekly report, dashboard UI |
| 8 | Learning Engine | Pattern identification, MEMORY.md updates, insights UI |
| 9 | CRM / WhatsApp Conversion | Lead routing, CRM tags, CTA tracking |
| 10 | Production & Design Workflow | Creative briefs, asset requests, production request UI |
| 11 | Security, QA & Hardening | Audit logs, security hardening, E2E tests, admin UI |

## Tanaghum Department Seed Data (Sprint 1)

| Department | Description |
|---|---|
| CCO | Final visibility and approval for sensitive, high-budget, public, strategic campaigns |
| Brand & Positioning | Voice, identity, positioning, PR sensitivity, visual/message alignment |
| Acquisition | Reach, SEO, algorithm fit, hashtags, timing, amplification |
| Conversion & Closing | CTA, WhatsApp flow, landing pages, objection handling, sales route |
| Growth & Retention | Upsell, re-engagement, community, loyalty, alumni, B2B nurturing |
| Commercial Operations | CRM tagging, reporting, attribution, dashboards, analytics, pipeline visibility |
| Production & Design | Creative assets, reels, carousels, videos, campaign visuals, asset delivery |
| Event Operations & Logistics | Event content, venue, scheduling, logistics |
