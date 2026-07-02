# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**
> **AI memory is not authoritative.** Every sprint must start from repo docs, Sprint Template, Source-of-Truth Register, and Enterprise Acceptance Criteria.

## Current Sprint

**Sprint**: 59 — Event Foundation + Strategy Wizard
**Status**: Backend foundation in review (merge blockers fixed, awaiting re-review)
**PR**: Pending creation
**Branch**: feature/sprint-59-event-foundation-strategy-wizard

## Active Module

- `modules/commercial-events/` — New module for Commercial Event management
- `prisma/schema.prisma` — Extended with CommercialEvent model, enums, and relations
- `prisma/seed.ts` — Extended with realistic Amro event seed data
- `src/index.ts` — Registered `/events` route

## Sprint Acceptance Criteria

- [x] CommercialEvent Prisma model with all required fields
- [x] Event types: tagyeer_wa_irtaqi, moaaskar_al_tamayoz, business_camp, virtual_event
- [x] Event status state machine: draft → planning → active → completed/cancelled
- [x] Strategy fields: offer, audience, geography, fomo_angle, upsell_plan, selected_channels, content/sales requirements
- [x] Tenant isolation (tenant_key on all queries)
- [x] Campaign linkage (event_id on ContentRequest)
- [x] Lead linkage (event_id on LeadCaptureRecord)
- [x] Publishing package linkage (event_id on PublishingPackage)
- [x] Backend API: create, list, get, update, update strategy, transition, link campaign, link lead
- [x] RBAC permissions: events:read/create/update/transition/link (includes Amro roles)
- [x] Audit logging on all mutations
- [x] Domain events emitted on all mutations
- [x] Seed data: Tagyeer wa Irtaqi — Summer 2026 (realistic Amro event)
- [x] Tests: 104 new tests (state machine, validators, permissions, tenant isolation, date derivation)
- [x] Prisma migration: 20260702_commercial_events
- [x] Auto-derive campaignStartDate from eventDate (30 days before)
- [x] API routes: /events and /commercial-events (both registered)
- [x] Backend lint: 0 errors
- [x] Backend typecheck: 0 errors
- [x] Backend tests: 1089 pass (104 new)
- [x] Backend build: success
- [x] Frontend lint: 0 errors
- [x] Frontend build: success

## Out Of Scope (Sprint 59)

- Live Meta Ads integration
- Live YouTube Ads integration
- Live GHL write
- Live WhatsApp execution
- Event list/detail UI (Lane B — Codex handles)
- Strategy wizard UI (Lane B — Codex handles)
- Playwright walkthrough (Lane E)

## Next Sprint (Planned)

**Sprint 60**: Per-Event Dashboard and Manual KPI Tracking

## Enterprise Control Plane

| Document | Location |
|---|---|
| Source-of-Truth Register | `docs/enterprise/governance/SOURCE_OF_TRUTH_REGISTER.md` |
| Repo Baseline Audit | `docs/enterprise/governance/REPO_BASELINE_AUDIT.md` |
| STITCH Supremacy | `docs/enterprise/architecture/STITCH_SUPREMACY.md` |
| Capability & Topology Model | `docs/enterprise/architecture/CAPABILITY_AND_TOPOLOGY_MODEL.md` |
| Content Department Overlay | `docs/enterprise/architecture/CONTENT_DEPARTMENT_OVERLAY_MODEL.md` |
| SAIF Decision Package Schema | `docs/enterprise/saif/SAIF_DECISION_PACKAGE_SCHEMA.md` |
| Pack Boundary Model | `docs/enterprise/packs/PACK_BOUNDARY_MODEL.md` |
| ERP Connector Governance | `docs/enterprise/erp/ERP_CONNECTOR_GOVERNANCE.md` |
| Enterprise Acceptance Criteria | `docs/enterprise/governance/ENTERPRISE_ACCEPTANCE_CRITERIA.md` |
| AI Engineering Protocol | `docs/enterprise/governance/AI_ENGINEERING_PROTOCOL.md` |
| Sprint Template | `docs/enterprise/governance/SPRINT_TEMPLATE.md` |
| Enterprise Roadmap | `docs/enterprise/ENTERPRISE_ROADMAP.md` |
| Canonical Taxonomy | `docs/enterprise/taxonomy/CANONICAL_TAXONOMY.md` |
| Legacy Taxonomy Mapping | `docs/enterprise/taxonomy/LEGACY_TAXONOMY_MAPPING.md` |
| ADR-011: Canonical Taxonomy | `docs/adr/011-canonical-taxonomy-and-capability-topology.md` |
| Capability Registry Extension Plan | `docs/enterprise/architecture/CAPABILITY_REGISTRY_EXTENSION_PLAN.md` |
