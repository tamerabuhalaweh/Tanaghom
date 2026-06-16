# Sprint 11 — Observability Substrate & Audit/Learning Signals

> **Sprint**: 11
> **Status**: Complete
> **Date**: 2026-06-16
> **Goal**: Implement the Observability substrate foundation.

## Scope

ObservabilityEvent, AuditRecord, LearningSignal models, evidence trail queries, learning signal lifecycle. No external telemetry, Grafana, analytics, or automated learning behavior.

## Deliverables

### Prisma Models

| Model | Purpose |
|---|---|
| `ObservabilityEvent` | Canonical event emitted by the system |
| `AuditRecord` | Auditable action record |
| `LearningSignal` | Evidence that may inform future decisions |

### Enums

| Enum | Values |
|---|---|
| `EventSeverity` | info, warning, error, critical |
| `AuditResult` | success, failure, blocked, denied, deferred, escalated, cancelled |
| `LearningSignalType` | performance, quality, compliance, efficiency, risk, pattern |
| `LearningSignalStatus` | observed, under_review, accepted, rejected, superseded |

### Module Files

| File | Purpose |
|---|---|
| `types.ts` | Schemas, types, event categories, evidence trail query |
| `repository.ts` | Database operations for all observability entities |
| `service.ts` | Business logic with permissions and enforcement |
| `tests/observability.test.ts` | 30 tests |

### Event Categories

13 categories: identity, auth, campaign, ai_generation, algorithm_intelligence, saif_decision, dks, approval, capability_resolution, mcp_mediation, spine, security, system

### Evidence Trail

Queryable by:
- targetObjectType + targetObjectId
- humanUserId, agentRepId
- saifDecisionRecordId, approvalId, capabilityResolutionId
- mcpMediationRequestId
- runId, artifactId

### Learning Signal Lifecycle

```
observed → under_review → accepted
                       → rejected
                       → superseded
```

### Tests Added

| Test Category | Tests |
|---|---|
| Observability permissions | 9 tests |
| Event categories | 3 tests |
| Audit results | 3 tests |
| Learning signal types | 1 test |
| Learning signal statuses | 2 tests |
| LearningSignal authority blocking | 3 tests |
| Foreign object references | 3 tests |
| No secrets in records | 2 tests |
| Evidence trail queries | 3 tests |
| Event severities | 1 test |
| **Total** | **30 tests** |

## Test Results

```
Test Files: 29 passed (29)
Tests:      532 passed (532)
Duration:   2.51s
```

- Existing tests: 502 pass
- New tests: 30 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 532/532 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- External telemetry integrations
- Grafana integration
- Postiz analytics
- Analytics pulls
- CRM analytics
- ResourceSpace integration
- Paperclip integration
- Real MCP servers
- Real external APIs
- Publishing
- Scheduling
- M5 write-enabled runtime
- Automated learning-based behavior change

## Observability Architecture

```
ObservabilityEvent (evidence)
├── references: HumanUser, AgentRep (by ID)
├── references: SAIF Decision, Approval, Capability Resolution (by ID)
├── references: MCP Mediation Request (by ID)
└── references: SPINE Run, Artifact (by ID)

AuditRecord (auditable action)
├── preserves: who did what, through which AgentRep, to which object, with what result
├── references: all STITCH substrates by ID
└── no secrets, credentials, tokens

LearningSignal (evidence for future decisions)
├── not authority — cannot approve, publish, execute
├── references: events, audit records, runs, artifacts, SAIF decisions, DKS entries
└── lifecycle: observed → under_review → accepted/rejected/superseded
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Sprint complete | Sprint 11 |
