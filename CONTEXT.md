# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 16 — Analytics / Social MCP & Reporting Foundation
**Status**: Complete
**Goal**: Implement the Analytics / Social MCP and Reporting foundation in read-only/mock mode.

## Active Module

- `modules/analytics-reporting/` — Analytics types, repository, service, tests
- `shared/providers/` — AnalyticsProvider interface and MockAnalyticsProvider
- `prisma/schema.prisma` — Analytics models
- `prisma/migrations/` — Analytics migration

## Sprint Acceptance Criteria

- [x] AnalyticsSource model exists
- [x] AnalyticsIngestionRequest model exists
- [x] AnalyticsSnapshot model exists
- [x] PlatformMetricMapping model exists
- [x] ReportingPeriod model exists
- [x] CampaignPerformanceReport model exists
- [x] MockAnalyticsProvider exists and is deterministic
- [x] Missing MCP mediation blocks analytics ingestion where required
- [x] Only read-only M4/mock analytics behavior is allowed
- [x] No external systems are called
- [x] Analytics reports are advisory only
- [x] LearningSignal candidates are evidence only
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] Existing 673 tests still pass
- [x] New analytics/reporting tests are added (30 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (703 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 17

## Next Sprint (Planned)

**Sprint 17**: TBD — Awaiting review of Sprint 16 before proceeding.
