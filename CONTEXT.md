# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 13 — Operating Surface / Paperclip Relay Foundation
**Status**: Complete
**Goal**: Implement the Operating Surface / Paperclip Relay foundation. STITCH remains the source of truth.

## Active Module

- `modules/operating-surface/` — Operating surface types, repository, service, tests
- `prisma/schema.prisma` — Operating surface models
- `prisma/migrations/` — Operating surface migration

## Sprint Acceptance Criteria

- [x] OperatingSurface model exists
- [x] SurfaceTask model exists
- [x] SurfaceStatusProjection model exists
- [x] SurfaceRelayEvent model exists
- [x] PaperclipReference model exists
- [x] SurfaceSyncPolicy model exists
- [x] Paperclip is represented only as an operating surface / external reference
- [x] Paperclip cannot own canonical identity, approval, decision, asset, run, artifact, audit, or capability records
- [x] Surface projections are derived visibility only
- [x] Surface relay events cannot directly mutate canonical truth without governed review
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] No external systems are called
- [x] Existing 572 tests still pass
- [x] New operating-surface tests are added (32 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (604 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 14

## Next Sprint (Planned)

**Sprint 14**: TBD — Awaiting review of Sprint 13 before proceeding.
