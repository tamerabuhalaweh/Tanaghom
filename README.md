# Tanaghum AI Commercial Automation Platform

Agent-assisted social media operations platform built on the **STITCH operating substrate**. Plans, drafts, reviews, schedules, publishes, measures, and improves social content across selected channels with minimal manual coordination and strong human oversight.

## Current Status (Sprint 20)

| Item | Status |
|---|---|
| Architecture foundation | ✅ Complete (STITCH operating substrate) |
| All integrations | Mock/provider-based only |
| Real external systems connected | ❌ None |
| M5 execution | ❌ Blocked by design |
| Production live execution | ❌ Not enabled |
| Ready for controlled demo/pilot | ✅ Yes |

**This platform is ready for controlled demo/pilot only.** All external integrations are mock/provider-based. No real publishing, CRM, analytics, rendering, or external API calls are implemented.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Database**: PostgreSQL + Prisma
- **Queue/Scheduler**: Redis + BullMQ
- **Publishing**: Postiz (mock provider only)
- **Agent Runtime**: OpenClaw
- **LLM**: Provider-neutral interface (mock provider only)
- **Frontend**: React (Vite) — not yet built
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **CI/CD**: GitHub Actions
- **Infrastructure**: Docker Compose

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed development data
npx prisma db seed

# Start development server
npm run dev

# Start frontend demo shell (separate terminal)
cd frontend && npm run dev

# Run tests
npm test

# Full CI pipeline
npm run ci
```

## Frontend Demo Shell

The `frontend/` directory contains a demo UI for stakeholder presentations.

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and provides:
- STITCH Dashboard with workflow visualization
- Campaign workspace
- Approval queue
- SAIF decision records
- Capability resolution viewer
- MCP mediation boundary page
- Publishing package readiness
- SPINE timeline
- Observability / audit trail
- Asset cognition
- Analytics reports
- Learning signal review
- CRM/WhatsApp handoff preparation
- Production/rendering preparation
- System safety / M5 blocked status

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |
| `npm run ci` | Full CI pipeline (lint + typecheck + test + build) |

## STITCH Architecture

The platform is built on STITCH — a governed, capability-led, AgentRep-centered operating substrate. See [STITCH Architecture](docs/architecture/STITCH_ARCHITECTURE.md) for details.

### Key Principles

1. **AgentRep is the delegated identity** — agents act through AgentReps bound to humans
2. **Capabilities are resolved before tools** — Intent → Objective → Capability → Execution
3. **MCP mediates external access** — agents never directly access external systems
4. **SPINE records everything** — every execution has lineage and replay capability
5. **SAIF governs decisions** — structured evaluation with critical dimension enforcement

## Documentation

- [Architecture](docs/architecture/ARCHITECTURE.md)
- [STITCH Architecture](docs/architecture/STITCH_ARCHITECTURE.md)
- [SAIF Framework](docs/architecture/SAIF.md)
- [Module Boundaries](docs/architecture/MODULE_BOUNDARIES.md)
- [Data Model](docs/architecture/DATA_MODEL.md)
- [Security Model](docs/architecture/SECURITY_MODEL.md)
- [API Contract](docs/api/openapi.yaml)
- [Sprint Reports](docs/sprints/)
- [Architecture Decisions](docs/adr/)
- [Pilot Guide](docs/quality/PILOT_GUIDE.md)
- [Release Checklist](docs/quality/RELEASE_CHECKLIST.md)
- [Testing Strategy](docs/quality/TESTING_STRATEGY.md)

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-17 | Sprint 20 — status update, STITCH references, pilot guide | Sprint 20 |
