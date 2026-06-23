# Legacy Taxonomy Mapping

> **Version**: 1.2
> **Date**: 2026-06-22
> **Status**: 5-Pillar Business Taxonomy Confirmed

## Purpose

Map older terms and concepts to the new enterprise taxonomy model.

## STITCH Architecture Taxonomy

STITCH defines architecture primitives. These are NOT business pillars.

| Architecture Concept | Definition |
|---|---|
| Agent | Generic software agent |
| AgentRep | Delegated identity |
| Capability | Stable reusable unit |
| TopologyNode | Organizational grouping |
| Pack | Domain-specific doctrine |
| DecisionPackage | SAIF-governed decision |

## Tanaghum Business/Content Pillar Taxonomy

The customer has confirmed a **5-pillar business/content taxonomy**.

| Item | Status |
|---|---|
| 5-pillar business taxonomy | ✅ Confirmed |
| Exact pillar names | ⏳ Pending customer confirmation |
| Exact pillar definitions | ⏳ Pending customer confirmation |
| Content/course/analytics mapping | ⏳ Pending pillar definitions |

**Placeholders until customer confirms:**
- `tanaghum.pillar.1` through `tanaghum.pillar.5`
- Or `Business Pillar 1` through `Business Pillar 5`

**Do NOT** map STITCH architecture concepts to business pillars until confirmed.

## Term Mappings

### Department Agent → TopologyNode + CapabilityBundle

| Legacy | New | Mapping |
|---|---|---|
| Department Agent | TopologyNode + CapabilityBundle | Agent label maps to topology node and capability bundle |
| Brand Agent | TopologyNode: Brand & Market Intelligence | CapabilityBundle: Audience Intelligence |
| Demand Agent | TopologyNode: Demand Generation | CapabilityBundle: Content Intelligence, Creative Production |
| Conversion Agent | TopologyNode: Conversion | CapabilityBundle: Conversion |
| Growth Agent | TopologyNode: Customer Growth & Retention | CapabilityBundle: Community |
| Revenue Agent | TopologyNode: Revenue Operations | CapabilityBundle: Analytics |

### Commercial Agent → Commercial/Content Capability Overlay

| Legacy | New | Mapping |
|---|---|---|
| Commercial Agent | Commercial/Content Overlay | Maps to content generation, campaign management, publishing |
| Content Agent | Content Intelligence Capability | Maps to GenerateContentDraft capability |
| Campaign Agent | Creative Production Capability | Maps to campaign management workflow |
| Analytics Agent | Analytics Capability | Maps to EvaluateReachReadiness capability |

### Approval Ticket → SAIF DecisionPackage / ApprovalQueueItem

| Legacy | New | Mapping |
|---|---|---|
| Approval Ticket | SAIF DecisionPackage | For high-risk decisions requiring SAIF evaluation |
| Approval Ticket | ApprovalQueueItem | For standard approval workflow items |
| QC Approval | Evaluator Output | QC is Evaluator, not final Authority |
| Final Approval | Human Authority | Human makes final decision |

### QC Approval → Evaluator Output

| Legacy | New | Mapping |
|---|---|---|
| QC Approval | Evaluator Output | QC evaluates quality, reports findings |
| QC Authority | Evaluator Role | QC does not have final authority |
| QC Decision | Evaluation Report | QC reports, human decides |

### ERP Integration → Optional MCP-Mediated Connector

| Legacy | New | Mapping |
|---|---|---|
| ERP Integration | Optional MCP-Mediated Connector | Separate project, separate scope |
| ERP Required | ERP Optional | ERP is not required for platform operation |
| ERP Write-back | ERP Read-Only | ERP write-back blocked by default |
| ERP Direct Access | ERP MCP-Mediated | All ERP access through MCP mediation |

## Concept Mappings

### From Hardcoded to Configurable

| Legacy Concept | New Concept | Rule |
|---|---|---|
| Department list | TopologyNode registry | Configurable, not hardcoded |
| Department capabilities | CapabilityBundle mapping | Capabilities are reusable |
| Department agents | Agent labels | Labels are projections, not runtime |
| Department approval matrix | SAIF DecisionPackage | Decisions are governed by SAIF |

### From Monolithic to Pack-Based

| Legacy Concept | New Concept | Rule |
|---|---|---|
| Platform doctrine | Pack doctrine | Doctrine lives in packs, not STITCH Core |
| Domain rules | Pack rules | Domain-specific rules in packs |
| Integration rules | Pack integration rules | Integration rules in packs |
| Governance rules | Pack governance rules | Governance rules in packs |

## Migration Rules

1. **No Stage 1 rewrite** — Existing code continues to work
2. **Gradual migration** — New features use new taxonomy
3. **Backward compatibility** — Old terms still work during transition
4. **Documentation first** — Document mappings before code changes
5. **Tests required** — All mappings must have tests
