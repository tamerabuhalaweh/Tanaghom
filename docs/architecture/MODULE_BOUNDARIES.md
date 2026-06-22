# MODULE_BOUNDARIES.md — Module Responsibilities

> **Version**: 3.0
> **Date**: 2026-06-22
> **Sprint**: 25 — Enterprise Architecture Reconciliation
> **Update Rule**: Before coding new modules

## Core Rule

Each module owns a single business capability. It must NOT do work that belongs to another module. Modules communicate via domain events, not direct imports. All agent actions flow through the STITCH identity model (AgentRep → Capability Resolution → MCP-mediated execution). See `STITCH_ARCHITECTURE.md`.

## Enterprise Architecture Rules

1. **Departments are topology nodes**, not hardcoded architecture primitives
2. **Capabilities are the stable reusable architecture unit**, not department-specific
3. **Agent labels are business-facing projections**, not necessarily one runtime agent per department
4. **STITCH substrate objects must not be redefined** by any stage
5. **SAIF decision packages must be explicit** for significant decisions
6. **Tanaghum-specific doctrine must live in governed packs**, not STITCH Core
7. **ERP integrations are optional**, separately scoped, separately quoted, separately priced, separately approved
8. **ERP write-back is blocked by default**
9. **QC is an Evaluator role**, not final human approval

## STITCH Substrate (Immutable)

No module may redefine these STITCH substrate objects:

| Object | Purpose |
|---|---|
| AgentRep | Canonical delegated identity |
| FunctionalAgent | M4 workers subordinate to AgentRep |
| GovernanceAgent | M5 support subordinate to AgentRep |
| SessionContext | HumanUserId + AgentRepId + AgentType |
| Capability | Stable reusable architecture unit |
| ExecutionPattern | Capability execution template |
| Resource | External resource reference |
| Implementation | Concrete implementation |
| Run | SPINE execution record |
| Artifact | SPINE output artifact |
| Event | Observability event |
| AuditRecord | Audit trail entry |
| LearningSignal | Learning signal for DKS |
| Asset | Canonical asset identity |
| AssetCognitionRecord | Asset cognition metadata |

## Module Rules

No module may bypass:
- **AgentRep** — Identity delegation
- **Capability Resolution** — Intent → Objective → Capability → ExecutionPattern → Resource → Implementation → Execution
- **MCP Mediation** — All external access through MCP mediation
- **SAIF** — Decision governance for significant decisions
- **SPINE** — Execution lineage with Run + Artifact
- **Observability** — Events, AuditRecords, LearningSignals
- **Approval Gateway** — Human approval before external actions
- **Asset Cognition** — Canonical asset identity

## Module Definitions

### auth
- **Owns**: Login, sessions, tokens, user identity, password management
- **Must NOT**: Approve content, publish posts, manage departments
- **Entry point**: `controller.ts` → REST endpoints

### users-departments
- **Owns**: HumanUsers, AgentReps, departments, RoleBindings, PermissionGrants, ConnectorBindings, CredentialBindings
- **Must NOT**: Create campaign content, publish posts
- **Entry point**: `controller.ts` → REST endpoints

### campaigns
- **Owns**: Campaign requests, goals, audience, platforms, content items, content state machine
- **Must NOT**: Generate drafts, approve content, publish to Postiz
- **Entry point**: `controller.ts` → REST endpoints
- **Key constraint**: Uses strict state machine for content_item status transitions

### ai-generation
- **Owns**: Draft generation, platform-specific copy, brand voice validation, risk scoring
- **Must NOT**: Approve content, schedule posts, bypass brand/compliance review
- **Entry point**: Called by campaigns module via domain event or direct service call
- **Key constraint**: Uses `LLMProvider` interface, never direct LLM API calls

### algorithm-intelligence
- **Owns**: Reach Readiness Score, trend rules, platform optimization, Platform Rules KB
- **Must NOT**: Guarantee reach, use black-hat tactics, approve content
- **Entry point**: Called during draft generation and approval workflow
- **Key constraint**: Every recommendation must include source, date checked, confidence

### approvals
- **Owns**: Approval routing, review steps, decisions, change requests, SLA enforcement, audit trail
- **Must NOT**: Call external social platforms directly, generate content
- **Entry point**: `controller.ts` → REST endpoints, domain events from campaigns
- **Key constraint**: Uses strict state machine for approval status transitions

### publishing
- **Owns**: Publishing jobs, scheduling state, retry logic, publishing status tracking
- **Must NOT**: Approve content, own campaign business logic
- **Entry point**: Triggered by approval module when all approvals collected
- **Key constraint**: Uses `PostizProvider` interface, exponential backoff on failures

### postiz-integration
- **Owns**: Postiz API adapter, account mapping, integration discovery, CLI wrapper
- **Must NOT**: Own campaign business logic, approve content
- **Entry point**: Service layer called by publishing module
- **Key constraint**: Uses `PostizProvider` interface

### analytics
- **Owns**: Post metrics, platform metrics, campaign reporting, dashboards, weekly reports
- **Must NOT**: Rewrite published content, approve content
- **Entry point**: BullMQ jobs (48h pull, 7-day pull, weekly report)
- **Key constraint**: Uses `AnalyticsProvider` interface

### learning-engine
- **Owns**: Performance lessons, pattern identification, MEMORY.md updates, experiment recommendations
- **Must NOT**: Publish automatically, bypass workflow rules
- **Entry point**: Called after analytics ingestion
- **Key constraint**: Only writes concise recommendations to MEMORY.md, never raw metrics

### crm-conversion
- **Owns**: Lead routing, WhatsApp handoff, CRM tags, CTA source tracking
- **Must NOT**: Manage brand voice, approve content
- **Entry point**: Domain events from campaigns/approvals
- **Key constraint**: Uses `CRMProvider` interface

### production-requests
- **Owns**: Design/video/carousel asset requests, creative briefs, asset tracking
- **Must NOT**: Approve commercial strategy, publish content
- **Entry point**: `controller.ts` → REST endpoints
- **Key constraint**: Uses `MessagingProvider` for team notifications

## Shared Utilities

### shared/database
- Prisma client singleton, connection helpers, migration utilities

### shared/errors
- Standard error types: `ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `ExternalServiceError`

### shared/logging
- Structured logger with fields: actor, action, object_type, object_id, timestamp, result

### shared/auth
- JWT generation/verification, session management, permission middleware, role checking

### shared/events
- In-process domain event bus. Events are typed and validated.

### shared/validation
- Common validation schemas (email, UUID, ISO 8601, pagination)

### shared/queue
- BullMQ queue setup, job definitions, worker management, retry configuration

## Cross-Module Communication

| From | To | Via | Event/Method |
|---|---|---|---|
| campaigns | ai-generation | Domain event | `campaign.draft_requested` |
| campaigns | approvals | Domain event | `draft.submitted_for_review` |
| approvals | publishing | Domain event | `content.approved` |
| publishing | postiz-integration | Direct service call | `postiz.createDraft()`, `postiz.schedule()` |
| publishing | analytics | Domain event | `content.published` |
| analytics | learning-engine | Domain event | `analytics.ingested` |
| learning-engine | MEMORY.md | File write | Concise lesson update |
| approvals | messaging | Domain event | `approval.requested`, `approval.reminder` |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
| 2026-06-16 | STITCH alignment — identity model, STITCH reference, RevOps departments | Sprint 4.5 |
