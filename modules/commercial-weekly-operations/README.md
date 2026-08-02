# Commercial Weekly Operations

This module adds an optional weekly operating layer below a commercial execution plan:

`Annual strategy -> Monthly initiative -> Execution plan -> Weekly work`

It does not create an independent planner and it never executes work in an external provider.

## API

All endpoints require a Tanaghum bearer token and enforce tenant isolation.

### Read a week

`GET /commercial-plans/:commercialPlanId/weeks?weekOf=YYYY-MM-DD`

Returns the execution-plan context, tenant timezone, normalized Monday-to-Sunday period, plan-wide remaining budget, selected-week rollup, eligible owners, linked evidence choices, and work items.

### Create work

`POST /commercial-plans/:commercialPlanId/weeks/items`

Required fields are `weekStartDate`, `title`, and `businessOutcome`. The week must start on Monday. Start and due dates must be inside that week. Managers may optionally assign an owner, priority, budget guardrail, and a plan-owned evidence link.

### Update work

`PUT /commercial-plans/:commercialPlanId/weeks/items/:itemId`

Requires `expectedRevision`. Managers may update any editable item. Contributors may update only work assigned to their user account. Submitted, completed, and cancelled work must leave that state before its details can be edited.

### Change status

`POST /commercial-plans/:commercialPlanId/weeks/items/:itemId/transition`

Requires `expectedRevision` and `targetStatus`. Blocking requires `blockerReason`; completion requires `completionEvidence`. Only the CCO may approve submitted work, and the creator cannot approve their own item.

## Guardrails

- Every read and write is scoped by `tenant_key` and `commercial_plan_id`.
- Owners must be active users in the same tenant.
- Linked records must belong to the same tenant and execution plan.
- Active weekly budget guardrails cannot exceed the execution-plan budget target.
- Stale revisions return a conflict instead of overwriting newer work.
- Persistent `AuditRecord` entries capture creation, edit, approval, status, and completion evidence.
- Stitchi uses the same service and policy layer after a human approves its action card.
- GHL, Postiz, WhatsApp, voice, and other external providers are never called by this module.

## Roles

| Capability | Roles |
| --- | --- |
| Read | Commercial product roles |
| Create/manage | Admin, CCO, department head, marketing manager |
| Update assigned work | Social media manager, sales manager, lead qualification manager, specialist |
| Approve submitted work | CCO only; no self-approval |

