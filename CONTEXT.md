# CONTEXT.md - Current Active Context

Last updated: 2026-07-19

## Single Source Of Truth

Read [`docs/handover/CURRENT_PROJECT_HANDOVER.md`](docs/handover/CURRENT_PROJECT_HANDOVER.md) before development, review, deployment, or agent work.

GitHub issues in `tamerabuhalaweh/Tanaghom` are the source of truth for remaining scope. Refresh them instead of relying on historical sprint files:

```bash
gh issue list --repo tamerabuhalaweh/Tanaghom --state open --limit 100
```

## Current Recovery Point

```text
Branch: main
Product baseline: 6553960de8024116193e791723682777c49dab74
Canonical recovery tag: hybrid-recovery-2026-07-19
Source-of-truth PR: #209
Repository: https://github.com/tamerabuhalaweh/Tanaghom
Active deployment: https://tanaghum-hybrid.163-123-180-104.sslip.io
```

Local `main` and `origin/main` were verified synchronized on 2026-07-19. GitHub CI for product baseline `6553960` and source-of-truth PR `#209` passed, and Hybrid external uptime checks are passing.

## Active Product Direction

- Work on Hybrid only unless the user explicitly changes scope.
- Do not touch the AB reference deployment.
- Product hierarchy: historical assessment -> approved learning -> annual plan -> monthly initiative -> execution plan -> weekly work -> Event/Content/Sales operations.
- Latest completed product closure: `#201 / UX-R1G`.
- Latest hotfix and QA closures: `#204` and `#206`.
- Recommended next issue: `#208 / UX-R1H: Weekly operating cadence below execution plans`.
- Production operations remain tracked by `#171`.

## Non-Negotiable Truth

- AI prepares, humans approve, and the system records.
- Stitchi must use tenant isolation, RBAC, validation, audit, and approval paths.
- External writes require customer-owned credentials and explicit authorization.
- Never commit secrets or claim live connector completion without customer-credential evidence.
- Close GitHub issues only when their definition of done is genuinely complete.
