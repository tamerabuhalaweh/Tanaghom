# ADR-003: Use Department-Based Approval Workflow

> **Status**: Accepted
> **Date**: 2026-06-14

## Context

SmartLabs/Tanaghum has a multi-department organizational structure (CCO, Brand, Acquisition, Conversion, Growth, Commercial Operations, Production, Event Operations). Different content types and risk levels require approval from different departments. A simple "one approver" model does not reflect the organizational reality.

## Decision

Implement a department-based approval workflow where content routes to approvers based on risk category and content type:
- **Low risk**: 1 approver (Content Reviewer from relevant department)
- **Medium risk**: 2 approvers (Department Head + Brand & Positioning)
- **High risk**: 3 approvers (CCO + Brand & Positioning + Compliance)

## Consequences

- Accurate reflection of organizational decision-making
- Risk-based routing reduces approval bottlenecks for low-risk content
- High-risk content gets appropriate oversight
- More complex approval state management
- Need backup approver mechanism for SLA enforcement
- Need clear escalation path when approvers are unavailable

## Alternatives Considered

- **Single approver**: Too simple, doesn't reflect organizational structure.
- **All-department approval**: Too slow, creates bottlenecks.
- **AI-only approval**: Violates human-oversight requirement for MVP.

## References

- Tanaghum organizational structure (user-provided)
- SmartLabs approval policy requirements
