# Release Notes — v0.1-stitch-foundation-demo

> **Date**: 2026-06-17
> **Status**: Controlled Demo / Pilot

## What's Included

### STITCH Operating Substrate
- AgentRep identity with Session Context Lock
- SAIF Decision framework (10 evaluation dimensions, 3 critical)
- Capability Resolution pipeline (7-step chain)
- MCP Mediation boundary
- SPINE execution lineage
- Observability (Events, AuditRecords, LearningSignals)
- Asset Cognition (canonical identity)
- Operating Surfaces (Paperclip relay)

### Business Modules
- Campaign workflow (state machine)
- Approval workflow (risk-based routing)
- AI draft generation (mock)
- Algorithm intelligence (reach scoring)
- Publishing preparation (readiness checks)
- Analytics reporting (mock)
- Learning signal review → DKS update
- CRM/WhatsApp conversion (mock)
- Production/rendering preparation (mock)

### Infrastructure
- Docker Compose (dev + demo)
- tsup backend bundler
- React + Vite + Tailwind frontend
- CI/CD (4 jobs: backend, frontend, docker, security)
- Environment validation with kill switches
- Rate limiting, body limits, Helmet security

## What's Mock/Provider-Based

| System | Status |
|---|---|
| Postiz publishing | Mock provider |
| Analytics pulls | Mock provider |
| CRM lead creation | Mock provider |
| WhatsApp messaging | Mock provider |
| Rendering | Mock provider |
| LLM generation | Mock provider |

## What's Intentionally Blocked

- M5 write-enabled execution
- Direct external system access
- Automatic DKS updates
- Real publishing/scheduling
- Real customer messaging
- Real analytics pulls

## Known Limitations

- UI is demo shell, not production dashboard
- No real MCP servers implemented
- No M5 authorization process
- Lightweight secret scan (demo-grade)
- Docker Prisma install in runtime image
- Some assertion-only test fixtures

## Demo Instructions

See [Demo Deployment Guide](docs/deployment/DEMO_DEPLOYMENT_GUIDE.md) and [Stakeholder Walkthrough](docs/demo/STAKEHOLDER_WALKTHROUGH.md).

## Next Phase

1. Real MCP server implementations
2. M5 authorization governance process
3. Production dashboard UI
4. Real Postiz integration through MCP
5. Real analytics through MCP
6. Production deployment pipeline
