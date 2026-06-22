# Source-of-Truth Register

> **Version**: 1.0
> **Date**: 2026-06-22

## Hierarchy

| Priority | Source | Purpose | Authority |
|---|---|---|---|
| 1 | **SRD v1.2** | Customer-facing scope and delivery | Customer approval |
| 2 | **STITCH Architecture** | Architecture source of truth | Architecture review |
| 3 | **SAIF v1.2** | Decision-governance source of truth | Governance board |
| 4 | **GitHub Repo** | Implementation source of truth | Engineering team |

## Rules

1. **SRD defines WHAT** — customer-facing scope, deliverables, acceptance criteria
2. **STITCH defines HOW** — architecture patterns, substrate objects, capability model
3. **SAIF defines WHEN/WHY** — decision governance, evaluation dimensions, approval gates
4. **Repo defines WHAT'S BUILT** — code, tests, documentation, evidence

## Conflict Resolution

| Conflict | Resolution |
|---|---|
| SRD vs STITCH | STITCH wins on architecture, SRD wins on scope |
| STITCH vs SAIF | SAIF wins on governance, STITCH wins on architecture |
| SAIF vs Repo | SAIF wins on decisions, Repo wins on implementation |
| SRD vs Repo | SRD wins on scope, Repo wins on implementation details |

## Document References

| Document | Location | Status |
|---|---|---|
| SRD v1.2 | Customer-provided | ✅ Approved |
| SRD v1.2 Addendum Pack A–G | Customer-provided | ✅ Approved |
| STITCH–Tanaghom Deep Architecture Reconciliation Package | Customer-provided | ✅ Approved |
| SAIF v1.2 | Customer-provided | ✅ Approved |
| GitHub Repo | [Tanaghom](https://github.com/tamerabuhalaweh/Tanaghom) | ✅ Current (Sprint 24) |

## AI Engineering Protocol

1. **No AI memory** — AI must not rely on memory for architecture decisions
2. **Source-of-truth first** — Always check SRD, STITCH, SAIF before coding
3. **Repo baseline first** — Always check current repo state before adding
4. **Architecture rules first** — Always follow STITCH patterns
5. **Sprint spec before code** — Always have sprint spec before implementation
6. **Clear deliverables** — Every sprint must have clear deliverables
7. **Clear tests** — Every deliverable must have clear tests
8. **Clear acceptance criteria** — Every sprint must have clear acceptance criteria
9. **No hidden assumptions** — All assumptions must be documented
10. **No direct external integrations** — All integrations through MCP mediation
11. **No M5 unless explicitly authorized** — M5 requires explicit approval
12. **Codex GPT-5.5 review before merge** — All PRs require Codex review
