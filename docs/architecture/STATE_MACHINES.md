# STATE_MACHINES.md — Campaign & Approval State Transitions

> **Version**: 1.0
> **Date**: 2026-06-14
> **Update Rule**: Only by approved architecture decision

## Core Rule

Campaign and approval statuses are **strict state machines**. No module may bypass state transitions. All transitions must:

1. Validate that the source state allows the target transition
2. Log the transition with actor, timestamp, from-state, and to-state
3. Emit a domain event for downstream modules
4. Reject invalid transitions with a clear error message

## Content Item State Machine

### States

```
Idea → Drafting → Pending Review → Approved → Scheduled → Published → Analytics Pending → Analyzed → Archived
```

### Full Transition Table

| From State | To State | Trigger | Allowed By | Conditions |
|---|---|---|---|---|
| Idea | Drafting | Agent starts generation | System/Agent | Request has required fields |
| Idea | Rejected | Request rejected | Marketing Owner | — |
| Drafting | Pending Review | Drafts generated | System/Agent | All platform drafts created |
| Drafting | Failed | Generation error | System | — |
| Pending Review | Approved | All approvals collected | System | All required approvers approved |
| Pending Review | Needs Edits | Reviewer requests changes | Reviewer | — |
| Pending Review | Rejected | Reviewer rejects | Reviewer | — |
| Pending Review | Expired | SLA exceeded | System | Approval SLA hours exceeded |
| Needs Edits | Drafting | Agent regenerates | System/Agent | — |
| Needs Edits | Rejected | Request abandoned | Marketing Owner | — |
| Approved | Scheduled | Postiz schedules post | System | Approved + Postiz API success |
| Approved | Archived | Content archived | Marketing Owner | — |
| Scheduled | Published | Platform publishes | System | Postiz confirms publication |
| Scheduled | Failed | Publishing error | System | Postiz API failure after retries |
| Scheduled | Cancelled | Schedule cancelled | Marketing Owner | — |
| Published | Analytics Pending | Analytics window starts | System | — |
| Analytics Pending | Analyzed | Analytics ingested | System | 48h + 7d data collected |
| Failed | Scheduled | Retry | System | Retry count < max |
| Failed | Cancelled | Abandoned | Marketing Owner | — |
| Analyzed | Archived | Content archived | System/Agent | — |
| Analyzed | Recycle Candidate | High performance | Learning Engine | Engagement above threshold |
| Recycle Candidate | Idea | Reuse approved | Marketing Owner | — |
| Recycle Candidate | Archived | Reuse declined | Marketing Owner | — |

### State Diagram

```
                    ┌──────────┐
                    │   Idea   │
                    └────┬─────┘
                         │ start generation
                         ▼
                    ┌──────────┐
               ┌────│ Drafting │────┐
               │    └────┬─────┘    │
               │         │ drafts ready
          failed         ▼
               │    ┌──────────────┐
               │    │Pending Review│
               │    └──┬───┬───┬───┘
               │       │   │   │
               │  approve│ reject│ needs edits
               │       ▼   │   ▼
               │  ┌────────┐  ┌───────────┐
               │  │Approved│  │Needs Edits│──┐
               │  └───┬────┘  └───────────┘  │
               │      │              ▲       │
               │      │ schedule     └───────┘
               │      ▼              regen
               │  ┌──────────┐
               │  │Scheduled │
               │  └──┬───┬───┘
               │     │   │
               │  publish  cancel/fail
               │     ▼   ▼
               │  ┌─────────┐  ┌───────────┐
               │  │Published│  │ Cancelled │
               │  └────┬────┘  └───────────┘
               │       │
               │       ▼
               │  ┌──────────────────┐
               │  │Analytics Pending │
               │  └────────┬─────────┘
               │           │ data collected
               │           ▼
               │  ┌───────────┐
               │  │ Analyzed  │
               │  └───┬───┬───┘
               │      │   │
               │  archive  high performance
               │      ▼   ▼
               │  ┌──────┐  ┌──────────────────┐
               │  │Archived│  │Recycle Candidate │
               │  └──────┘  └────────┬─────────┘
               │                     │ reuse
               │                     ▼
               │                ┌──────┐
               └────────────────│ Idea │
                                └──────┘
```

### Implementation Rules

```typescript
// Every transition must go through a validation function
function validateTransition(
  currentState: ContentState,
  targetState: ContentState,
  actor: string
): TransitionResult {
  const allowed = TRANSITION_TABLE[currentState]?.includes(targetState);
  if (!allowed) {
    return { 
      success: false, 
      error: `Invalid transition: ${currentState} → ${targetState}` 
    };
  }
  return { success: true };
}

// Transition table (source → allowed targets)
const TRANSITION_TABLE: Record<ContentState, ContentState[]> = {
  'idea': ['drafting', 'rejected'],
  'drafting': ['pending_review', 'failed'],
  'pending_review': ['approved', 'needs_edits', 'rejected', 'expired'],
  'needs_edits': ['drafting', 'rejected'],
  'approved': ['scheduled', 'archived'],
  'scheduled': ['published', 'failed', 'cancelled'],
  'published': ['analytics_pending'],
  'analytics_pending': ['analyzed'],
  'analyzed': ['archived', 'recycle_candidate'],
  'recycle_candidate': ['idea', 'archived'],
  'failed': ['scheduled', 'cancelled'],
  'expired': ['drafting', 'rejected'],
  'rejected': [],
  'cancelled': ['archived'],
  'archived': [],
};
```

## Approval State Machine

### States

```
Pending → Approved
Pending → Rejected
Pending → Needs Changes → Pending (cycle)
Pending → Expired
```

### Transition Table

| From State | To State | Trigger | Conditions |
|---|---|---|---|
| Pending | Approved | Approver approves | — |
| Pending | Rejected | Approver rejects | Requires reason |
| Pending | Needs Changes | Approver requests changes | Requires comments |
| Pending | Expired | SLA exceeded | Configurable SLA hours |
| Needs Changes | Pending | Revised draft submitted | New version created |

### Per-Item Approval Workflow

```
Content item submitted for review
    ↓
Create approval_records for each required approver (based on risk category)
    ↓
Each record starts in state: Pending
    ↓
Approvers act independently (approve/reject/needs_changes)
    ↓
When ALL required approvals are in state: Approved → Content item → Approved
When ANY approval is Rejected → Content item → Rejected
When ANY approval is Needs Changes → Content item → Needs Edits
When ANY approval is Expired → Content item → Expired
```

## Queue Job States (BullMQ)

### Analytics Pull Job

```
waiting → active → completed
waiting → active → failed → waiting (retry)
```

### Retry Policy

| Job Type | Max Retries | Backoff | Strategy |
|---|---|---|---|
| Post publishing | 3 | Exponential (30s, 2m, 8m) | Re-queue on failure |
| Analytics pull | 3 | Exponential (1m, 5m, 15m) | Re-queue on failure |
| Weekly report | 1 | Fixed (5m) | Alert on failure |
| Approval reminder | 1 | — | No retry, alert if fails |
| Heartbeat | 1 | — | Log failure, alert if critical |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
