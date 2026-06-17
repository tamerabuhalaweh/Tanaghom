# Sprint 18 — CRM / WhatsApp Conversion Layer

> **Sprint**: 18
> **Status**: Complete
> **Date**: 2026-06-17
> **Goal**: Implement controlled CRM / WhatsApp conversion foundation.

## Scope

LeadCaptureRecord, LeadSourceAttribution, ConversionIntent, CrmHandoffRequest, WhatsAppHandoffRequest, ConversionSequencePlan models, MockCrmProvider, MockMessagingProvider. No real CRM/WhatsApp calls, no real messages, no external APIs.

## Deliverables

### Prisma Models

| Model | Purpose |
|---|---|
| `LeadCaptureRecord` | Lead captured from campaign/content activity |
| `LeadSourceAttribution` | Lead attribution tracking |
| `ConversionIntent` | What the lead is interested in |
| `CrmHandoffRequest` | Future CRM handoff placeholder |
| `WhatsAppHandoffRequest` | Future WhatsApp/messaging handoff placeholder |
| `ConversionSequencePlan` | Proposed follow-up sequence |

### Enums

| Enum | Values |
|---|---|
| `LeadStatus` | new_lead, contacted, qualified, nurturing, converted, lost, archived |
| `ConsentStatus` | pending, granted, denied, withdrawn |
| `PlanStatus` | draft, proposed, approved, rejected, executing, completed, cancelled |

### Provider Interfaces

| File | Purpose |
|---|---|
| `shared/providers/crm.ts` | CrmProvider interface |
| `shared/providers/mock-crm.ts` | MockCrmProvider (deterministic) |
| `shared/providers/messaging.ts` | MessagingProvider interface |
| `shared/providers/mock-messaging.ts` | MockMessagingProvider (deterministic) |

### Module Files

| File | Purpose |
|---|---|
| `types.ts` | Schemas, types for all conversion entities |
| `repository.ts` | Database operations with MCP mediation validation |
| `service.ts` | Business logic with Session Context Lock |
| `tests/crm-conversion.test.ts` | 27 tests |

### Tests Added

| Test Category | Tests |
|---|---|
| Conversion permissions | 9 tests |
| MCP mediation required | 3 tests |
| MockCrmProvider | 3 tests |
| MockMessagingProvider | 3 tests |
| Lead statuses | 1 test |
| Consent statuses | 1 test |
| Session Context Lock | 2 tests |
| No secrets | 2 tests |
| Plan statuses | 1 test |
| FunctionalAgent blocking | 2 tests |
| **Total** | **27 tests** |

## Test Results

```
Test Files: 36 passed (36)
Tests:      766 passed (766)
Duration:   4.71s
```

- Existing tests: 739 pass
- New tests: 27 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 766/766 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- Real CRM API calls
- Real WhatsApp API calls
- Real customer messaging
- Real lead creation in external systems
- Live automation sequences
- Analytics pulls
- Postiz publishing
- Scheduling
- ResourceSpace live integration
- Paperclip live integration
- Rendering tools
- Real MCP servers
- Real external APIs
- M5 write-enabled runtime

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-17 | Sprint complete | Sprint 18 |
