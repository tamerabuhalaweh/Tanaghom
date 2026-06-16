# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 4.5 — STITCH Alignment
**Status**: In Progress
**Goal**: Architecture and data-model alignment to reflect STITCH as a governed, capability-led, AgentRep-centered operating substrate. No new business workflows.

## Active Module

- `docs/architecture/` — STITCH architecture documentation
- `docs/adr/` — New ADRs (005–009)
- `prisma/seed.ts` — Department seed update to RevOps structure

## Allowed Files

- `docs/architecture/STITCH_ARCHITECTURE.md` — new STITCH architecture doc
- `docs/architecture/ARCHITECTURE.md` — updated to reference STITCH
- `docs/architecture/AI_AGENT_MODEL.md` — updated identity model
- `docs/architecture/DATA_MODEL.md` — updated with STITCH entities
- `docs/architecture/MODULE_BOUNDARIES.md` — updated for STITCH
- `docs/architecture/SECURITY_MODEL.md` — updated for STITCH
- `docs/adr/005-*.md` through `docs/adr/009-*.md` — new ADRs
- `docs/sprints/SPRINT-04-5-stitch-alignment.md` — sprint report
- `prisma/seed.ts` — department seed update
- `CONTEXT.md` — this file
- `AGENTS.md` — updated for STITCH

## Locked Files

- `modules/auth/` — stable
- `modules/users-departments/` — stable
- `modules/campaigns/` — stable
- `modules/ai-generation/` — stable
- `modules/algorithm-intelligence/` — stable
- `modules/approvals/` — not yet
- `modules/publishing/` — not yet
- `modules/analytics/` — not yet
- `modules/learning-engine/` — not yet
- `modules/crm-conversion/` — not yet
- `modules/production-requests/` — not yet
- No approval, publishing, analytics, learning, CRM, or production workflow
- No real MCP servers, Paperclip, ResourceSpace integrations

## Sprint Acceptance Criteria

- [ ] Documentation reflects the new STITCH architecture
- [ ] Prisma schema is updated only if needed for provisional canonical objects
- [ ] Department names align with the new customer RevOps org
- [ ] Previous completed modules still compile and tests pass
- [ ] CI remains green
- [ ] No business feature scope is added
- [ ] Open PR and stop for review before Sprint 5

## Next Sprint (Planned)

**Sprint 5**: Approval Workflow — department-based approval routing, approve/reject/request changes, reviewer comments, SLA, audit trail, permission checks, state transition enforcement. Awaiting review of Sprint 4.5 before proceeding.
