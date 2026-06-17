# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 14 — Publishing Preparation Package
**Status**: Complete
**Goal**: Create a governed Publishing Preparation Package that proves a content item is ready for future publishing.

## Active Module

- `modules/publishing-preparation/` — Publishing preparation types, repository, service, tests
- `prisma/schema.prisma` — Publishing preparation models
- `prisma/migrations/` — Publishing preparation migration

## Sprint Acceptance Criteria

- [x] PublishingPackage model exists
- [x] PublishingPackageItem model exists
- [x] PublishingTarget model exists
- [x] PublishingReadinessCheck model exists
- [x] PublishingManifest model exists
- [x] Package readiness requires approval, SAIF critical dimension resolution, capability resolution
- [x] Publishing manifest can be generated without external calls
- [x] M5 publishing/scheduling remains blocked
- [x] Postiz is not called
- [x] No external systems are called
- [x] HumanUser and AgentRep lineage are included
- [x] Existing 604 tests still pass
- [x] New publishing-preparation tests are added (40 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (644 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 15

## Next Sprint (Planned)

**Sprint 15**: TBD — Awaiting review of Sprint 14 before proceeding.
