# STITCH Architecture Supremacy

> **Version**: 1.0
> **Date**: 2026-06-22

## Core Principle

**STITCH is the architecture source of truth.** No implementation, sprint, or module may redefine STITCH substrate objects.

## STITCH Substrate Objects (Immutable)

| Object | Purpose | Status |
|---|---|---|
| AgentRep | Canonical delegated identity | ✅ Implemented |
| FunctionalAgent | M4 workers subordinate to AgentRep | ✅ Implemented |
| GovernanceAgent | M5 support subordinate to AgentRep | ✅ Implemented |
| SessionContext | HumanUserId + AgentRepId + AgentType | ✅ Implemented |
| Capability | Stable reusable architecture unit | ✅ Defined |
| ExecutionPattern | Capability execution template | ✅ Defined |
| Resource | External resource reference | ✅ Defined |
| Implementation | Concrete implementation | ✅ Defined |
| Run | SPINE execution record | ✅ Implemented |
| Artifact | SPINE output artifact | ✅ Implemented |
| Event | Observability event | ✅ Implemented |
| AuditRecord | Audit trail entry | ✅ Implemented |
| LearningSignal | Learning signal for DKS | ✅ Implemented |
| Asset | Canonical asset identity | ✅ Implemented |
| AssetCognitionRecord | Asset cognition metadata | ✅ Implemented |

## Architecture Rules

1. **STITCH objects are immutable** — No sprint may redefine their core structure
2. **Extensions only** — New objects must extend, not replace, STITCH objects
3. **Substrate first** — Always check STITCH before creating new patterns
4. **No duplication** — Never duplicate STITCH objects in domain modules
5. **No bypass** — Never bypass STITCH patterns for convenience

## Department Topology Model

**Departments are topology nodes, not hardcoded architecture primitives.**

| Department | Topology Role | Capabilities |
|---|---|---|
| Brand & Market Intelligence | Intelligence node | Market analysis, brand monitoring |
| Demand Generation | Generation node | Campaign creation, content generation |
| Conversion | Conversion node | Lead capture, CRM handoff |
| Customer Growth & Retention | Growth node | Customer engagement, retention |
| Revenue Operations | Operations node | Analytics, reporting, optimization |
| CCO | Executive authority | Cross-department governance |

## Capability Model

**Capabilities are the stable reusable architecture unit.**

| Capability | Domain | Reusable |
|---|---|---|
| Content Generation | Commercial/Content | ✅ |
| Campaign Management | Commercial/Content | ✅ |
| Approval Workflow | Cross-domain | ✅ |
| Analytics Reporting | Cross-domain | ✅ |
| Asset Management | Cross-domain | ✅ |
| Learning & DKS | Cross-domain | ✅ |
| CRM Integration | Commercial/Content | ✅ |
| Messaging Integration | Cross-domain | ✅ |
| Rendering | Cross-domain | ✅ |
| Publishing | Commercial/Content | ✅ |

## Agent Labels

**Agent labels are business-facing projections, not necessarily one runtime agent per department.**

| Agent Label | Business Role | Runtime Agent |
|---|---|---|
| Content Specialist | Content creation | FunctionalAgent |
| Campaign Manager | Campaign management | FunctionalAgent |
| Approval Manager | Approval workflow | GovernanceAgent |
| Analytics Manager | Analytics reporting | FunctionalAgent |
| CRM Manager | CRM operations | FunctionalAgent |
| CCO | Executive authority | GovernanceAgent |
