# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 5 — AgentRep Identity & Session Context Lock
**Status**: Complete
**Goal**: Implement the STITCH identity-delegation foundation so every important action can be traced from HumanUser → AgentRep → functional/governance action.

## Active Module

- `modules/users-departments/` — AgentRep types, repository, service
- `modules/auth/` — Session context with agentRepId
- `shared/auth/` — JWT payload with agentRepId
- `prisma/schema.prisma` — AgentRep, FunctionalAgent, GovernanceAgent models
- `prisma/seed.ts` — AgentRep records for sample users

## Allowed Files

- `modules/users-departments/**` — AgentRep module implementation
- `modules/auth/**` — Auth module updates
- `shared/auth/**` — Shared auth updates
- `prisma/schema.prisma` — Schema updates
- `prisma/seed.ts` — Seed updates
- `docs/architecture/STITCH_ARCHITECTURE.md` — STITCH reference
- `docs/architecture/SECURITY_MODEL.md` — Security model updates
- `docs/architecture/AI_AGENT_MODEL.md` — Agent model updates
- `docs/architecture/DATA_MODEL.md` — Data model updates
- `docs/sprints/SPRINT-05-agentrep-session-lock.md` — Sprint report

## Locked Files

- `modules/campaigns/` — stable
- `modules/ai-generation/` — stable
- `modules/algorithm-intelligence/` — stable
- `modules/approvals/` — not yet
- `modules/publishing/` — not yet
- `modules/analytics/` — not yet
- `modules/learning-engine/` — not yet
- `modules/crm-conversion/` — not yet
- `modules/production-requests/` — not yet

## Sprint Acceptance Criteria

- [x] HumanUser/User to AgentRep relationship exists in schema and service logic
- [x] Seed creates AgentRep records for sample users, including CCO where applicable
- [x] Authenticated session can resolve the user's assigned AgentRep
- [x] Session Context Lock prevents users from invoking another user's AgentRep
- [x] FunctionalAgent and GovernanceAgent are represented distinctly from AgentRep
- [x] Audit/logging helpers can include HumanUser + AgentRep lineage
- [x] Existing auth, RBAC, campaigns, AI generation, and algorithm intelligence modules still pass tests
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (304 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open a PR and stop for review before Sprint 6

## Next Sprint (Planned)

**Sprint 6**: TBD — Awaiting review of Sprint 5 before proceeding.
