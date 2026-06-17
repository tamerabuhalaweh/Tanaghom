# Sprint 15 — Controlled Postiz Integration / M5-Gated Publishing

> **Sprint**: 15
> **Status**: Complete
> **Date**: 2026-06-16
> **Goal**: Introduce Postiz as a controlled publishing implementation behind STITCH governance.

## Scope

PostizConnector, PostizAccountReference, PublishingExecutionRequest, PostizPublishingJob models, MockPostizProvider, M5 gate, readiness validation. No real Postiz API, scheduling, publishing, or external calls.

## Deliverables

### Prisma Models

| Model | Purpose |
|---|---|
| `PostizConnector` | Postiz connector configuration placeholder |
| `PostizAccountReference` | Placeholder references for future social accounts |
| `PublishingExecutionRequest` | Request for future publishing execution |
| `PostizPublishingJob` | Future Postiz job placeholder |

### Enums

| Enum | Values |
|---|---|
| `PostizConnectorStatus` | active, inactive, planned, suspended |
| `AccountStatus` | active, inactive, disconnected, placeholder |
| `ExecutionRequestStatus` | pending, validating, ready, executing, completed, blocked, failed, cancelled |
| `ExecutionMode` | mock, simulated, live |
| `RequestedAction` | prepare_draft, prepare_schedule, publish |
| `PostizJobStatus` | pending, preparing, prepared, scheduled, published, failed, cancelled, blocked |

### Provider Interface

| File | Purpose |
|---|---|
| `shared/providers/postiz.ts` | PostizProvider interface (createDraft, prepareSchedule, publish) |
| `shared/providers/mock-postiz.ts` | MockPostizProvider (deterministic, no real calls) |

### Module Files

| File | Purpose |
|---|---|
| `types.ts` | Schemas, types for all Postiz integration entities |
| `repository.ts` | Database operations with readiness validation |
| `service.ts` | Business logic with M5 gate and MCP mediation |
| `tests/postiz-integration.test.ts` | 29 tests |

### M5 Gate

- Publishing action is M5
- Default M5 policy is blocked
- `publish` action must be blocked
- `prepare_draft` and `prepare_schedule` allowed as M4/simulated

### Readiness Validation

Before execution request, verifies:
- PublishingPackage exists and is ready
- Approval exists
- SAIF critical dimensions resolved
- CapabilityResolution exists
- MCP mediation request exists
- Connector is active

### Tests Added

| Test Category | Tests |
|---|---|
| Postiz permissions | 6 tests |
| M5 publish gate | 3 tests |
| Direct access blocked | 2 tests |
| Readiness validation | 5 tests |
| MockPostizProvider | 3 tests |
| No secrets | 2 tests |
| Session Context Lock | 3 tests |
| Payload hash determinism | 2 tests |
| Statuses/actions | 3 tests |
| **Total** | **29 tests** |

## Test Results

```
Test Files: 33 passed (33)
Tests:      673 passed (673)
Duration:   3.03s
```

- Existing tests: 644 pass
- New tests: 29 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 673/673 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- Real Postiz HTTP API calls
- Real scheduling
- Real publishing
- Social API calls
- Analytics pulls
- CRM/WhatsApp
- ResourceSpace live integration
- Paperclip live integration
- Rendering tools
- Real MCP servers
- Real external APIs
- Automatic publishing
- Storing secrets/tokens/API keys

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Sprint complete | Sprint 15 |
