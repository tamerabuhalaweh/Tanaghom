# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 12 — Asset Cognition & ResourceSpace Boundary
**Status**: Complete
**Goal**: Implement the Asset Cognition foundation. STITCH owns canonical asset identity. ResourceSpace is external reference only.

## Active Module

- `modules/asset-cognition/` — Asset cognition types, repository, service, tests
- `prisma/schema.prisma` — Asset cognition models
- `prisma/migrations/` — Asset cognition migration

## Sprint Acceptance Criteria

- [x] Canonical Asset model exists
- [x] AssetCognitionRecord model exists
- [x] ExternalAssetReference model exists
- [x] Asset lineage is supported
- [x] ResourceSpace is represented only as an external reference surface
- [x] ResourceSpace cannot own canonical asset identity
- [x] Asset Cognition references foreign canonical objects by ID only
- [x] Asset cognition records cannot approve, publish, execute, or replace human review
- [x] HumanUser and AgentRep lineage are included
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] No external systems are called
- [x] Existing 532 tests still pass
- [x] New asset cognition tests are added (40 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (572 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 13

## Next Sprint (Planned)

**Sprint 13**: TBD — Awaiting review of Sprint 12 before proceeding.
