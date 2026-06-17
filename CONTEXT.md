# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 18 — CRM / WhatsApp Conversion Layer
**Status**: Complete
**Goal**: Implement controlled CRM / WhatsApp conversion foundation. Mock/provider-based, MCP-mediated, non-executing.

## Active Module

- `modules/crm-conversion/` — CRM conversion types, repository, service, tests
- `shared/providers/` — CrmProvider, MessagingProvider interfaces and mocks
- `prisma/schema.prisma` — Conversion models
- `prisma/migrations/` — Conversion migration

## Sprint Acceptance Criteria

- [x] LeadCaptureRecord model exists
- [x] LeadSourceAttribution model exists
- [x] ConversionIntent model exists
- [x] CrmHandoffRequest model exists
- [x] WhatsAppHandoffRequest model exists
- [x] ConversionSequencePlan model exists
- [x] MockCrmProvider exists and is deterministic
- [x] MockMessagingProvider exists and is deterministic
- [x] CRM/WhatsApp handoff requires MCP mediation
- [x] Direct CRM/WhatsApp access is blocked
- [x] M5 write-enabled handoff is blocked by default
- [x] No real customer messages are sent
- [x] No real CRM writes occur
- [x] No external systems are called
- [x] No secrets, tokens, API keys, credentials, or sensitive raw payloads stored
- [x] HumanUser and AgentRep lineage are included
- [x] Existing 739 tests still pass
- [x] New CRM/WhatsApp conversion tests are added (27 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (766 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 19

## Next Sprint (Planned)

**Sprint 19**: TBD — Awaiting review of Sprint 18 before proceeding.
