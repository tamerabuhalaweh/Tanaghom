# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 7 — Governance / Approval Workflow
**Status**: Complete
**Goal**: Implement the governed approval workflow on top of HumanUser, AgentRep, SAIF Decision Records, DKS, identity lineage, and RevOps department routing.

## Active Module

- `modules/approvals/` — Approval types, repository, service, tests
- `prisma/schema.prisma` — Approval model
- `prisma/migrations/` — Approval migration

## Sprint Acceptance Criteria

- [x] Approval requests can be created for eligible targets
- [x] Approval requests can reference SAIF Decision Records
- [x] Authorized HumanUsers can approve, reject, request changes, escalate, or cancel
- [x] Approval actions include HumanUser and AgentRep lineage
- [x] Session Context Lock applies to all approval actions
- [x] FunctionalAgent cannot approve
- [x] GovernanceAgent cannot replace human authority
- [x] High-risk approvals route to CCO or designated senior authority
- [x] Department routing follows the new RevOps structure
- [x] Approval cannot proceed when SAIF critical dimensions are unresolved
- [x] Approval actions are audit logged
- [x] Approval state transitions use strict state machine
- [x] No publishing, scheduling, analytics, learning, CRM, Paperclip, ResourceSpace, or MCP integration implemented
- [x] Existing 337 tests still pass
- [x] New approval tests added (45 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (382 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 8

## Next Sprint (Planned)

**Sprint 8**: TBD — Awaiting review of Sprint 7 before proceeding.
