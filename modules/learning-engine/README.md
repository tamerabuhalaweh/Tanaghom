# learning-engine Module

## Responsibility

Compares predicted Reach Readiness Score vs actual performance, identifies patterns, generates insights, and updates MEMORY.md with concise lessons.

## Allowed Actions

- Analyze analytics data for patterns
- Compare predicted vs actual performance
- Generate insight records with confidence levels
- Update MEMORY.md with concise recommendations
- Propose A/B test experiments

## Forbidden Actions

- Publishing content automatically
- Bypassing workflow rules
- Writing raw analytics data to MEMORY.md
- Making business decisions without human review

## Insight Types

| Type | Example |
|---|---|
| Content type | "Carousel posts outperform text on LinkedIn by 2.1x" |
| Hook | "Question hooks get 40% more comments" |
| CTA | "Direct CTA outperforms soft CTA for product posts" |
| Timing | "Tuesday 10am UTC performs best on LinkedIn" |
| Format | "Reels with text overlay outperform pure video" |
| Topic | "Wellness tips outperform product posts" |

## Insight Output Format

```
Platform: LinkedIn
Pattern: Educational carousel posts with clear first-slide problem statement outperform text-only
Evidence: 4 carousel posts averaged 2.1x engagement vs 30-day text-post median
Confidence: Medium (small sample size)
Action: Test two more carousel posts next week
```

## Events Emitted

- `learning.insight_generated` — when new insight created
- `learning.memory_updated` — when MEMORY.md updated

## Events Handled

- `analytics.ingested` — triggers pattern analysis

## Dependencies

- `analytics_snapshots` database table
- `MEMORY.md` — write concise lessons
- Vector store (future) — semantic search for patterns

## Testing Focus

- Pattern identification accuracy
- Confidence scoring
- MEMORY.md update format (concise, not raw data)
- Sample size handling (don't overclaim with small samples)
