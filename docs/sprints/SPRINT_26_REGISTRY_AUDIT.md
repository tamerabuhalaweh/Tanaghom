# Sprint 26 — Registry Audit

> **Date**: 2026-06-22

## Current Capability-Registry Module State

### Module Files

| File | Status | Purpose |
|---|---|---|
| `types.ts` | ✅ Exists | Zod schemas for 7 entity types |
| `service.ts` | ✅ Exists | Business logic, role-based permissions, audit logging |
| `repository.ts` | ✅ Exists | Prisma data access layer |
| `tests/capability-registry.test.ts` | ✅ Exists | 33 tests across 8 suites |
| `controller.ts` | ❌ Missing | No HTTP controller |
| `events.ts` | ❌ Missing | No domain event definitions |
| `validators.ts` | ❌ Missing | Validation in types.ts only |

### Prisma Models

| Model | Status | Lines |
|---|---|---|
| Intent | ✅ Defined | 790-810 |
| Objective | ✅ Defined | 812-830 |
| Capability | ✅ Defined | 832-853 |
| ExecutionPattern | ✅ Defined | 855-874 |
| Resource | ✅ Defined | 876-891 |
| Implementation | ✅ Defined | 893-915 |
| ImplementationResource | ✅ Defined | 917-929 |
| CapabilityResolution | ✅ Defined | 931-966 |

### Seed Data

| Entity | Count | Status |
|---|---|---|
| Departments | 5 | ✅ Seeded |
| Users | 7 | ✅ Seeded |
| AgentReps | 7 | ✅ Seeded |
| Functional Agents | 4 | ✅ Seeded |
| Governance Agents | 3 | ✅ Seeded |
| Core Capabilities | 5 | ✅ Seeded |
| MCP Connectors | 6 | ✅ Seeded (all planned) |
| ExecutionPatterns | 0 | ❌ Not seeded |
| Resources | 0 | ❌ Not seeded |
| Implementations | 0 | ❌ Not seeded |
| CapabilityResolutions | 0 | ❌ Not seeded |
| Intents | 0 | ❌ Not seeded |
| Objectives | 0 | ❌ Not seeded |

### Current Seed Capabilities

| # | Name | Category | Risk |
|---|---|---|---|
| 1 | GenerateContentDraft | content | medium |
| 2 | EvaluateReachReadiness | analysis | low |
| 3 | RequestApproval | governance | medium |
| 4 | RetrieveKnowledge | knowledge | low |
| 5 | PreparePublishingPackage | publishing | high |

### Test Coverage

| Suite | Tests | Validates |
|---|---|---|
| Capability Registry Permissions | 6 | Role-based access |
| Canonical Chain Validation | 3 | Intent→Objective→Capability chain |
| M5 Implementation Blocking | 4 | M5 blocked |
| MCP Boundary | 2 | MCP mediation |
| SAIF Decision Requirement | 3 | SAIF requirement |
| Approval Requirement | 2 | Approval requirement |
| Capability Risk Levels | 1 | Risk levels |
| Core Seed Capabilities | 6 | Seed capabilities |

## What Already Exists

1. Full Prisma schema for capability resolution chain
2. Service layer with role-based permissions
3. Repository layer with Prisma mappers
4. 5 core capabilities seeded
5. 33 passing tests
6. MCP mediation boundary enforcement
7. SAIF decision requirement enforcement
8. Approval requirement enforcement

## What Is Missing

1. No ExecutionPatterns seeded
2. No Resources seeded
3. No Implementations seeded
4. No Intents or Objectives seeded
5. No `domain` field on Capability model
6. No `reusable` flag on Capability model
7. No capability dependency model
8. No domain event publishing
9. No controller.ts, events.ts, validators.ts
10. Enterprise capability bundles not registered

## What Must Be Extended Without Duplication

1. **Add seed data** for enterprise capabilities (not new models)
2. **Document** capability bundle groupings (not new schema)
3. **Document** topology node mappings (not new schema)
4. **Register** future enterprise capabilities as planned (not implemented)
5. **Map** Commercial/Content as reference implementation
