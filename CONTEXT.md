# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 10 — SPINE Run & Artifact Lineage
**Status**: Complete
**Goal**: Implement the SPINE foundation for Run and Artifact lineage. Record planned or simulated execution runs, artifacts, causal links, and replayable audit lineage.

## Active Module

- `modules/spine/` — SPINE types, repository, service, tests
- `prisma/schema.prisma` — SPINE models
- `prisma/migrations/` — SPINE migration

## Sprint Acceptance Criteria

- [x] SPINE Run model exists
- [x] SPINE Artifact model exists
- [x] Run and artifact lineage are supported
- [x] Replay bundle query can reconstruct linked references
- [x] SPINE references foreign canonical objects by ID but does not own them
- [x] HumanUser and AgentRep lineage are included
- [x] M5/write-enabled runs are blocked
- [x] Artifact integrity metadata exists
- [x] No external systems are called
- [x] Existing 458 tests still pass
- [x] New SPINE tests are added (44 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (502 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 11

## Next Sprint (Planned)

**Sprint 11**: TBD — Awaiting review of Sprint 10 before proceeding.
