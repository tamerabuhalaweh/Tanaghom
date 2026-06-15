# approvals Module — Sprint 5

## Implemented

- `types.ts` — Approval decisions, risk categories, routing rules, SLA config, Zod schemas, response types
- `validators.ts` — Submit for approval, approval decision, check status validation
- `events.ts` — Approval event definitions (submitted, decision recorded, all collected, reminder, escalated, expired)
- `repository.ts` — Approval record CRUD, decision recording, pending approvals query
- `service.ts` — Approval routing, decision recording, status checking, SLA compliance, audit logging
- `controller.ts` — REST endpoints (POST /submit, POST /decide, GET /status, GET /pending, GET /sla)
- `tests/permissions.test.ts` — 24 RBAC tests
- `tests/routing.test.ts` — 10 routing rule tests
- `tests/routing-logic.test.ts` — 7 routing logic tests
- `tests/validators.test.ts` — 10 validation tests
- `tests/types.test.ts` — 12 type/constant tests
- `README.md` — Updated

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

## Key Behaviors

- **High-risk content cannot skip CCO approval** — CCO is always required for high-risk
- **Approval decisions require department match** — Approvers can only approve for their department
- **All approvals must be collected** — Content cannot be scheduled until all required approvals are in
- **No bypass for AI publishing** — Approval workflow is mandatory, no shortcuts
- **Audit trail** — Every decision logged with actor, timestamp, decision, comments
