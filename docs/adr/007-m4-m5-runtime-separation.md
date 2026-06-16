# ADR-007: M4/M5 Runtime Separation

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment

## Context

The platform runs two fundamentally different types of agents: functional agents that perform business capabilities (content generation, analytics, scheduling) and governance agents that enforce policies and can veto actions. Running both in the same runtime context creates security risks — a compromised functional agent could interfere with governance enforcement.

## Decision

Separate agent runtimes into two tiers:

- **M4 (Functional Runtime)**: Runs FunctionalAgents — content-writer, brand-reviewer, analytics-puller, scheduler. These agents perform business capabilities through the capability resolution pipeline.
- **M5 (Governance Runtime)**: Runs GovernanceAgents — security-sentinel, compliance-guardian. These agents enforce policies, evaluate actions against rules, and have veto authority over functional agent actions.

Key constraints:
- FunctionalAgents cannot modify, disable, or bypass GovernanceAgents
- GovernanceAgents can evaluate and veto any FunctionalAgent action
- The two runtimes share no mutable state — communication is through audited interfaces
- GovernanceAgents have access to the full event stream for evaluation

## Consequences

- Policy enforcement is structurally isolated from business logic execution
- A compromised functional agent cannot affect governance enforcement
- GovernanceAgents can be updated independently of functional agents
- Clear separation of concerns simplifies security review
- Slightly more complex deployment topology
- Cross-runtime communication requires explicit interfaces

## Alternatives Considered

- **Single runtime with role-based filtering**: Simpler but a compromised agent could bypass role checks
- **External policy engine (e.g., OPA)**: More standard but adds external dependency and latency
- **Inline governance checks**: Mixed concerns, governance logic embedded in every functional agent

## References

- STITCH_ARCHITECTURE.md — Overview, Functional Agents, Governance Agents
- AI_AGENT_MODEL.md — Agent Types (M4/M5)
