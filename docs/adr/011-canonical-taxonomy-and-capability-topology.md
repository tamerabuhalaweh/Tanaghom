# ADR-011: Canonical Taxonomy and Capability Topology

> **Date**: 2026-06-22
> **Status**: Accepted
> **Sprint**: 26

## Context

The Tanaghom AI Enterprise Platform has evolved from a Commercial/Social/Content automation platform to a multi-enterprise platform covering Finance, HR, Procurement, Inventory, Purchase Management, Supply Chain, and optional ERP integrations. The customer's architecture review approved this direction but added critical rules:

1. Departments are topology nodes, not hardcoded architecture primitives
2. Capabilities are the stable reusable architecture unit
3. Agent labels are business-facing projections, not necessarily one runtime agent per department
4. STITCH substrate objects must not be redefined
5. Customer doctrine must live in governed packs, not STITCH Core

## Decision

### 1. Canonical Term Definitions

| Term | Meaning | Source |
|---|---|---|
| **Agent** | Generic term for any software agent in the system | STITCH Core |
| **AgentRep** | Canonical delegated identity bound to a HumanUser | STITCH Core (ADR-005) |
| **FunctionalAgent** | M4 worker subordinate to AgentRep | STITCH Core (ADR-007) |
| **GovernanceAgent** | M5 support subordinate to AgentRep | STITCH Core (ADR-007) |
| **Capability** | Stable reusable architecture unit that defines what can be done | STITCH Core (ADR-006) |
| **CapabilityBundle** | Named group of related capabilities for a business domain | Enterprise Pack |
| **TopologyNode** | Organizational grouping (department, team, function) | Enterprise Pack |
| **Pack** | Self-contained domain-specific doctrine and configuration | Enterprise Pack |
| **DecisionPackage** | SAIF-governed decision record for significant decisions | SAIF v1.2 |

### 2. Department Model

**Departments are topology nodes, not hardcoded architecture primitives.**

- Departments are organizational groupings that map to TopologyNodes
- TopologyNodes are configurable registry records, not hardcoded constants
- TopologyNodes reference CapabilityBundles, not individual capabilities
- TopologyNodes can be reorganized without changing capabilities

### 3. Capability Model

**Capabilities are the stable reusable architecture unit.**

- Capabilities persist across department reorganizations
- Capabilities are reusable across multiple TopologyNodes
- Capabilities are grouped into CapabilityBundles for business domains
- Capabilities have lifecycle status, risk level, and governance requirements

### 4. Pack Boundary Model

**Customer doctrine must live in governed packs, not STITCH Core.**

- STITCH Core defines substrate objects (AgentRep, Capability, etc.)
- Enterprise Packs define domain-specific doctrine (Commercial/Content, Finance, etc.)
- Packs reference STITCH objects, never redefine them
- Packs are isolated and self-contained

### 5. Canonical Taxonomy Model

**Status: ACCEPTED — 5-Pillar Model**

The customer has confirmed the 5-pillar model as the canonical taxonomy.

- **5-Pillar Model**: Agent, Capability, Topology, Pack, Decision
- **4-Pillar Model**: Legacy/public/previous model (Agent, Capability, Topology, Pack)

The 5-pillar model adds Decision (SAIF DecisionPackage) as a first-class pillar, reflecting the enterprise requirement that all significant decisions must be governed by SAIF.

**Note**: Exact pillar names/definitions are pending customer confirmation. The canonical structure is 5 pillars.

### 6. Commercial/Content as Reference Implementation

The Commercial/Content domain is the first completed reference implementation:

| Topology Node | Capability Bundle | Status |
|---|---|---|
| Brand & Market Intelligence | Audience Intelligence | ✅ Implemented |
| Demand Generation | Content Intelligence, Creative Production | ✅ Implemented |
| Conversion | Conversion | ✅ Implemented |
| Customer Growth & Retention | Community | ✅ Implemented |
| Revenue Operations | Analytics | ✅ Implemented |
| CCO (Executive Authority) | Cross-domain governance | ✅ Implemented |

### 7. Future Enterprise Domains

Future enterprise domains are registered as planned capability bundles, not implemented as business modules:

| Domain | Topology Node | Capability Bundle | Status |
|---|---|---|---|
| Finance | Finance | Finance Control | ⏳ Registered |
| HR | HR | HR Operations | ⏳ Registered |
| Procurement | Procurement | Procurement Operations | ⏳ Registered |
| Inventory | Inventory | Inventory Control | ⏳ Registered |
| Purchase Management | Purchase Management | Purchase Management | ⏳ Registered |
| Supply Chain | Supply Chain | Supply Chain Operations | ⏳ Registered |

### 8. ERP Integration

ERP integrations are optional, separately scoped, separately quoted, separately priced, and separately approved:

- ERP write-back is blocked by default
- ERP access is read-only by default
- ERP access through MCP mediation only
- ERP requires SAIF decision package
- ERP is a separate project, not part of core platform

## Consequences

1. **Departments become configurable** — No more hardcoded department lists
2. **Capabilities become reusable** — Same capability serves multiple departments
3. **Packs isolate doctrine** — Domain-specific rules don't contaminate STITCH Core
4. **Topology is flexible** — Reorganize departments without changing capabilities
5. **ERP remains optional** — No dependency on ERP for core platform
6. **5-pillar model is canonical** — Decision (SAIF DecisionPackage) is a first-class pillar

## Related ADRs

- ADR-005: AgentRep as Canonical Delegated Identity
- ADR-006: Capability Resolution Before Tool Implementation
- ADR-007: M4/M5 Runtime Separation
- ADR-010: Adopt SAIF v1.2 as Normative Decision Framework
