# approvals Module

## Responsibility

Routes content to approvers based on risk category and department. Manages approval workflow, SLA enforcement, reminders, and escalation.

## Allowed Actions

- Route drafts to correct approvers
- Record approval decisions (approve, reject, edit, request changes)
- Enforce SLA with reminders and escalation
- Track approval audit trail

## Forbidden Actions

- Calling external social platforms directly
- Generating content
- Bypassing approval requirements
- Scheduling posts

## Approval Routing

| Risk Level | Required Approvers |
|---|---|
| Low | 1: Content Reviewer (relevant department) |
| Medium | 2: Department Head + Brand & Positioning |
| High | 3: CCO + Brand & Positioning + Compliance |

## Approval Actions

| Action | Effect |
|---|---|
| Approve | Move to next step or mark all-collected |
| Reject | Move to Rejected, require reason |
| Edit | Modify draft, create new version, reset approvals |
| Request Changes | Move to Needs Edits, return to Content Writer |
| Expire (system) | After SLA, alert and escalate |

## SLA Escalation

- 24h: Reminder to approver
- 48h: Escalate to department head
- 72h: Escalate to CCO
- Deadline < 24h: Priority alert to all pending approvers

## Events Emitted

- `approval.requested` — when routed to approver
- `approval.completed` — when decision recorded
- `approval.all_collected` — when all approvals received
- `approval.expired` — when SLA exceeded
- `approval.reminder_sent` — when reminder triggered

## Events Handled

- `draft.submitted_for_review` — from campaigns, triggers routing

## Dependencies

- `MessagingProvider` — send approval notifications
- `shared/queue` — BullMQ for reminders and SLA jobs

## Testing Focus

- Routing logic by risk category
- Permission enforcement (only assigned approvers)
- SLA timer and escalation
- All approval actions
- State machine transitions
