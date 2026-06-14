# algorithm-intelligence Module

## Responsibility

Calculates Reach Readiness Scores, maintains Platform Rules Knowledge Base, provides optimization suggestions, and learns from performance data.

## Allowed Actions

- Calculate Reach Readiness Score (0–100) for drafts
- Maintain platform rules with source, confidence, review dates
- Suggest content optimizations while preserving brand voice
- Detect platform rule changes and flag for review
- Learn from analytics to improve scoring model

## Forbidden Actions

- Guaranteeing reach or performance
- Using black-hat or spam tactics
- Approving or publishing content
- Overriding compliance rules for reach

## Reach Readiness Score Components

| Component | Weight | Description |
|---|---|---|
| Platform-native format | 15% | Correct format for platform |
| Hook strength | 15% | First-line engagement quality |
| Audience relevance | 10% | Match to target audience |
| Originality | 10% | Not duplicated content |
| Visual/video fit | 10% | Media optimization |
| Optimal timing | 5% | Best posting time |
| Engagement prompt | 10% | CTA quality |
| Hashtag hygiene | 5% | Relevant, not stuffed |
| Compliance risk | 10% | Low risk = higher score |
| Historical fit | 10% | Match to proven patterns |

## Scoring Bands

- 90–100: Ready to approve
- 75–89: Good, optimization recommended
- 60–74: Requires revision before approval
- Below 60: Do not schedule unless manually overridden

## Events Emitted

- `reach.scored` — when score is calculated
- `rules.updated` — when platform rules are modified
- `rules.change_detected` — when platform guidance changes

## Dependencies

- `AnalyticsProvider` — historical performance data
- `platform_rules` database table
- `analytics_snapshots` database table

## Testing Focus

- Score calculation accuracy
- Stale rule detection and blocking
- Black-hat tactic rejection
- Scoring component weights
