# ARCHITECTURE.md — System Architecture

> **Version**: 1.0
> **Date**: 2026-06-14
> **Update Rule**: Only by architecture decision (ADR)

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js + TypeScript | Application server |
| Database | PostgreSQL + Prisma | Operational data store, schema migrations |
| Queue/Scheduler | Redis + BullMQ | Background jobs, retries, scheduled tasks |
| Publishing | Postiz CLI/Public API | Social media publishing and analytics |
| Agent Runtime | OpenClaw | Autonomous agent orchestration |
| LLM | Provider-neutral interface | Text generation, embeddings |
| Vector Store | pgvector or Qdrant | Semantic search for brand knowledge and learnings |
| Frontend | React + Vite | Dashboard for campaign, approval, analytics |
| Testing | Vitest + Playwright | Unit/integration + E2E tests |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, deploy |
| Infrastructure | Docker Compose | Local development and deployment |

## High-Level Architecture

```
User / Marketing Team
    ↓
Messaging Interface (Slack / WhatsApp / Telegram)
    ↓
OpenClaw Agent Runtime (sandboxed, allowlisted tools)
    ├── Content Strategy Agent
    ├── Content Writer Agent
    ├── Brand & Compliance Review Agent
    ├── Scheduler Agent
    ├── Analytics & Learning Agent
    └── Security Sentinel
    ↓
Workflow Orchestrator / API Service (Node.js + TypeScript)
    ↓
┌───────────────────────────────────────────────┐
│ PostgreSQL          │ Redis + BullMQ          │
│ - content items     │ - analytics pull jobs   │
│ - approvals         │ - weekly report jobs    │
│ - analytics         │ - retry jobs            │
│ - audit logs        │ - heartbeat tasks       │
│ - platform rules    │ - approval reminders    │
└───────────────────────────────────────────────┘
    ↓
Postiz CLI / Public API
    ↓
Connected Social Platforms (LinkedIn, Instagram, X)
```

## Folder Structure

```
/
├── docs/                        # All documentation
│   ├── product/                 # PRD, SRS, user roles, workflows
│   ├── architecture/            # Architecture, boundaries, data model, security
│   ├── api/                     # OpenAPI contract
│   ├── adr/                     # Architecture decision records
│   ├── sprints/                 # Sprint files
│   ├── quality/                 # Testing, release, AI session protocol
│   └── prompts/                 # AI coding and PR review prompts
├── modules/                     # Business modules (12 modules)
│   ├── auth/
│   ├── users-departments/
│   ├── campaigns/
│   ├── ai-generation/
│   ├── algorithm-intelligence/
│   ├── approvals/
│   ├── publishing/
│   ├── postiz-integration/
│   ├── analytics/
│   ├── learning-engine/
│   ├── crm-conversion/
│   └── production-requests/
├── shared/                      # Shared utilities
│   ├── database/                # Prisma client, connection helpers
│   ├── errors/                  # Standard error types
│   ├── logging/                 # Structured logging
│   ├── auth/                    # JWT/session, permission middleware
│   ├── events/                  # Domain event bus
│   ├── validation/              # Common validation schemas
│   └── queue/                   # BullMQ queue setup and job definitions
├── frontend/                    # React dashboard (Vite)
│   ├── src/
│   │   ├── pages/               # Route-based pages
│   │   ├── components/          # Shared UI components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── api/                 # API client layer
│   │   └── types/               # Frontend type definitions
│   └── ...
├── prisma/                      # Database schema and migrations
│   └── schema.prisma
├── docker-compose.yml           # PostgreSQL, Redis, Postiz, app services
├── .env.example                 # Environment variable template
├── package.json                 # Node.js project config
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Test config
├── playwright.config.ts         # E2E test config
├── CONTEXT.md                   # Active sprint briefing
├── CLAUDE.md                    # Permanent AI coding instructions
├── AGENTS.md                    # Agent operating instructions
├── SOUL.md                      # Brand voice
├── MEMORY.md                    # Durable learnings
├── HEARTBEAT.md                 # Scheduled tasks
├── PLATFORM_RULES.md            # Platform rules KB
├── APPROVAL_POLICY.md           # Approval workflow policy
└── SECURITY_POLICY.md           # Security constraints
```

## Module Internal Pattern

Every module follows the same structure:

```
/modules/[module-name]/
├── controller.ts    # HTTP/API request handling only
├── service.ts       # Business logic
├── repository.ts    # Database access only
├── types.ts         # Module interfaces and types
├── validators.ts    # Input validation
├── events.ts        # Domain events emitted/handled
├── tests/
│   ├── service.test.ts
│   ├── controller.test.ts
│   └── integration.test.ts
└── README.md        # Module responsibility and API notes
```

## Communication Patterns

- **Module → Module**: Domain events via shared event bus (no direct imports except shared utilities)
- **Module → Database**: Via repository layer only (Prisma client)
- **Module → External**: Via provider interfaces only (never direct API calls)
- **Frontend → Backend**: REST API (OpenAPI contract)
- **Agent → System**: Via tool calls through OpenClaw runtime

## Design Principles

1. **Postiz is the authoritative publishing system** — stores connected platform integrations
2. **OpenClaw is an orchestrator** — not the source of truth for operational state
3. **Database stores workflow state** — approvals, analytics, audit logs
4. **Markdown files store agent behavior** — not secrets or raw analytics
5. **Human approval is mandatory** — until system earns production trust
6. **Every external action is logged** — actor, timestamp, input, output, policy decision
7. **Provider interfaces for all external services** — mock first, real implementations after security review
8. **Strict state machines** — campaign and approval states cannot be bypassed

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
