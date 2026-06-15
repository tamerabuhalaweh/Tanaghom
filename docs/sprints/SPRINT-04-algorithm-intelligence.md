# SPRINT-04: Algorithm Intelligence MCP

> **Sprint**: 4
> **Status**: Complete (pending review)
> **Goal**: Reach Readiness Score calculation, platform-specific scoring, stale rule detection, spam detection, optimization suggestions.

## Deliverables

| Deliverable | Status | Description |
|---|---|---|
| modules/algorithm-intelligence/types.ts | ✅ | Scoring components (9), scoring bands, rule freshness, spam tactics, Zod schemas, response types |
| modules/algorithm-intelligence/validators.ts | ✅ | Score draft and add rule validation |
| modules/algorithm-intelligence/events.ts | ✅ | Algorithm event definitions |
| modules/algorithm-intelligence/scoring-engine.ts | ✅ | Core scoring logic with 9 weighted components, stale rule detection, spam detection, optimization suggestions |
| modules/algorithm-intelligence/repository.ts | ✅ | Platform rule CRUD, stale rule queries |
| modules/algorithm-intelligence/service.ts | ✅ | Business logic with permissions, audit logging, event emission |
| modules/algorithm-intelligence/controller.ts | ✅ | REST endpoints |
| modules/algorithm-intelligence/tests/scoring-engine.test.ts | ✅ | 13 scoring tests |
| modules/algorithm-intelligence/tests/spam-detection.test.ts | ✅ | 15 spam/stale/compliance tests |
| modules/algorithm-intelligence/tests/permissions.test.ts | ✅ | 18 RBAC tests |
| modules/algorithm-intelligence/tests/validators.test.ts | ✅ | 9 validation tests |
| modules/algorithm-intelligence/tests/edge-cases.test.ts | ✅ | 9 edge case tests |
| Prisma schema update | ✅ | Added third_party_research, internal_analytics to SourceType enum |

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

## Test Summary

| Test File | Count | Coverage |
|---|---|---|
| scoring-engine.test.ts | 13 | Score calculation, hook, format, hashtags, platform fit |
| spam-detection.test.ts | 15 | Spam tactics, stale rules, compliance guardrails, optimization |
| permissions.test.ts | 18 | RBAC (viewer cannot score, only admin can manage rules) |
| validators.test.ts | 9 | Input validation |
| edge-cases.test.ts | 9 | Empty input, all platforms, component bounds, weighted sum |
| **Total** | **64** | |

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Every draft can receive a Reach Readiness Score (0-100) | ✅ |
| Score includes platform-specific factors (hook, format, hashtags, timing, CTA, compliance) | ✅ |
| Module produces clear optimization suggestions | ✅ |
| Stale platform rules detected, can block or warn | ✅ |
| Black-hat/spammy tactics rejected | ✅ |
| Compliance and brand safety always override reach optimization | ✅ |
| Scoring logic has one source of truth and is tested | ✅ (scoring-engine.ts) |
| Tests cover score calculation, stale rules, invalid platform, spam, permissions, edge cases | ✅ (64 tests) |
| No approval, publishing, analytics, learning, CRM, production workflow | ✅ |
| CI passes | ✅ |
