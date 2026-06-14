# SPRINT-02: Campaign Request Workflow

> **Sprint**: 2
> **Status**: Complete (pending review)
> **Goal**: Campaign module with CRUD, state machine, permissions, audit logging, validation tests.

## Deliverables

| Deliverable | Status | Description |
|---|---|---|
| Prisma schema update | ✅ | ContentRequest: added `audience`, `owner_department_id` fields |
| modules/campaigns/types.ts | ✅ | Content state machine (15 states, strict transition table), campaign schemas, types |
| modules/campaigns/validators.ts | ✅ | Create/update campaign and transition validation |
| modules/campaigns/events.ts | ✅ | Campaign event definitions |
| modules/campaigns/repository.ts | ✅ | Campaign CRUD with Prisma, status update, filtering |
| modules/campaigns/service.ts | ✅ | Business logic with permissions, state machine, audit logging, events |
| modules/campaigns/controller.ts | ✅ | REST endpoints with JWT auth |
| modules/campaigns/tests/validators.test.ts | ✅ | 14 validation tests |
| modules/campaigns/tests/permissions.test.ts | ✅ | 22 RBAC tests |
| modules/campaigns/tests/state-machine.test.ts | ✅ | 30+ state transition tests |

## Campaign Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| topic | string | Yes | Campaign topic/title |
| objective | string | Yes | Campaign goal |
| audience | string | Yes | Target audience description |
| targetPlatforms | string[] | Yes | At least one platform |
| deadline | ISO 8601 | No | Campaign deadline |
| cta | string | No | Call to action |
| mediaRequirements | string | No | Media asset requirements |
| ownerDepartmentId | UUID | Yes | Department that owns this campaign |
| contentType | enum | Yes | campaign, announcement, thought_leadership, etc. |
| riskCategory | enum | Yes | low, medium, high |
| status | enum | Auto | Starts as "idea", follows state machine |

## State Machine Implemented

15 states with strict transition validation:

```
Idea → Drafting → Pending Review → Approved → Scheduled → Published → Analytics Pending → Analyzed → Archived
         ↑            ↓                ↓          ↓
         ← Needs Edits  Rejected       Cancelled  Failed → Retry
```

- All valid transitions defined in `TRANSITION_TABLE`
- `validateTransition()` throws `StateTransitionError` for invalid transitions
- Terminal states (rejected, archived) have no outgoing transitions

## Campaign Permissions

| Role | campaigns:read | campaigns:create | campaigns:update | campaigns:transition |
|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ✅ | ✅ |
| department_head | ✅ | ✅ | ✅ | ✅ |
| specialist | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ❌ |
| viewer | ✅ | ❌ | ❌ | ❌ |

## API Endpoints Added

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| GET | /campaigns | Bearer | Any | List campaigns (filterable by status, platform, requester) |
| GET | /campaigns/:id | Bearer | Any | Get campaign details |
| POST | /campaigns | Bearer | specialist+ | Create campaign request |
| PUT | /campaigns/:id | Bearer | specialist+ | Update campaign |
| POST | /campaigns/:id/transition | Bearer | admin/cco/dept_head | Change campaign status |

## Files Created/Modified

### New Files
- `modules/campaigns/types.ts`
- `modules/campaigns/validators.ts`
- `modules/campaigns/events.ts`
- `modules/campaigns/repository.ts`
- `modules/campaigns/service.ts`
- `modules/campaigns/controller.ts`
- `modules/campaigns/tests/validators.test.ts`
- `modules/campaigns/tests/permissions.test.ts`
- `modules/campaigns/tests/state-machine.test.ts`

### Modified Files
- `prisma/schema.prisma` — ContentRequest: added `audience`, `owner_department_id`
- `modules/campaigns/README.md` — Updated with Sprint 2 content
- `CONTEXT.md` — Updated to Sprint 2

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Authenticated users with correct permissions can create campaigns | ✅ |
| Viewer role cannot create or update campaigns | ✅ |
| Campaign includes all required fields | ✅ |
| Status follows documented state machine | ✅ |
| Invalid state transitions are blocked | ✅ |
| Department ownership is stored correctly | ✅ |
| Audit logs created for create/update/status changes | ✅ |
| Tests cover validation, permissions, and state transitions | ✅ |
| No AI, approval, publishing, analytics, learning, CRM, or production workflow | ✅ |
