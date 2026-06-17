# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 15 — Controlled Postiz Integration / M5-Gated Publishing
**Status**: Complete
**Goal**: Introduce Postiz as a controlled publishing implementation behind STITCH governance.

## Active Module

- `modules/postiz-integration/` — Postiz integration types, repository, service, tests
- `shared/providers/` — PostizProvider interface and MockPostizProvider
- `prisma/schema.prisma` — Postiz integration models
- `prisma/migrations/` — Postiz integration migration

## Sprint Acceptance Criteria

- [x] PostizConnector placeholder exists
- [x] PostizAccountReference placeholder exists
- [x] PublishingExecutionRequest model exists
- [x] PostizPublishingJob model exists
- [x] MockPostizProvider exists and is deterministic
- [x] Real Postiz provider is not active
- [x] PublishingPackage readiness is validated before execution request
- [x] Approval is required
- [x] SAIF critical dimensions are required
- [x] CapabilityResolution is required
- [x] MCP mediation is required
- [x] SPINE run reference is created or supported
- [x] Observability event/audit is created where practical
- [x] M5 publishing is blocked by default
- [x] Direct Postiz access is blocked
- [x] No external systems are called
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] Existing 644 tests still pass
- [x] New controlled Postiz tests are added (29 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (673 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 16

## Next Sprint (Planned)

**Sprint 16**: TBD — Awaiting review of Sprint 15 before proceeding.
