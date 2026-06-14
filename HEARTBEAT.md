# HEARTBEAT.md — Scheduled Proactive Tasks

> **Purpose**: Define recurring automated tasks for the agent runtime.
> **Rule**: If nothing requires attention, reply `HEARTBEAT_OK`.

## Daily (Every Morning)

- [ ] Check posts scheduled for the next 24 hours.
- [ ] Alert if no content is queued for any MVP platform.
- [ ] Check pending approvals older than SLA (configurable, default 24h).
- [ ] Check platform rules due for review.
- [ ] Verify Postiz and database connectivity.

## Every 48 Hours

- [ ] Pull analytics for posts published 48 hours ago.
- [ ] Store normalized metrics in `analytics_snapshots` table.
- [ ] Write only concise, evidence-backed lessons to `MEMORY.md`.
- [ ] Flag posts with unusually low engagement for review.

## Weekly (Every Monday)

- [ ] Generate performance report (published posts, metrics vs baseline, insights, risks).
- [ ] Propose next week's content plan based on performance patterns and campaign priorities.
- [ ] Send report and plan to stakeholders via messaging channel for approval.
- [ ] Pull platform-level analytics (followers, impressions, engagement trends).
- [ ] Review platform rules freshness — flag any rule older than review SLA.
- [ ] Generate cost report (LLM tokens, API calls, per-post cost).

## Monthly

- [ ] Review `PLATFORM_RULES.md` freshness — update stale rules.
- [ ] Review `SOUL.md` — confirm brand voice is current.
- [ ] Review security policies and access permissions.
- [ ] Generate monthly KPI dashboard.
- [ ] Review and archive old `MEMORY.md` entries with low confidence or small sample size.

## Health Checks

- [ ] Postiz API reachable
- [ ] Database reachable
- [ ] Redis/BullMQ queue processing
- [ ] LLM provider responsive
- [ ] Messaging channel connected
- [ ] Backup verification (weekly)

## Escalation

If any health check fails:
1. Log the failure with timestamp and error details
2. Alert the Security/Admin Owner via messaging channel
3. If critical (publishing failure, security breach), trigger kill switch per `SECURITY_POLICY.md`

## Configuration

| Parameter | Default | Description |
|---|---|---|
| `HEARTBEAT_DAILY_HOUR` | 09:00 UTC | When daily checks run |
| `HEARTBEAT_48H_WINDOW` | 48 hours | Analytics pull delay after publishing |
| `HEARTBEAT_WEEKLY_DAY` | Monday | Day for weekly report |
| `HEARTBEAT_MONTHLY_DAY` | 1st | Day for monthly review |
| `APPROVAL_SLA_HOURS` | 24 | Hours before approval reminder |
| `RULE_STALENESS_DAYS` | 30 | Days before platform rule is flagged stale |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
