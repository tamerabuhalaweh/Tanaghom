# CONTEXT.md - Current Active Context

Last updated: 2026-07-06

## Start Here

The current project handover source of truth is:

[`docs/handover/CURRENT_PROJECT_HANDOVER.md`](docs/handover/CURRENT_PROJECT_HANDOVER.md)

Read that file before starting any new development, review, deployment, or AI-agent task.

## Current Active Branch

```text
feature/hybrid-emergent-ux-governed-tanaghum
```

Latest known active commit at this update:

```text
0399098 feat: improve Postiz channel validation UX
```

## Current Product Direction

The active implementation lane is Hybrid Tanaghum:

```text
Emergent-style customer UX
  -> Tanaghum frontend API adapter
  -> Tanaghum backend
  -> RBAC / tenant isolation / audit / approval / integrations / workflow controls
```

Main rule:

**Customers configure business systems, not backend architecture.**

Customer-facing setup should show:

- GoHighLevel CRM
- Postiz scheduling
- Meta / Instagram analytics
- YouTube analytics
- Formaloo / forms
- SmartLabs voice/chat
- AI provider
- CSV import fallback

Customer-facing setup must not show:

- agentgateway
- OpenClaw
- AgentScope
- MCP internals
- runtime bridge internals

Those belong under Admin/Ops evidence only.

## Current Runtime Truth

- R3 agentgateway sandbox policy adapter is live-accepted on hybrid for connector dry-run mediation.
- This is not full production agentgateway deployment.
- OpenClaw is not production-orchestrating Tanaghum workflows.
- AgentScope is not executing production agent sessions.
- External writes, publishing, CRM writes, messaging, voice calls, and M5 remain blocked unless explicitly authorized.

Current R4/R4A status:

- Postiz read-only adapter is deployed and live-accepted on hybrid for connector dry-run.
- It uses tenant-owned Postiz `baseUrl`, `apiKey`, and optional `integrationId`.
- It reads Postiz integrations and analytics only.
- It does not schedule, publish, import, or write KPI records during dry-run.
- R4 live validation returned: credential valid, zero connected channels, zero KPI rows, no writes, honest customer setup blocker.
- R4A channel selection UX is implemented locally:
  - user can select listed channels
  - user can paste a Postiz integration ID as pending validation
  - user can run read-only analytics validation for an event
  - the UI shows KPI preview rows or precise setup blockers
- R4A still needs hybrid deployment/live validation.

Next recommended work:

1. Deploy R4A to hybrid and live-test the Postiz channel UX.
2. If the customer connects a channel and saves `integrationId`, confirm analytics preview rows.
3. Then move to GHL read sync or Formaloo import depending on available customer credentials.

## Current Required Verification

Before claiming any implementation complete:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

For customer-facing UI work, add browser walkthrough or Playwright evidence.

## Documentation Rule

Older sprint files remain audit history. If they conflict with the current code or the handover file, use:

1. current code and schema
2. current tests
3. deployed evidence
4. `docs/handover/CURRENT_PROJECT_HANDOVER.md`
5. historical sprint docs
