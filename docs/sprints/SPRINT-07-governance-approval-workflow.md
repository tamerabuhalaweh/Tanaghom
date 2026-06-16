# Sprint 7 — Governance / Approval Workflow

> **Sprint**: 7
> **Status**: Complete
> **Date**: 2026-06-16
> **Goal**: Implement the governed approval workflow on top of HumanUser, AgentRep, SAIF Decision Records, DKS, identity lineage, and RevOps department routing.

## Scope

Approval model, approval statuses, approval actions, risk-based routing, SAIF integration, Session Context Lock enforcement, audit logging, state transition integration. No publishing, scheduling, analytics, or external integrations.

## Deliverables

### Prisma Model

| Model | Purpose |
|---|---|
| `Approval` | Core approval entity with full lineage, routing, and SAIF integration |

### Enums

| Enum | Values |
|---|---|
| `ApprovalTargetType` | campaign, content_item, draft_version, saif_decision_record |
| `ApprovalStatus` | pending, approved, rejected, changes_requested, escalated, expired, cancelled |
| `ApprovalType` | department_review, brand_review, compliance_review, cco_review, demand_generation_review, conversion_review, customer_growth_review, revenue_operations_review |

### Module Files

| File | Purpose |
|---|---|
| `types.ts` | Schemas, types, routing rules, state transitions |
| `repository.ts` | Database operations for approvals |
| `service.ts` | Business logic with Session Context Lock and audit logging |
| `tests/approval.test.ts` | 45 tests covering all acceptance criteria |

### Key Functions

| Function | Purpose |
|---|---|
| `submitForApproval()` | Create approval request with routing |
| `approve()` | Approve with Session Context Lock and SAIF validation |
| `reject()` | Reject with required comment |
| `requestChanges()` | Request changes with required comment |
| `escalate()` | Escalate approval |
| `cancel()` | Cancel approval |

### Risk-Based Routing Rules

| Risk | Target | Approval Type | Required Role |
|---|---|---|---|
| Low | campaign | department_review | reviewer |
| Medium | campaign | department_review | department_head |
| High | campaign | cco_review | cco |
| Low | content_item | department_review | reviewer |
| Medium | content_item | brand_review | Brand & Market Intelligence |
| High | content_item | cco_review | cco |

### SAIF Integration

- Approval references SAIF Decision Record when linked
- Approval cannot proceed if SAIF critical dimensions (security_posture, human_oversight, compliance) are unresolved
- Negative critical dimensions require explicit mitigation

### Session Context Lock Enforcement

- Approver action must include HumanUser + AgentRep lineage
- User cannot approve through another user's AgentRep
- FunctionalAgent cannot approve
- GovernanceAgent can assist but cannot replace human authority

### Audit Logging

Every approval action logs:
- humanUserId, agentRepId, actingAgentType, actingAgentId
- action, targetObjectType, targetObjectId, timestamp, result
- approvalId, saifDecisionRecordId (if present)

### Tests Added

| Test Category | Tests |
|---|---|
| Approval permissions | 11 tests |
| State transitions | 11 tests |
| Risk-based routing | 5 tests |
| RevOps department routing | 5 tests |
| Session Context Lock | 3 tests |
| FunctionalAgent blocking | 3 tests |
| SAIF critical dimension blocking | 3 tests |
| Approval types | 2 tests |
| Target types | 2 tests |
| **Total** | **45 tests** |

## Test Results

```
Test Files: 25 passed (25)
Tests:      382 passed (382)
Duration:   2.19s
```

- Existing tests: 337 pass
- New tests: 45 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 382/382 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- Postiz publishing
- Scheduling
- Analytics pulls
- Learning engine
- CRM/WhatsApp
- Paperclip integration
- ResourceSpace integration
- Real MCP servers
- Real external APIs
- M5 write-enabled runtime
- Automatic publishing after approval

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Sprint complete | Sprint 7 |
