# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 19 — Production / Rendering Workflow Foundation
**Status**: Complete
**Goal**: Implement controlled production and rendering workflow foundation. Mock/provider-based, MCP-mediated, preparation-only.

## Active Module

- `modules/production-rendering/` — Production/rendering types, repository, service, tests
- `shared/providers/` — RenderingProvider interface and MockRenderingProvider
- `prisma/schema.prisma` — Production/rendering models
- `prisma/migrations/` — Production/rendering migration

## Sprint Acceptance Criteria

- [x] ProductionRequest model exists
- [x] CreativeBrief model exists
- [x] ProductionAssetRequirement model exists
- [x] RenderingPreparationPackage model exists
- [x] RenderingTarget model exists
- [x] ProductionReviewChecklist model exists
- [x] MockRenderingProvider exists and is deterministic
- [x] Missing MCP mediation blocks rendering preparation
- [x] M5 rendering execution is blocked
- [x] Direct rendering tool access is blocked
- [x] No real rendering, file upload, or external tool call occurs
- [x] Asset Cognition remains canonical owner of asset identity
- [x] HumanUser and AgentRep lineage are included
- [x] Existing 766 tests still pass
- [x] New production/rendering tests are added (27 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (793 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 20

## Next Sprint (Planned)

**Sprint 20**: TBD — Awaiting review of Sprint 19 before proceeding.
