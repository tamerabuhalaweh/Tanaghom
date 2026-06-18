# Tanaghum AI Commercial Automation Platform

Agent-assisted social media operations platform built on the **STITCH operating substrate**.

## Current Status

| Item | Status |
|---|---|
| Version | v0.1-stitch-foundation-demo |
| Architecture | ✅ Complete (STITCH operating substrate) |
| All integrations | Mock/provider-based only |
| Real external systems | ❌ None connected |
| M5 execution | ❌ Blocked by design |
| Production live execution | ❌ Not enabled |
| Demo safe | ✅ Yes |
| CI | ✅ 4/4 jobs green |
| Tests | ✅ 856 passing |

**This platform is ready for controlled demo/pilot only.**

## Quick Start

### Local Development

```bash
npm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Demo Deployment

```bash
export JWT_SECRET="your-strong-secret-at-least-32-characters-long"
docker compose -f docker-compose.demo.yml up -d
# Frontend: http://localhost:3000
# Backend: http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Tests

```bash
npm test          # Run all tests
npm run lint      # Run lint
npm run typecheck # Run typecheck
npm run build     # Build backend
npm run ci        # Full CI pipeline
```

## Architecture

The platform is built on **STITCH** — a governed, capability-led, AgentRep-centered operating substrate.

### Key Substrates

| Substrate | Purpose |
|---|---|
| Identity (AgentRep) | Delegated agent identity with Session Context Lock |
| SAIF Decisions | Structured evaluation with 10 dimensions, 3 critical |
| Capability Resolution | Intent → Objective → Capability → ExecutionPattern → Resource → Implementation |
| MCP Mediation | All external access mediated through connectors |
| SPINE | Execution lineage with Run + Artifact + replay |
| Observability | Events, AuditRecords, LearningSignals |
| Asset Cognition | Canonical asset identity (not ResourceSpace) |
| Operating Surfaces | Paperclip as external reference surface |
| Publishing Preparation | Readiness checks before future publishing |
| Analytics | Mock provider-based reporting |
| Learning Review | Governed DKS update workflow |
| CRM/WhatsApp | Mock conversion handoff |
| Production/Rendering | Mock rendering preparation |

### Safety Gates

| Gate | Status |
|---|---|
| M5 Publishing | Blocked |
| M5 Rendering | Blocked |
| M5 CRM/WhatsApp | Blocked |
| Direct external access | Blocked (MCP required) |
| Auto DKS updates | Blocked (authority required) |

## Documentation

- [Demo Deployment Guide](docs/deployment/DEMO_DEPLOYMENT_GUIDE.md)
- [Environment Variables](docs/deployment/ENVIRONMENT_VARIABLES.md)
- [Smoke Tests](docs/deployment/SMOKE_TESTS.md)
- [Rollback Guide](docs/deployment/ROLLBACK_GUIDE.md)
- [Demo Checklist](docs/demo/DEMO_CHECKLIST.md)
- [Stakeholder Walkthrough](docs/demo/STAKEHOLDER_WALKTHROUGH.md)
- [Pilot Scope](docs/pilot/PILOT_SCOPE.md)
- [Technical Debt](docs/quality/TECHNICAL_DEBT.md)
- [Release Checklist](docs/quality/RELEASE_CHECKLIST.md)
- [Pilot Guide](docs/quality/PILOT_GUIDE.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [STITCH Architecture](docs/architecture/STITCH_ARCHITECTURE.md)
- [SAIF Framework](docs/architecture/SAIF.md)
- [Security Model](docs/architecture/SECURITY_MODEL.md)
- [Module Boundaries](docs/architecture/MODULE_BOUNDARIES.md)
- [Data Model](docs/architecture/DATA_MODEL.md)
- [Sprint Reports](docs/sprints/)
- [Architecture Decisions](docs/adr/)

## License

Proprietary — SmartLabs / Tanaghum
