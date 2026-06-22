# Tanaghom AI Enterprise Platform

A STITCH-based, SAIF-governed, multi-agent enterprise operating platform covering Commercial/Social/Content, Finance, HR, Procurement, Inventory, Purchase Management, Supply Chain, and optional ERP integrations.

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
| Tests | ✅ 855 passing |

**This platform is ready for controlled demo/pilot only.**

## Enterprise Control Plane

**AI memory is not authoritative.** Every sprint must start from repo docs, Sprint Template, Source-of-Truth Register, and Enterprise Acceptance Criteria.

| Document | Purpose |
|---|---|
| [Source-of-Truth Register](docs/enterprise/governance/SOURCE_OF_TRUTH_REGISTER.md) | SRD, STITCH, SAIF, Repo hierarchy |
| [Repo Baseline Audit](docs/enterprise/governance/REPO_BASELINE_AUDIT.md) | Current repo state audit |
| [STITCH Supremacy](docs/enterprise/architecture/STITCH_SUPREMACY.md) | Architecture source of truth |
| [Capability & Topology Model](docs/enterprise/architecture/CAPABILITY_AND_TOPOLOGY_MODEL.md) | Capabilities as stable units, departments as topology nodes |
| [Content Department Overlay](docs/enterprise/architecture/CONTENT_DEPARTMENT_OVERLAY_MODEL.md) | Commercial/Content domain overlay |
| [SAIF Decision Package Schema](docs/enterprise/saif/SAIF_DECISION_PACKAGE_SCHEMA.md) | Decision governance schema |
| [Pack Boundary Model](docs/enterprise/packs/PACK_BOUNDARY_MODEL.md) | Domain pack isolation rules |
| [ERP Connector Governance](docs/enterprise/erp/ERP_CONNECTOR_GOVERNANCE.md) | Optional ERP integration rules |
| [Enterprise Acceptance Criteria](docs/enterprise/governance/ENTERPRISE_ACCEPTANCE_CRITERIA.md) | Cross-domain acceptance rules |
| [AI Engineering Protocol](docs/enterprise/governance/AI_ENGINEERING_PROTOCOL.md) | No AI memory, strict source-of-truth |
| [Sprint Template](docs/enterprise/governance/SPRINT_TEMPLATE.md) | Standardized sprint structure |
| [Enterprise Roadmap](docs/enterprise/ENTERPRISE_ROADMAP.md) | Sprints 25-40+ planning |
| [Canonical Taxonomy](docs/enterprise/taxonomy/CANONICAL_TAXONOMY.md) | Approved terms and mappings |
| [Legacy Taxonomy Mapping](docs/enterprise/taxonomy/LEGACY_TAXONOMY_MAPPING.md) | Old terms → new model |
| [ADR-011: Canonical Taxonomy](docs/adr/011-canonical-taxonomy-and-capability-topology.md) | Taxonomy and topology decisions |
| [Capability Registry Extension Plan](docs/enterprise/architecture/CAPABILITY_REGISTRY_EXTENSION_PLAN.md) | How to register new capabilities |

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
