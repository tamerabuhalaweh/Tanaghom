# Capability Registry Extension Plan

> **Version**: 1.0
> **Date**: 2026-06-22
> **Sprint**: 26

## Purpose

Define how future capabilities will be registered without duplicating existing modules.

## ID Formats

### Capability ID Format

```
cap-{domain}-{name}-{version}
```

Examples:
- `cap-content-generate-draft-v1`
- `cap-finance-report-v1`
- `cap-hr-manage-employee-v1`

### Capability Bundle ID Format

```
bundle-{domain}-{name}
```

Examples:
- `bundle-content-intelligence`
- `bundle-finance-control`
- `bundle-hr-operations`

### Topology Node ID Format

```
node-{domain}-{name}
```

Examples:
- `node-commercial-content`
- `node-finance`
- `node-hr`

## Owner/Authority Fields

| Field | Type | Description |
|---|---|---|
| owner_substrate | String | STITCH substrate that owns this capability |
| owner_pack | String | Pack that contains doctrine for this capability |
| authority | String | Who has authority over this capability (TopologyNode or Executive) |
| reviewer | String | Who reviews changes to this capability |

## Lifecycle Status

| Status | Description |
|---|---|
| draft | Capability is being defined |
| registered | Capability is registered but not implemented |
| active | Capability is implemented and active |
| deprecated | Capability is being phased out |
| retired | Capability is no longer available |

## Risk Level

| Level | Description | SAIF Required |
|---|---|---|
| low | Minimal impact | No |
| medium | Moderate impact | Recommended |
| high | Significant impact | Yes |
| critical | Critical impact | Yes (full review) |

## Required SAIF Decision Flag

Capabilities with `requires_saif_decision = true` must have a SAIF DecisionPackage before execution.

## Required MCP Flag

Capabilities with `requires_mcp = true` must go through MCP mediation for external access.

## Required Approval Policy

Capabilities with `requires_approval = true` must have human approval before execution.

## Pack Reference Fields

| Field | Type | Description |
|---|---|---|
| pack_id | String | Reference to the pack that contains doctrine |
| pack_version | String | Version of the pack |
| pack_section | String | Section within the pack |

## Audit/Observability Requirements

| Requirement | Description |
|---|---|
| audit_trail | All capability executions must be logged |
| observability_events | All capability executions must emit events |
| sp_lineage | All capability executions must create SPINE records |
| learning_signals | Capability executions may create learning signals |

## Extension Process

### 1. Register Capability

```yaml
capability:
  id: cap-{domain}-{name}-{version}
  name: "Capability Name"
  description: "What this capability does"
  domain: "commercial|finance|hr|procurement|inventory|purchase|supply_chain"
  category: "content|analysis|governance|knowledge|publishing|..."
  risk_level: "low|medium|high|critical"
  requires_approval: true|false
  requires_saif_decision: true|false
  requires_mcp: true|false
  allowed_agent_types: ["functional", "governance"]
  owner_substrate: "STITCH Core or Pack name"
  lifecycle_status: "draft|registered|active|deprecated|retired"
  pack_id: "pack-{domain}-{name}"
  topology_nodes: ["node-{domain}-{name}"]
```

### 2. Define ExecutionPattern

```yaml
execution_pattern:
  id: ep-{capability-id}-{version}
  capability_id: "cap-{domain}-{name}-{version}"
  name: "Pattern Name"
  description: "How this capability is executed"
  ordered_steps: []
  required_inputs: []
  expected_outputs: []
  boundary_rules: []
  m4_allowed: true
  m5_required: false
```

### 3. Define Resources

```yaml
resource:
  id: res-{name}-{version}
  name: "Resource Name"
  resource_type: "api|database|file|service"
  canonical_owner: "Owner"
  external_reference: "Reference"
  sensitivity: "low|medium|high|critical"
  access_rules: {}
```

### 4. Define Implementation

```yaml
implementation:
  id: impl-{capability-id}-{provider}-{version}
  capability_id: "cap-{domain}-{name}-{version}"
  name: "Implementation Name"
  implementation_type: "mock|real"
  provider: "Provider Name"
  is_external: true|false
  requires_mcp: true|false
  m4_allowed: true
  m5_allowed: false
  status: "planned|active|deprecated"
```

## Registration Rules

1. **No duplication** — Never duplicate existing capabilities
2. **STITCH compliance** — Capabilities must follow STITCH patterns
3. **SAIF compliance** — Significant capabilities require SAIF decision
4. **MCP compliance** — External capabilities require MCP mediation
5. **Approval compliance** — High-risk capabilities require approval
6. **Pack compliance** — Doctrine must be in packs, not STITCH Core
7. **Topology compliance** — Capabilities map to topology nodes
8. **Audit compliance** — All executions must be auditable
