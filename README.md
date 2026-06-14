# Tanaghum AI Commercial Automation Platform

Agent-assisted social media operations platform for SmartLabs. Plans, drafts, reviews, schedules, publishes, measures, and improves social content across selected channels with minimal manual coordination and strong human oversight.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Database**: PostgreSQL + Prisma
- **Queue/Scheduler**: Redis + BullMQ
- **Publishing**: Postiz (CLI/Public API)
- **Agent Runtime**: OpenClaw
- **LLM**: Provider-neutral interface (GPT, Claude, Gemini, or open-source)
- **Frontend**: React (Vite)
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
npx prisma migrate dev

# Start development server
npm run dev

# Run tests
npm run test

# Run lint + typecheck + test + build
npm run ci
```

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
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |
| `npm run ci` | Full CI pipeline (lint + typecheck + test + build) |

## Documentation

- [Product Requirements](docs/product/PRD.md)
- [Software Requirements](docs/product/SRS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Module Boundaries](docs/architecture/MODULE_BOUNDARIES.md)
- [API Contract](docs/api/openapi.yaml)
- [Sprint Plan](docs/sprints/)
- [Architecture Decisions](docs/adr/)

## Repository Rules

- Read [CONTEXT.md](CONTEXT.md) before every AI coding session
- Follow [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) for coding conventions
- One module per sprint — never edit unrelated modules
- Tests mandatory for every module
- No secrets in source code or documentation
