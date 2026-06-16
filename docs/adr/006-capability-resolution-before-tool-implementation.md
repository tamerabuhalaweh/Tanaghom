# ADR-006: Capability Resolution Before Tool Implementation

> **Status**: Accepted
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment

## Context

Agents need to perform actions (generate content, review compliance, publish posts, pull analytics). In a naive design, agents directly call tools or APIs. This creates problems: no traceability of why a tool was called, no governance over which capabilities are available, and no mechanism to enforce MCP mediation boundaries.

## Decision

Implement a **capability resolution pipeline** that runs before any tool invocation:

```
Intent → Objective → Capability → ExecutionPattern → Resource → Implementation → Execution
```

Key constraints:
- Agents cannot directly invoke tools — they must resolve through the capability pipeline
- Capabilities define what the platform can do, not how
- ExecutionPatterns define reusable recipes for fulfilling capabilities
- Resources define external or internal systems, with explicit access mechanisms (MCP-mediated, direct internal, connector)
- Implementations bind ExecutionPatterns to specific Resources
- Executions are single invocations producing Artifacts

## Consequences

- Every agent action is traceable to an intent, objective, and capability
- MCP mediation is enforced at the Resource level — agents cannot bypass it
- Capabilities can be granted or revoked independently of tool availability
- ExecutionPatterns are reusable across capabilities
- Additional indirection layer adds slight latency to action resolution
- Requires upfront modeling of intents, objectives, and capabilities

## Alternatives Considered

- **Direct tool calls**: Simpler but no governance, no traceability, no MCP enforcement
- **Permission-only gating**: Checks permissions but doesn't enforce capability resolution or MCP mediation
- **Middleware-only approach**: Intercepts calls but doesn't model the full intent → capability chain

## References

- STITCH_ARCHITECTURE.md §3 — Capability Resolution Pipeline
- DATA_MODEL.md — intents, objectives, capabilities, execution_patterns, resources, implementations, executions
