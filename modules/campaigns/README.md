# campaigns Module — Sprint 2

## Implemented

- `types.ts` — Content state machine (15 states, strict transition table), campaign types, Zod schemas, validation functions
- `validators.ts` — Create/update campaign and transition input validation
- `events.ts` — Campaign event definitions (created, updated, status_changed)
- `repository.ts` — Campaign CRUD with Prisma, status update, filtering by status/platform
- `service.ts` — Business logic with permission checks, state machine enforcement, audit logging, event emission
- `controller.ts` — REST endpoints with JWT auth (list, get, create, update, transition)
- `tests/validators.test.ts` — 14 tests for input validation
- `tests/permissions.test.ts` — 22 tests for RBAC (6 roles × 4 permissions)
- `tests/state-machine.test.ts` — 30+ tests for state transitions (valid, invalid, terminal states)

## Campaign Permissions

| Role | campaigns:read | campaigns:create | campaigns:update | campaigns:transition |
|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ✅ | ✅ |
| department_head | ✅ | ✅ | ✅ | ✅ |
| specialist | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ❌ |
| viewer | ✅ | ❌ | ❌ | ❌ |

## API Endpoints

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| GET | /campaigns | Bearer | Any | List campaigns (filterable) |
| GET | /campaigns/:id | Bearer | Any | Get campaign details |
| POST | /campaigns | Bearer | specialist+ | Create campaign request |
| PUT | /campaigns/:id | Bearer | specialist+ | Update campaign |
| POST | /campaigns/:id/transition | Bearer | admin/cco/dept_head | Change campaign status |

## State Machine

```
Idea → Drafting → Pending Review → Approved → Scheduled → Published → Analytics Pending → Analyzed → Archived
         ↑            ↓                ↓          ↓
         ← Needs Edits  Rejected       Cancelled  Failed → Retry
```

15 states, strict transition table. Invalid transitions throw `StateTransitionError`.

## Test Coverage

- Validators: 14 tests (valid input, missing fields, invalid enums, edge cases)
- Permissions: 22 tests (6 roles × 4 permissions, proving viewer/reviewer cannot create/update/transition)
- State Machine: 30+ tests (all valid transitions, all invalid transitions blocked, terminal states, error details)
