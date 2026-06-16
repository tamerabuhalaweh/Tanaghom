# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 6 — SAIF Decision Records & DKS Foundation
**Status**: Complete
**Goal**: Implement the SAIF v1.2 decision-record foundation and DKS foundation so future approval, governance, publishing, MCP mediation, and execution can be tied to auditable, bounded, knowledge-backed decisions.

## Active Module

- `modules/saif-decisions/` — SAIF Decision Record types, repository, service
- `modules/dks/` — DKS Entry types, repository, service
- `prisma/schema.prisma` — SAIF and DKS models

## Allowed Files

- `modules/saif-decisions/**` — SAIF Decision module
- `modules/dks/**` — DKS module
- `prisma/schema.prisma` — Schema updates
- `docs/architecture/SAIF.md` — SAIF reference
- `docs/architecture/DATA_MODEL.md` — Data model updates
- `docs/architecture/MODULE_BOUNDARIES.md` — Module boundaries updates
- `docs/sprints/SPRINT-06-saif-decision-dks.md` — Sprint report
- `CONTEXT.md` — This file

## Locked Files

- `modules/auth/` — stable
- `modules/users-departments/` — stable
- `modules/campaigns/` — stable
- `modules/ai-generation/` — stable
- `modules/algorithm-intelligence/` — stable
- `modules/approvals/` — not yet
- `modules/publishing/` — not yet

## Sprint Acceptance Criteria

- [x] SAIF Decision Records can be created and retrieved
- [x] Decision records include HumanUser and AgentRep lineage
- [x] SAIF roles are represented distinctly
- [x] Parent-child and cascading decision relationships are supported
- [x] The 10 evaluation dimensions are supported
- [x] Security Posture, Human Oversight, and Compliance are enforced as critical dimensions
- [x] DKS entries can be created and linked to decisions
- [x] Execution handoff fields exist but do not execute anything
- [x] Existing 311 tests still pass
- [x] New tests cover decision creation, role assignment, DKS linking, critical dimension enforcement, parent-child composition, permissions, and audit lineage
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (337 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 7

## Next Sprint (Planned)

**Sprint 7**: TBD — Awaiting review of Sprint 6 before proceeding.
