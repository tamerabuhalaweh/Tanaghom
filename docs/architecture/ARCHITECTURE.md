# ARCHITECTURE.md — System Architecture

> **Version**: 2.0
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Update Rule**: Only by architecture decision (ADR)

## Overview

Tanaghum is built on **STITCH** — a governed, capability-led, AgentRep-centered operating substrate. STITCH is not merely a social/content automation stack; it is an agent-native operating layer that governs identity, capability resolution, execution lineage, observability, and asset cognition.

See `STITCH_ARCHITECTURE.md` for the full STITCH specification.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Operating Substrate | STITCH | Agent identity, capability resolution, lineage, observability |
| Runtime | Node.js + TypeScript | Application server |
| Database | PostgreSQL + Prisma | Operational data store, schema migrations |
| Queue/Scheduler | Redis + BullMQ | Background jobs, retries, scheduled tasks |
| Publishing | Postiz (adjacent surface) | Social media publishing and analytics |
| Agent Runtime | OpenClaw (adjacent surface) | Autonomous agent orchestration |
| LLM | MCP-mediated provider | Text generation, embeddings |
| Asset Management | ResourceSpace (adjacent surface) | Asset storage/retrieval (not identity owner) |
| Observability | Grafana (adjacent surface) | Dashboards and monitoring |
| Rendering | Rendering tools (adjacent surface) | Image/video production pipelines |
| Editorial | Paperclip (adjacent surface) | Content management workflow |
| Vector Store | pgvector or Qdrant | Semantic search for brand knowledge and learnings |
| Frontend | React + Vite | Dashboard for campaign, approval, analytics |
| Testing | Vitest + Playwright | Unit/integration + E2E tests |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, deploy |
| Infrastructure | Docker Compose | Local development and deployment |

## High-Level Architecture

```
HumanUser
    ↓ (authenticates, Session Context Lock)
AgentRep (canonical delegated identity)
    ↓ (resolves capability)
Intent → Objective → Capability → ExecutionPattern → Resource → Implementation
    ↓ (MCP mediation boundary)
┌──────────────────────────────────────────────────────────┐
│ FunctionalAgents          │ GovernanceAgents              │
│ - content-writer          │ - security-sentinel           │
│ - brand-reviewer          │ - compliance-guardian          │
│ - analytics-puller        │                                │
│ - scheduler               │                                │
└──────────────────────────────────────────────────────────┘
    ↓ (SPINE records)
Run → Artifact (lineage, replay index)
    ↓
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL          │ Redis + BullMQ                      │
│ - identity model    │ - analytics pull jobs               │
│ - capability graph  │ - weekly report jobs                │
│ - SPINE records     │ - retry jobs                        │
│ - asset cognition   │ - heartbeat tasks                   │
│ - observability     │ - approval reminders                │
└──────────────────────────────────────────────────────────┘
    ↓ (MCP provider boundaries)
┌──────────────────────────────────────────────────────────┐
│ Adjacent Surfaces (not canonical ownership)               │
│ Postiz · ResourceSpace · Paperclip · Grafana · Renderers │
└──────────────────────────────────────────────────────────┘
    ↓
Connected Platforms (LinkedIn, Instagram, X, etc.)
```

## Adjacent Surfaces vs Canonical Ownership

STITCH distinguishes between canonical ownership and adjacent surfaces:

| Entity | Canonical Owner | Adjacent Surface |
|---|---|---|
| Agent Identity | AgentRep (Tanaghum DB) | — |
| Capability Resolution | Capability graph (Tanaghum DB) | — |
| Execution Lineage | SPINE (Tanaghum DB) | — |
| Asset Identity | Asset (Tanaghum DB) | ResourceSpace (storage only) |
| Observability | Event/AuditRecord (Tanaghum DB) | Grafana (dashboards) |
| Publishing | Publishing module (Tanaghum) | Postiz (execution) |
| Editorial Workflow | — | Paperclip (surface) |
| Rendering | — | Rendering tools (surface) |

## Folder Structure

```
/
├── docs/                        # All documentation
│   ├── product/                 # PRD, SRS, user roles, workflows
│   ├── architecture/            # Architecture, boundaries, data model, security, SAIF
│   ├── api/                     # OpenAPI contract
│   ├── adr/                     # Architecture decision records (SAIF format for 010+)
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

1. **AgentRep is the canonical delegated identity** — all agent actions are performed by AgentReps bound to HumanUsers (ADR-005)
2. **Capabilities are resolved before tools are invoked** — Intent → Objective → Capability → ExecutionPattern → Resource → Implementation → Execution (ADR-006)
3. **M4/M5 runtime separation** — functional agents (M4) and governance agents (M5) operate in separate runtime contexts (ADR-007)
4. **Asset Cognition owns canonical asset identity** — ResourceSpace is an adjacent surface, not the source of truth (ADR-008)
5. **Paperclip and ResourceSpace are adjacent surfaces** — they provide execution capabilities but do not own canonical data (ADR-009)
6. **SAIF v1.2 is the normative decision framework** — all significant AI decisions must follow SAIF's DKS declaration, mandatory evaluation dimensions, and cost-benefit analysis (ADR-010)
7. **MCP mediates all external access** — agents never directly access files, databases, analytics APIs, renderers, or enterprise APIs
8. **SPINE records all execution** — every Run produces Artifacts with lineage and replay index
9. **Observability is first-class** — Events, AuditRecords, and LearningSignals are structural, not afterthoughts
10. **Human approval is mandatory** — until system earns production trust
11. **Every external action is logged** — actor, timestamp, input, output, policy decision
12. **Strict state machines** — campaign and approval states cannot be bypassed

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
| 2026-06-16 | STITCH alignment — operating substrate, adjacent surfaces, design principles | Sprint 4.5 |
| 2026-06-16 | SAIF v1.2 adoption — normative decision framework, ADR-010 | Sprint 4.5 |
