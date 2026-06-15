# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 5 — Approval Workflow
**Status**: Complete (pending review)
**Goal**: Approval routing, decision recording, SLA compliance, audit trail, permission checks.

## Active Module

- `modules/approvals/` — approval routing, decisions, status, SLA

## Allowed Files

- `modules/approvals/**` — approvals module implementation
- `src/index.ts` — mount approvals route
- `docs/api/openapi.yaml` — add approval endpoints
- `docs/sprints/SPRINT-05-approval-workflow.md` — sprint report

## Locked Files

- `modules/auth/` — stable
- `modules/users-departments/` — stable
- `modules/campaigns/` — stable
- `modules/ai-generation/` — stable
- `modules/algorithm-intelligence/` — stable
- `modules/publishing/` — not yet
- `modules/analytics/` — not yet
- `modules/learning-engine/` — not yet
- `modules/crm-conversion/` — not yet
- `modules/production-requests/` — not yet
- No publishing, scheduling, analytics, learning, CRM, or production workflow

## Sprint Acceptance Criteria

- [x] Project directory structure created
- [x] AGENTS.md, CLAUDE.md, CONTEXT.md, README.md written
- [x] SOUL.md, MEMORY.md, HEARTBEAT.md created
- [x] PLATFORM_RULES.md, APPROVAL_POLICY.md, SECURITY_POLICY.md created
- [ ] docs/product/ — PRD.md, SRS.md, USER_ROLES.md, WORKFLOWS.md
- [ ] docs/architecture/ — ARCHITECTURE.md, MODULE_BOUNDARIES.md, DATA_MODEL.md, SECURITY_MODEL.md, AI_AGENT_MODEL.md, STATE_MACHINES.md
- [ ] docs/api/openapi.yaml — initial API contract skeleton
- [ ] docs/adr/ — template + initial decisions (001–004)
- [ ] docs/sprints/SPRINT-00-foundation.md — full sprint 0 plan
- [ ] docs/quality/ — TESTING_STRATEGY.md, RELEASE_CHECKLIST.md, AI_SESSION_PROTOCOL.md
- [ ] docs/prompts/ — AI_CODING_SESSION_PROMPT.md, PR_REVIEW_PROMPT.md
- [ ] modules/*/README.md — all 12 module boundary docs
- [ ] Provider interface definitions (types only, no implementation)

## Next Sprint (Planned)

**Sprint 0B**: Technical Foundation — Docker Compose, PostgreSQL, Prisma, Redis, BullMQ, CI, linting, testing setup.
