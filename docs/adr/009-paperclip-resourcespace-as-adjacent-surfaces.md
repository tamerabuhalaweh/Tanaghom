# ADR-009: Paperclip and ResourceSpace as Adjacent Surfaces

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment

## Context

The Tanaghum platform integrates with several external tools: Paperclip (content management/editorial workflow), ResourceSpace (asset storage/retrieval), Grafana (observability dashboards), and rendering tools (image/video production). A naive architecture might treat these as first-class platform components with ownership authority over data. This creates coupling and architectural confusion about where canonical data lives.

## Decision

Treat Paperclip, ResourceSpace, Grafana, and rendering tools as **adjacent surfaces** — execution-capable components that the platform references, but that do NOT own canonical data.

Key constraints:
- **Paperclip** is an editorial workflow surface. It does not own content identity, approval state, or campaign data. The platform's content tables are canonical.
- **ResourceSpace** is an asset storage/retrieval surface. It does not own asset identity. The platform's `assets` table is canonical (see ADR-008).
- **Grafana** is an observability surface. It does not own event, audit, or learning signal data. The platform's observability tables are canonical.
- **Rendering tools** are execution surfaces for producing visual assets. They do not own asset identity or creative direction.
- All adjacent surfaces are accessed through MCP-mediated boundaries, not direct integration.

## Consequences

- Clear architectural boundary between canonical platform data and external tool capabilities
- Platform can migrate away from any adjacent surface without losing data or identity
- External tools are interchangeable — Postiz can be swapped for another publisher, ResourceSpace for another asset store
- Data flow is unidirectional: platform → adjacent surface (platform is authoritative)
- Requires explicit integration layers for each adjacent surface
- Some data duplication between platform and adjacent surfaces

## Alternatives Considered

- **External tools as canonical owners**: Simpler integration but creates hard dependencies and migration risk
- **Shared ownership model**: Ambiguous, creates conflict resolution problems
- **No external tools**: Loses specialized capabilities of Paperclip, ResourceSpace, Grafana, rendering tools

## References

- STITCH_ARCHITECTURE.md §7 — MCP Mediation Rules, §8 — Department Seed
- ARCHITECTURE.md — Adjacent Surfaces vs Canonical Ownership
