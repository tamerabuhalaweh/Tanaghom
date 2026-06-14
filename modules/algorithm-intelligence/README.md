# algorithm-intelligence Module — Sprint 4

## Implemented

- `types.ts` — Scoring components (9), scoring bands, rule freshness, spam tactics, Zod schemas, response types
- `validators.ts` — Score draft and add rule validation
- `events.ts` — Algorithm event definitions (draft_scored, rule_added, stale_rule_detected, spam_tactic_detected)
- `scoring-engine.ts` — Core scoring logic with 9 weighted components, stale rule detection, spam detection, optimization suggestions
- `repository.ts` — Platform rule CRUD, stale rule queries
- `service.ts` — Business logic with permissions, audit logging, event emission
- `controller.ts` — REST endpoints (POST /score, GET/POST /rules, POST /rules/:id/review, GET /rules/stale)
- `tests/scoring-engine.test.ts` — 14 tests for scoring, hook, format, hashtags, platform fit
- `tests/spam-detection.test.ts` — 16 tests for spam tactics, stale rules, compliance guardrails, optimization suggestions
- `tests/permissions.test.ts` — 18 RBAC tests (viewer cannot score, only admin can manage rules)
- `tests/validators.test.ts` — 10 validation tests
- `tests/edge-cases.test.ts` — 12 edge case tests (empty input, all platforms, component bounds, weighted sum)
- `README.md` — Updated

## Scoring Components (9 weighted factors)

| Component | Weight | What It Measures |
|---|---|---|
| hookStrength | 15% | Opening hook quality (question, bold statement, number) |
| formatFit | 15% | Content type matches platform recommendation |
| hashtagHygiene | 10% | Correct count, no generic hashtags |
| timingPlaceholder | 5% | Placeholder for future analytics-based timing |
| ctaClarity | 10% | Clear call-to-action with action verbs |
| complianceRisk | 15% | No medical claims, no superlatives, low risk category |
| audienceRelevance | 10% | Audience defined and targeted |
| originality | 10% | Vocabulary diversity, no template language |
| platformFit | 10% | Within character limit |

## Scoring Bands

| Band | Score Range | Action | Can Schedule |
|---|---|---|---|
| Approve | 90–100 | Ready to approve | Yes |
| Optimize | 75–89 | Good, optimization recommended | Yes |
| Revise | 60–74 | Requires revision | No (manual override) |
| Block | 0–59 | Do not schedule | No |

## Spam/Black-hat Detection

| Tactic | Severity | Detection |
|---|---|---|
| engagement_bait | block | "like and share", "tag a friend" |
| misleading_claims | block | "doctors hate this", "miracle cure" |
| hashtag_stuffing | warning/block | >3 generic hashtags or >15 total |
| fake_urgency | warning | "only 1 left", "act now or miss out" |

## Stale Rule Detection

| Age | Severity | Action |
|---|---|---|
| Fresh (<30 days) | none | Normal |
| Aging (30-60 days) | warning | Warning in score output |
| Stale (60-90 days) | warning | Warning in score output |
| Expired (>90 days) | block | Blocks scheduling |
| Never reviewed | block | Blocks scheduling |

## API Endpoints

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| POST | /algo/score | Bearer | reviewer+ | Score a draft (0-100) |
| GET | /algo/rules | Bearer | viewer+ | Get platform rules |
| POST | /algo/rules | Bearer | admin | Add platform rule |
| POST | /algo/rules/:id/review | Bearer | admin | Mark rule as reviewed |
| GET | /algo/rules/stale | Bearer | viewer+ | Get stale rules |

## Permissions

| Role | algo:score | algo:rules:read | algo:rules:manage |
|---|---|---|---|
| admin | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ❌ |
| department_head | ✅ | ✅ | ❌ |
| specialist | ✅ | ✅ | ❌ |
| reviewer | ✅ | ✅ | ❌ |
| viewer | ❌ | ✅ | ❌ |

## Compliance Guardrails

- Medical claims (cure, diagnose, guarantee, miracle) → compliance score drops to 20
- Superlative claims (best, greatest, revolutionary) → compliance score reduced by 15
- High-risk category → compliance score capped at 30
- Spam flags with severity "block" → canSchedule = false
- Expired/stale rules → canSchedule = false
- **Compliance always overrides reach optimization**
