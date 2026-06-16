# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 11 — Observability Substrate & Audit/Learning Signals
**Status**: Complete
**Goal**: Implement the Observability substrate foundation. Event, AuditRecord, and LearningSignal as canonical evidence layer.

## Active Module

- `modules/observability/` — Observability types, repository, service, tests
- `prisma/schema.prisma` — Observability models
- `prisma/migrations/` — Observability migration

## Sprint Acceptance Criteria

- [x] ObservabilityEvent model exists
- [x] AuditRecord model exists
- [x] LearningSignal model exists
- [x] Observability references foreign canonical objects by ID only
- [x] Evidence trails can be queried by object, user, AgentRep, SAIF decision, approval, capability resolution, MCP mediation, SPINE run, and SPINE artifact
- [x] LearningSignal is evidence-only and cannot authorize, approve, publish, or execute
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] Existing 502 tests still pass
- [x] New observability tests are added (30 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (532 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 12

## Next Sprint (Planned)

**Sprint 12**: TBD — Awaiting review of Sprint 11 before proceeding.
