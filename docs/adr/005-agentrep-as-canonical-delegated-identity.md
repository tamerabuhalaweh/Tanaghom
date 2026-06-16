# ADR-005: AgentRep as Canonical Delegated Identity

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment

## Context

The platform needs a clear model for how AI agents act on behalf of human users. Previous designs conflated human identity with agent identity, or treated agents as autonomous actors without delegation chains. This creates ambiguity in audit trails, permission enforcement, and cross-human boundary control.

## Decision

Introduce **AgentRep** as the canonical delegated identity for all agent actions in the system. Every agent action is performed by an AgentRep that is bound to exactly one HumanUser. AgentReps cannot act autonomously — they derive authority from their HumanUser through RoleBinding and PermissionGrant.

Key constraints:
- A HumanUser can only invoke their assigned AgentRep(s)
- AgentRep A (bound to HumanUser X) cannot invoke, delegate to, or modify AgentRep B (bound to HumanUser Y)
- Session context is locked at session start and immutable for session duration

## Consequences

- Every agent action has a clear delegation chain: HumanUser → AgentRep → FunctionalAgent → Execution
- Audit trails are unambiguous — all actions trace to a specific HumanUser via their AgentRep
- Cross-human agent delegation is structurally prevented
- Permission enforcement is centralized through RoleBinding and PermissionGrant
- Slightly more complex identity model than direct user-agent mapping

## Alternatives Considered

- **Direct user-agent mapping**: Simpler but conflates human and agent identity, making audit trails ambiguous
- **Autonomous agents with capability tokens**: Allows agents to act without human delegation, violating human-oversight requirements
- **Shared agent pool**: Multiple humans sharing agent instances creates attribution and boundary problems

## References

- STITCH_ARCHITECTURE.md §1 — Identity Model
- DATA_MODEL.md — agent_reps, role_bindings, permission_grants
