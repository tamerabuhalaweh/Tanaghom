# ADR-008: Asset Cognition Owning Canonical Asset Identity

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment

## Context

The platform manages digital assets (images, videos, documents, creative files) that are used in social media content. External systems like ResourceSpace provide storage and retrieval capabilities. If ResourceSpace owns asset identity, the platform becomes dependent on an external system for its own data model — creating coupling, migration risk, and loss of cognitive metadata control.

## Decision

**Asset Cognition owns canonical asset identity.** The `assets` table in the Tanaghum platform database is the single source of truth for what an asset is, who created it, and what the platform knows about it. ResourceSpace is referenced as an adjacent surface through `resourcespace_references`.

Key constraints:
- The `assets` table is the canonical identity layer — not ResourceSpace
- `AssetCognitionRecord` stores what the platform "knows" about an asset (brand alignment, compliance status, usage context, performance data)
- `resourcespace_references` maps canonical assets to ResourceSpace IDs for storage/retrieval
- If ResourceSpace is unavailable, the platform's asset identity is unaffected
- Assets can exist without a ResourceSpace reference (e.g., AI-generated assets)

## Consequences

- Platform owns its asset data model independent of external system lifecycle
- Cognitive metadata (brand alignment, compliance, performance) is stored alongside identity
- Migration away from ResourceSpace does not require asset identity reconstruction
- AI-generated assets are first-class citizens without requiring ResourceSpace storage
- Requires explicit sync mechanism between platform and ResourceSpace
- Slightly more data duplication (metadata in both systems)

## Alternatives Considered

- **ResourceSpace as canonical owner**: Simpler but creates hard dependency on external system
- **Bidirectional sync without canonical owner**: Conflict resolution becomes complex and unreliable
- **No external asset management**: Loses ResourceSpace's storage/retrieval capabilities

## References

- STITCH_ARCHITECTURE.md §6 — Asset Cognition
- DATA_MODEL.md — assets, asset_cognition_records, resourcespace_references
