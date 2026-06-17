# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**

## Current Sprint

**Sprint**: 17 — Learning Signal Review → DKS Update Workflow
**Status**: Complete
**Goal**: Implement governed workflow for LearningSignal review and DKS updates through human/authority review.

## Active Module

- `modules/learning-review/` — Learning review types, repository, service, tests
- `prisma/schema.prisma` — Learning review models
- `prisma/migrations/` — Learning review migration

## Sprint Acceptance Criteria

- [x] LearningSignalReview model exists
- [x] DksUpdateProposal model exists
- [x] DksUpdateDecision model exists
- [x] KnowledgeRevision model exists
- [x] LearningSignals can be reviewed
- [x] Accepted LearningSignals can propose DKS updates
- [x] Rejected LearningSignals cannot update DKS
- [x] DKS updates require authority decision
- [x] Approved DKS updates create versioned KnowledgeRevision
- [x] High-impact DKS updates require SAIF Decision Record
- [x] LearningSignals cannot approve, publish, execute, mutate workflows, or change strategy automatically
- [x] HumanUser and AgentRep lineage are included
- [x] Observability/audit records are created where practical
- [x] Existing 703 tests still pass
- [x] New learning-review/DKS-update tests are added (36 tests)
- [x] npm run lint passes
- [x] npm run typecheck passes
- [x] npm run test passes (739 tests)
- [x] npm run build passes
- [ ] GitHub Actions CI is green
- [ ] Open PR and stop for review before Sprint 18

## Next Sprint (Planned)

**Sprint 18**: TBD — Awaiting review of Sprint 17 before proceeding.
