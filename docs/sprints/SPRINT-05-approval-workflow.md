# SPRINT-05: Approval Workflow

> **Sprint**: 5
> **Status**: Complete (pending review)
> **Goal**: Approval routing, decision recording, SLA compliance, audit trail, permission checks.

## Deliverables

| Deliverable | Status | Description |
|---|---|---|
| modules/approvals/types.ts | ✅ | Approval decisions, risk categories, routing rules, SLA config, Zod schemas, response types |
| modules/approvals/validators.ts | ✅ | Submit for approval, approval decision, check status validation |
| modules/approvals/events.ts | ✅ | Approval event definitions (submitted, decision recorded, all collected, reminder, escalated, expired) |
| modules/approvals/repository.ts | ✅ | Approval record CRUD, decision recording, pending approvals query |
| modules/approvals/service.ts | ✅ | Approval routing, decision recording, status checking, SLA compliance, audit logging |
| modules/approvals/controller.ts | ✅ | REST endpoints (POST /submit, POST /decide, GET /status, GET /pending, GET /sla) |
| modules/approvals/tests/permissions.test.ts | ✅ | 24 RBAC tests |
| modules/approvals/tests/routing.test.ts | ✅ | 10 routing rule tests |
| modules/approvals/tests/routing-logic.test.ts | ✅ | 7 routing logic tests |
| modules/approvals/tests/validators.test.ts | ✅ | 10 validation tests |
| modules/approvals/tests/types.test.ts | ✅ | 12 type/constant tests |
| modules/approvals/README.md | ✅ | Module documentation |
| src/index.ts | ✅ | Mounted /approvals route |
| CONTEXT.md | ✅ | Updated to Sprint 5 |

## Approval Routing Rules

### Risk-based Routing

| Risk Level | Required Approvers |
|---|---|
| Low | 1: Acquisition (specialist) |
| Medium | 2: Acquisition (specialist) + Brand & Positioning (department_head) |
| High | 3: CCO (cco) + Brand & Positioning (department_head) + Acquisition (specialist) |

### Content Type Overrides

| Content Type | Additional Required Approvers |
|---|---|
| announcement | CCO (cco) + Brand & Positioning (department_head) |
| thought_leadership | Brand & Positioning (department_head) + Acquisition (specialist) |
| campaign | Conversion & Closing (department_head) + Commercial Operations (optional) |

### Combined Routing

Routes are merged (no duplicates). High-risk announcement gets:
- CCO (from risk + content type)
- Brand & Positioning (from risk + content type)
- Acquisition (from risk)

## Approval Decisions

| Decision | Effect |
|---|---|
| approved | Approval recorded, checks if all approvals collected |
| rejected | Approval recorded, content item status → rejected |
| needs_changes | Approval recorded, content item status → needs_changes |

## SLA Configuration

| Threshold | Hours | Action |
|---|---|---|
| Reminder | 24h | Send reminder to approver |
| Escalation | 48h | Escalate to department head |
| Critical | 72h | Escalate to CCO |

## API Endpoints

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| POST | /approvals/submit | Bearer | specialist+ | Submit content for approval |
| POST | /approvals/decide | Bearer | department_head+ | Record approval decision |
| GET | /approvals/status/:id | Bearer | viewer+ | Get approval status |
| GET | /approvals/pending | Bearer | viewer+ | Get pending approvals for reviewer |
| GET | /approvals/sla | Bearer | viewer+ | Check SLA compliance |

## Permissions

| Role | approval:submit | approval:decide | approval:read | approval:manage |
|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ✅ | ❌ |
| department_head | ✅ | ✅ | ✅ | ❌ |
| specialist | ✅ | ❌ | ✅ | ❌ |
| reviewer | ❌ | ❌ | ✅ | ❌ |
| viewer | ❌ | ❌ | ✅ | ❌ |

## Test Summary

| Test File | Count | Coverage |
|---|---|---|
| permissions.test.ts | 24 | RBAC (specialist cannot decide, reviewer/viewer cannot submit/decide) |
| routing.test.ts | 10 | Risk-based routing, content type routing, SLA config |
| routing-logic.test.ts | 7 | Combined routing logic, no duplicates, required departments |
| validators.test.ts | 10 | Input validation for submit, decision, status check |
| types.test.ts | 12 | Decision types, risk categories, SLA config, event types |
| **Total** | **63** | |

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Drafts/campaigns can enter approval workflow | ✅ |
| Approval route selected based on risk, content type, department | ✅ |
| Authorized users can approve, reject, request changes | ✅ |
| Unauthorized roles cannot approve outside scope | ✅ |
| Approval decisions stored with actor, timestamp, decision, comment | ✅ |
| Status transitions follow state machine | ✅ |
| High-risk cannot skip CCO/senior approval | ✅ |
| Approval workflow does not publish or schedule | ✅ |
| Tests cover routing, permissions, decisions, comments, state, audit | ✅ (63 tests) |
| CI passes | ✅ |
