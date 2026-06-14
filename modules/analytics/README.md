# analytics Module

## Responsibility

Pulls post-level and platform-level analytics from Postiz, normalizes metrics, stores in database, and generates weekly reports.

## Allowed Actions

- Pull post analytics 48h and 7 days after publication
- Pull platform analytics weekly
- Normalize and store metrics in analytics_snapshots table
- Generate weekly performance report
- Generate next-week content plan proposal

## Forbidden Actions

- Rewriting published content
- Approving content
- Making business decisions (only recommendations)

## Analytics Jobs (BullMQ)

| Job | Schedule | Purpose |
|---|---|---|
| `analytics.pull-48h` | Every hour, checks posts 48h old | Pull 48h analytics |
| `analytics.pull-7d` | Every hour, checks posts 7d old | Pull 7d analytics |
| `analytics.platform-weekly` | Weekly (Monday) | Pull platform-level metrics |
| `analytics.weekly-report` | Weekly (Monday) | Generate and send weekly report |

## Weekly Report Sections

1. Summary (top-line performance, wins, issues)
2. Published Posts (by platform, date, status)
3. Performance (metrics vs baseline)
4. Insights (evidence-backed patterns with confidence)
5. Next Experiments (2-4 recommended tests)
6. Next Week Plan (proposed calendar, requires approval)
7. Risks/Needs (missing assets, stale rules)

## Events Emitted

- `analytics.ingested` — when metrics stored
- `analytics.report_generated` — when weekly report ready

## Events Handled

- `publishing.published` — triggers analytics pull scheduling

## Dependencies

- `AnalyticsProvider` — platform analytics data (mock during development)
- `PostizProvider` — post analytics
- `MessagingProvider` — send weekly report to stakeholders
- `shared/queue` — BullMQ for scheduled jobs

## Testing Focus

- Analytics pull and normalization
- Report generation
- Metric calculations (engagement rate, baseline comparison)
- Job scheduling and retry
