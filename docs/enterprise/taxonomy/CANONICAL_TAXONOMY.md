# Canonical Taxonomy

> **Version**: 1.1
> **Date**: 2026-06-22
> **Sprint**: 26
> **Status**: Accepted — 5-Pillar Model

## Canonical Model

The customer has confirmed the **5-pillar model** as the canonical taxonomy:

| Pillar | Description |
|---|---|
| Agent | Delegated identity (AgentRep, FunctionalAgent, GovernanceAgent) |
| Capability | Stable reusable architecture unit |
| Topology | Organizational grouping (departments as topology nodes) |
| Pack | Self-contained domain-specific doctrine |
| Decision | SAIF-governed decision record (DecisionPackage) |

**Note**: Exact pillar names/definitions are pending customer confirmation. The canonical structure is 5 pillars.

## Approved Terms

| Term | Definition | Source |
|---|---|---|
| Agent | Generic term for any software agent in the system | STITCH Core |
| AgentRep | Canonical delegated identity bound to a HumanUser | STITCH Core |
| FunctionalAgent | M4 worker subordinate to AgentRep | STITCH Core |
| GovernanceAgent | M5 support subordinate to AgentRep | STITCH Core |
| Capability | Stable reusable architecture unit | STITCH Core |
| CapabilityBundle | Named group of related capabilities | Enterprise Pack |
| TopologyNode | Organizational grouping (department, team, function) | Enterprise Pack |
| Pack | Self-contained domain-specific doctrine | Enterprise Pack |
| DecisionPackage | SAIF-governed decision record | SAIF v1.2 |
| Intent | What a user wants to achieve | STITCH Core |
| Objective | Measurable goal for an intent | STITCH Core |
| ExecutionPattern | How a capability is executed | STITCH Core |
| Resource | External resource reference | STITCH Core |
| Implementation | Concrete implementation of a capability | STITCH Core |
| Run | SPINE execution record | STITCH Core |
| Artifact | SPINE output artifact | STITCH Core |

## Deprecated/Legacy Terms

| Legacy Term | New Term | Mapping |
|---|---|---|
| Department Agent | TopologyNode + CapabilityBundle | Agent label maps to topology node and capability bundle |
| Commercial Agent | Commercial/Content Capability Overlay | Agent label maps to content overlay |
| Approval Ticket | SAIF DecisionPackage or ApprovalQueueItem | Depends on risk level |
| QC Approval | Evaluator Output | QC is Evaluator, not Authority |
| ERP Integration | Optional MCP-Mediated Connector | Separate project, separate scope |
| Department | TopologyNode | Organizational grouping, not architecture primitive |

## Allowed Meanings

| Term | Allowed Meanings |
|---|---|
| Agent | Any software agent (FunctionalAgent or GovernanceAgent) |
| AgentRep | Delegated identity for a HumanUser |
| Capability | What can be done (not how, not who) |
| CapabilityBundle | Group of related capabilities for a domain |
| TopologyNode | Organizational grouping |
| Pack | Domain-specific doctrine and configuration |

## Forbidden Meanings

| Term | Forbidden Meanings |
|---|---|
| Department | Hardcoded architecture primitive |
| Agent | One runtime agent per department |
| Capability | Department-specific functionality |
| Pack | STITCH Core redefinition |
| ERP | Required platform component |

## Business Agent Labels → Internal Model

| Agent Label | TopologyNode | CapabilityBundle | Runtime Agent |
|---|---|---|---|
| Content Specialist | Commercial/Content | Content Intelligence | FunctionalAgent |
| Campaign Manager | Commercial/Content | Creative Production | FunctionalAgent |
| Approval Manager | Cross-domain | Quality Control | GovernanceAgent |
| Analytics Manager | Commercial/Content | Analytics | FunctionalAgent |
| CRM Manager | Commercial/Content | Conversion | FunctionalAgent |
| CCO | Executive/Governance | Cross-domain | GovernanceAgent |
| Financial Analyst | Finance | Finance Control | FunctionalAgent |
| HR Manager | HR | HR Operations | FunctionalAgent |
| Procurement Manager | Procurement | Procurement Operations | FunctionalAgent |
| Inventory Manager | Inventory | Inventory Control | FunctionalAgent |
| Purchase Manager | Purchase Management | Purchase Management | FunctionalAgent |
| Supply Chain Manager | Supply Chain | Supply Chain Operations | FunctionalAgent |

## Commercial/Content Reference Implementation

The Commercial/Content domain is the first completed reference implementation:

### Topology Nodes

| TopologyNode | CapabilityBundle | Capabilities |
|---|---|---|
| Brand & Market Intelligence | Audience Intelligence | Market analysis, brand monitoring |
| Demand Generation | Content Intelligence, Creative Production | Content generation, campaign management |
| Conversion | Conversion | CRM integration, lead capture |
| Customer Growth & Retention | Community | Customer engagement, retention |
| Revenue Operations | Analytics | Analytics reporting, optimization |
| CCO (Executive Authority) | Cross-domain | Governance, policy enforcement |

### Registered Capabilities

| Capability | Category | Risk | Bundle |
|---|---|---|---|
| GenerateContentDraft | content | medium | Content Intelligence |
| EvaluateReachReadiness | analysis | low | Analytics |
| RequestApproval | governance | medium | Quality Control |
| RetrieveKnowledge | knowledge | low | Cross-domain |
| PreparePublishingPackage | publishing | high | Distribution |

## Future Enterprise Domains

| Domain | TopologyNode | CapabilityBundle | Status |
|---|---|---|---|
| Finance | Finance | Finance Control | ⏳ Registered |
| HR | HR | HR Operations | ⏳ Registered |
| Procurement | Procurement | Procurement Operations | ⏳ Registered |
| Inventory | Inventory | Inventory Control | ⏳ Registered |
| Purchase Management | Purchase Management | Purchase Management | ⏳ Registered |
| Supply Chain | Supply Chain | Supply Chain Operations | ⏳ Registered |
