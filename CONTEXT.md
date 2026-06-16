# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 4.5 — STITCH Alignment
**Status**: Complete (accepted with cleanup conditions)
**Goal**: Architecture and data-model alignment to reflect STITCH as a governed, capability-led, AgentRep-centered operating substrate. No new business workflows.

## Active Module

- `docs/architecture/` — STITCH architecture documentation
- `docs/adr/` — New ADRs (005–009)
- `prisma/seed.ts` — Department seed update to RevOps structure

## Sprint Acceptance Criteria

- [x] Documentation reflects the new STITCH architecture
- [x] Prisma schema is updated only if needed for provisional canonical objects
- [x] Department names align with the new customer RevOps org (5 departments + CCO executive authority)
- [x] Previous completed modules still compile and tests pass
- [x] CI remains green
- [x] No business feature scope is added
- [x] Open PR and stop for review before Sprint 5

## Next Sprint (Planned)

**Sprint 5**: AgentRep Identity & Session Context Lock — HumanUser/User alignment, AgentRep model, FunctionalAgent model, GovernanceAgent model, RoleBinding/PermissionGrant, Session Context Lock, audit lineage, tests. No approval workflow, publishing, analytics, learning, CRM, ResourceSpace, Paperclip, real MCP servers.
