# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 8 — Capability Registry & Resolution
**Status**: Complete
**Goal**: Implement the STITCH capability registry and capability-resolution foundation. The system must resolve work through the canonical chain before any tool, API, MCP, or external implementation is used.

## Active Module

- `modules/capability-registry/` — Capability registry types, repository, service, tests
- `prisma/schema.prisma` — Capability registry models
- `prisma/seed.ts` — Core capability seed data

## Sprint Acceptance Criteria

- [x] Intent, Objective, Capability, ExecutionPattern, Resource, Implementation, and CapabilityResolution models exist
- [x] Capability resolution follows the canonical chain
- [x] Resolution records include HumanUser and AgentRep lineage
- [x] Resolution can link to SAIF Decision Records
- [x] Resolution can require approval where needed
- [x] M5/write-enabled implementations are blocked
- [x] MCP-required implementations are recorded but not executed
- [x] Core seed capabilities exist
- [x] No external systems are called
- [x] Existing 382 tests still pass
- [x] New registry/resolution tests are added (31 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (413 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 9

## Next Sprint (Planned)

**Sprint 9**: TBD — Awaiting review of Sprint 8 before proceeding.
