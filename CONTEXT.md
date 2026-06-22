# CONTEXT.md — Active Sprint Briefing

> **Update this file at the start and end of every sprint.**
> **AI memory is not authoritative.** Every sprint must start from repo docs, Sprint Template, Source-of-Truth Register, and Enterprise Acceptance Criteria.

## Current Sprint

**Sprint**: 26 — Taxonomy Decision + Capability/Topology Registry Foundation
**Status**: Complete
**PR**: See PR #27
**Branch**: feature/sprint-26-taxonomy-capability-topology-registry

## Active Module

- `modules/capability-registry/` — Extended with enterprise taxonomy tests
- `prisma/seed.ts` — Extended with enterprise capability seeds
- `docs/enterprise/taxonomy/` — New taxonomy documents
- `docs/adr/011-*.md` — New ADR for taxonomy decisions
- No new business code — taxonomy/registry foundation only

## Sprint Acceptance Criteria

- [x] Registry audit completed
- [x] ADR-011 canonical taxonomy created
- [x] Canonical taxonomy document created
- [x] Legacy taxonomy mapping created
- [x] Capability registry extension plan created
- [x] Enterprise capability seeds added
- [x] Enterprise taxonomy tests added (16 new tests)
- [x] Commercial/Content mapped as reference implementation
- [x] Future enterprise capabilities registered as planned
- [x] QC marked as Evaluator, not Authority
- [x] ERP requires MCP and separate scope
- [x] No M5 capability enabled
- [x] No direct external access capability enabled
- [x] Deprecated terms mapped or rejected
- [x] Documentation updates complete
- [x] 871 tests pass (16 new)
- [x] CI 4/4 green
- [x] No business feature implementation
- [x] No Financial Agent implementation
- [x] No ERP connector
- [x] No external APIs
- [x] No M5

## Taxonomy Decision Status

**4-Pillar vs 5-Pillar: REQUIRES BUSINESS AUTHORITY DECISION**

See ADR-011 for details. The customer must confirm which model is canonical before Sprint 27.

## Next Sprint (Planned)

**Sprint 27**: TBD — Awaiting Codex review of Sprint 26 before proceeding.

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
