# publishing Module

## Responsibility

Manages publishing jobs, scheduling state, retry logic, and publishing status tracking. Delegates to Postiz via postiz-integration module.

## Allowed Actions

- Create publishing jobs for approved content
- Schedule posts via Postiz (draft + schedule)
- Track publishing status (pending, scheduled, published, failed)
- Retry failed publishing with exponential backoff
- Record Postiz post IDs for analytics lookup

## Forbidden Actions

- Approving content
- Owning campaign business logic
- Bypassing approval workflow

## Retry Policy

| Attempt | Backoff | Action |
|---|---|---|
| 1 | 30 seconds | Re-queue job |
| 2 | 2 minutes | Re-queue job |
| 3 | 8 minutes | Re-queue job |
| 4+ | — | Alert and mark as failed |

## Events Emitted

- `publishing.scheduled` — when Postiz confirms schedule
- `publishing.published` — when platform confirms publication
- `publishing.failed` — when all retries exhausted
- `publishing.cancelled` — when schedule cancelled

## Events Handled

- `content.approved` — from approvals, triggers scheduling

## Dependencies

- `PostizProvider` — draft creation, scheduling (mock during development)
- `shared/queue` — BullMQ for retry jobs

## Testing Focus

- Scheduling flow (approved → Postiz draft → schedule)
- Retry logic (exponential backoff, max retries)
- Postiz API error handling
- Status tracking
