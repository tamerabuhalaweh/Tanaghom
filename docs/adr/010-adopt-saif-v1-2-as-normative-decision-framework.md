# ADR-010: Adopt SAIF v1.2 as Normative Decision Framework

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Authority**: Product Owner
> **Scope**: All modules, all future decisions
> **Stakeholders**: Engineering team, product owner

## Context

The Tanaghum platform makes numerous AI-related decisions: model selection, capability design, agent behavior, integration choices, cost trade-offs. Without a structured decision framework, these decisions risk being:
- Implicit rather than explicit
- Inconsistent across sprints
- Poorly documented for future sessions
- Missing cost-benefit analysis
- Lacking evaluation of security, compliance, and human oversight

## Decision

Adopt **SAIF v1.2** (Strategic AI Framework) as the normative decision framework for the Tanaghum platform. All significant AI-related decisions must follow SAIF's:
- DKS (Decision Knowledge Specification) declaration
- Mandatory evaluation dimensions (10 dimensions, 3 critical)
- SAIF Decision Record model (extends ADR)
- Execution handoff model
- Cost-benefit guidance

## Evaluation

| Dimension | Assessment | Rating | Notes |
|---|---|---|---|
| Capability Impact | Adds structured decision-making capability | + | Enables better long-term decisions |
| Security Posture | Security is a critical evaluation dimension | + | Explicit security evaluation required |
| Cost | Adds overhead to decision process | 0 | Overhead is minimal, value is high |
| Latency | No impact on runtime latency | 0 | Decision-time only |
| Maintainability | Improves long-term maintainability | + | Decisions are documented and traceable |
| Reversibility | Easy to deprecate if needed | + | SAIF records can be deprecated |
| Human Oversight | Human oversight is a critical dimension | + | Explicit human oversight evaluation required |
| Compliance | Compliance is a critical evaluation dimension | + | Explicit compliance evaluation required |
| Observability | Decision records are version-controlled | + | Full decision history available |
| Learning Potential | Enables learning from past decisions | + | Decision rationale preserved |

## Cost-Benefit Analysis

### Costs

| Category | Estimated Cost | Frequency | Monthly Total |
|---|---|---|---|
| Human Time | 15-30 min per significant decision | ~10 decisions/month | 2.5-5 hours |
| **Total** | | | **~$0 (internal time)** |

### Benefits

| Category | Expected Benefit | Measurement Method |
|---|---|---|
| Quality | Better decisions through structured evaluation | Decision outcome tracking |
| Risk Reduction | Explicit security/compliance/human oversight evaluation | Critical dimension ratings |
| Learning | Decision rationale preserved for future sessions | DKS record completeness |
| Maintainability | Consistent decision format across sprints | ADR template compliance |

### Break-Even

Immediate — the framework costs only decision-making time, which is already being spent. SAIF structures existing effort rather than adding new effort.

### Recommendation

Accept. SAIF v1.2 provides structural value at minimal cost. The mandatory evaluation dimensions ensure critical factors (security, compliance, human oversight) are never overlooked.

## Execution Handoff

| Field | Value |
|---|---|
| decision_id | ADR-010 |
| implementer | All engineering sessions |
| scope | docs/adr/, docs/architecture/SAIF.md |
| acceptance_criteria | All new ADRs use SAIF template; SAIF.md is referenced in AGENTS.md and ARCHITECTURE.md |
| blocking_dependencies | None |
| estimated_effort | Small |
| deadline | Immediate (this sprint) |

## Consequences

- All new ADRs must use the SAIF Decision Record template
- Existing ADRs (001–009) are grandfathered — no retroactive changes
- Every significant AI decision must be evaluated across 10 mandatory dimensions
- Three Critical dimensions (Security, Human Oversight, Compliance) require positive rating or explicit acceptance with mitigation
- Cost-benefit analysis is structural for decisions with resource impact
- Execution handoffs must be explicit with testable acceptance criteria
- SAIF is integrated into STITCH: capability resolution, governance review, SPINE recording

## Alternatives Considered

- **No formal framework**: Simpler but inconsistent decisions, missing evaluations
- **Lightweight ADR-only**: Better than nothing but lacks evaluation dimensions and cost-benefit analysis
- **Heavy governance framework**: Too much overhead for current team size

## References

- docs/architecture/SAIF.md — SAIF v1.2 specification
- docs/adr/000-template.md — Original ADR template (superseded for new ADRs)
