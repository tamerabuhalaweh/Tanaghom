# Sprint 12 — Asset Cognition & ResourceSpace Boundary

> **Sprint**: 12
> **Status**: Complete
> **Date**: 2026-06-16
> **Goal**: Implement the Asset Cognition foundation. STITCH owns canonical asset identity.

## Scope

Asset model, AssetCognitionRecord, ExternalAssetReference, asset lineage, ResourceSpace boundary enforcement. No real ResourceSpace integration, file upload, rendering, or external DAM calls.

## Deliverables

### Prisma Models

| Model | Purpose |
|---|---|
| `Asset` | Canonical asset identity |
| `AssetCognitionRecord` | What STITCH knows about the asset |
| `ExternalAssetReference` | External DAM/tool references (not source of truth) |
| `AssetLineage` | Asset lineage relationships |

### Enums

| Enum | Values |
|---|---|
| `AssetType` | 11 types (image, video, document, audio, template, carousel, thumbnail, brand_guideline, creative_brief, publishing_package, other) |
| `AssetStatus` | draft, pending_review, approved, rejected, archived, superseded |
| `CognitionType` | brand_alignment, compliance_status, usage_context, performance_data, platform_fit, audience_fit, quality_assessment |
| `ExternalReferenceType` | resourcespace_asset, rendering_output, design_tool_link, storage_object, dam_reference |
| `ExternalSyncStatus` | synced, pending, conflict, stale, unknown |
| `AssetLineageType` | derived_from, variant_of, approved_version_of, rendered_from, used_in, supports, replaces, references |

### Module Files

| File | Purpose |
|---|---|
| `types.ts` | Schemas, types, asset status transitions |
| `repository.ts` | Database operations for all asset entities |
| `service.ts` | Business logic with boundary enforcement |
| `tests/asset-cognition.test.ts` | 40 tests |

### ResourceSpace Boundary Rules

- ResourceSpace is external DAM/reference surface only
- ResourceSpace does not own canonical asset identity
- ResourceSpace metadata cannot overwrite STITCH canonical fields
- ResourceSpace integration must go through MCP Mediation
- No direct ResourceSpace API calls allowed

### Tests Added

| Test Category | Tests |
|---|---|
| Asset permissions | 11 tests |
| Asset status lifecycle | 8 tests |
| Asset types | 3 tests |
| Cognition record authority blocking | 3 tests |
| ResourceSpace boundary | 3 tests |
| Foreign object references | 2 tests |
| Asset lineage types | 2 tests |
| No secrets in metadata | 1 test |
| Session Context Lock | 3 tests |
| External reference types | 1 test |
| **Total** | **40 tests** |

## Test Results

```
Test Files: 30 passed (30)
Tests:      572 passed (572)
Duration:   2.31s
```

- Existing tests: 532 pass
- New tests: 40 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 572/572 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- Real ResourceSpace integration
- DAM API calls
- File upload
- File system asset management
- Rendering tools
- Image/video generation
- Postiz publishing
- Scheduling
- Analytics pulls
- Learning engine automation
- CRM/WhatsApp
- Paperclip integration
- Real MCP servers
- Real external APIs
- M5 write-enabled runtime

## Asset Cognition Architecture

```
Asset (canonical identity)
├── AssetCognitionRecord[] (what STITCH knows)
├── ExternalAssetReference[] (external DAM references, not source of truth)
├── source_lineage[] (outgoing)
├── target_lineage[] (incoming)
├── created_by_user (reference)
├── created_by_agent_rep (reference)
├── spine_artifact (reference)
├── saif_decision (reference)
├── approval (reference)
└── capability_resolution (reference)
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Sprint complete | Sprint 12 |
