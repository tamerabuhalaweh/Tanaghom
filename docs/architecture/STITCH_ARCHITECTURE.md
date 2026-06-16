# STITCH_ARCHITECTURE.md — STITCH Operating Substrate

> **Version**: 1.0
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Update Rule**: Only by architecture decision (ADR)

## Overview

STITCH is the governed, capability-led, AgentRep-centered operating substrate for the Tanaghum platform. It is not merely a social/content automation stack — it is an agent-native operating layer that governs identity, capability resolution, execution lineage, observability, and asset cognition.

### Design Principles

1. **AgentRep is the canonical delegated identity** — all agent actions are performed by AgentReps bound to HumanUsers
2. **Capabilities are resolved before tools are invoked** — Intent → Objective → Capability → ExecutionPattern → Resource → Implementation → Execution
3. **MCP mediates all external access** — agents never directly access files, databases, analytics APIs, renderers, or enterprise APIs
4. **SPINE records all execution** — every Run produces Artifacts with lineage and replay index
5. **Asset Cognition owns canonical asset identity** — ResourceSpace is an adjacent surface, not the source of truth
6. **Observability is first-class** — Events, AuditRecords, and LearningSignals are structural, not afterthoughts

---

## 1. Identity Model

STITCH introduces a layered identity model that separates human identity from agent identity, functional roles, and governance.

### Entities

#### HumanUser

A real person authenticated to the platform. Maps to a human operator in the Tanaghum organization.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | String | Unique, used for authentication |
| name | String | Display name |
| department_id | UUID FK | Department membership |
| is_active | Boolean | Account status |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### AgentRep

The canonical delegated identity for an agent acting on behalf of a HumanUser. Every agent action in the system is performed by an AgentRep. AgentReps cannot act autonomously — they are bound to exactly one HumanUser.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| human_user_id | UUID FK | The HumanUser this AgentRep represents |
| name | String | Display name (e.g., "Alice's Content Agent") |
| agent_type | Enum | functional, governance |
| is_active | Boolean | Can be deactivated without deleting |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### FunctionalAgent

A specialized agent that performs a specific capability (e.g., content generation, compliance review, analytics pull). FunctionalAgents are invoked by AgentReps through the capability resolution pipeline.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique identifier (e.g., "content-writer", "brand-reviewer") |
| capability_id | UUID FK | The capability this agent implements |
| description | String | What this agent does |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### GovernanceAgent

A special agent type that enforces policies, compliance, and security constraints. GovernanceAgents can veto or block actions from FunctionalAgents.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique identifier (e.g., "security-sentinel", "compliance-guardian") |
| policy_scope | String[] | Which policies this agent enforces |
| veto_authority | Boolean | Can block actions |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### Binding Entities

#### RoleBinding

Maps an AgentRep to a system role within a department scope.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| role | Role | System role (admin, cco, department_head, specialist, reviewer, viewer) |
| department_id | UUID FK? | Department scope (null = global) |
| granted_at | Timestamp | |
| granted_by | UUID FK | HumanUser who granted this binding |

#### PermissionGrant

Fine-grained permission attached to an AgentRep or RoleBinding.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| permission | String | Permission identifier (e.g., "campaign:create", "approval:approve") |
| resource_scope | String? | Optional resource constraint |
| granted_at | Timestamp | |
| granted_by | UUID FK | HumanUser who granted this permission |
| expires_at | Timestamp? | Optional expiry |

#### ConnectorBinding

Binds an AgentRep to an external connector (e.g., Postiz, messaging channel, CRM).

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| connector_type | String | postiz, messaging, crm, analytics |
| connector_config | JSON | Connection-specific configuration |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### CredentialBinding

Securely associates credentials with a ConnectorBinding. Secrets are stored in the secrets manager, not in the database — this entity stores references only.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| connector_binding_id | UUID FK | The ConnectorBinding |
| credential_ref | String | Reference to secrets manager (not the secret itself) |
| credential_type | Enum | api_key, oauth_token, service_account |
| expires_at | Timestamp? | Optional credential expiry |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### Approval (Identity Context)

Approval in the identity model context binds a GovernanceAgent or HumanUser to an approval decision for a specific artifact.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| artifact_id | UUID FK | The Artifact being approved |
| approver_agent_rep_id | UUID FK? | AgentRep approving (if agent) |
| approver_human_user_id | UUID FK? | HumanUser approving (if human) |
| decision | ApprovalDecision | approved, rejected, needs_changes |
| comments | String? | |
| timestamp | Timestamp | |

### Identity Relationships

```
HumanUser 1──* AgentRep
AgentRep 1──* RoleBinding
AgentRep 1──* PermissionGrant
AgentRep 1──* ConnectorBinding
ConnectorBinding 1──* CredentialBinding
FunctionalAgent *──1 Capability
GovernanceAgent (standalone, policy-scoped)
```

---

## 2. Session Context Lock

The Session Context Lock enforces that agents operate within the boundaries of their owning HumanUser's authority.

### Rules

1. **A HumanUser can only invoke their assigned AgentRep.** When a HumanUser starts a session, the system resolves their AgentRep(s) and restricts all actions to that identity.
2. **User Rep Agents cannot command another human's Rep Agent.** AgentRep A (bound to HumanUser X) cannot invoke, delegate to, or modify AgentRep B (bound to HumanUser Y). Cross-human agent delegation is prohibited.
3. **Session context is immutable once locked.** The AgentRep, RoleBinding, PermissionGrant, and ConnectorBinding are resolved at session start and cannot be changed during the session.

### Session Lifecycle

```
HumanUser authenticates
    ↓
Resolve AgentRep(s) for this HumanUser
    ↓
Resolve RoleBinding + PermissionGrant for each AgentRep
    ↓
Resolve ConnectorBindings + CredentialBindings
    ↓
Lock session context (immutable for session duration)
    ↓
AgentRep invokes FunctionalAgents within locked context
    ↓
GovernanceAgents evaluate actions against policies
    ↓
Session ends → context released
```

---

## 3. Capability Resolution Pipeline

Before any tool is invoked, STITCH resolves the full capability chain. This prevents agents from directly calling tools and ensures every action is traceable to an intent.

### Pipeline

```
Intent → Objective → Capability → ExecutionPattern → Resource → Implementation → Execution
```

### Entities

#### Intent

The high-level purpose expressed by a HumanUser or AgentRep.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "create_social_post", "review_compliance" |
| description | String | What this intent means |
| created_at | Timestamp | |

#### Objective

A concrete, measurable goal derived from an Intent.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| intent_id | UUID FK | Parent intent |
| name | String | e.g., "generate_linkedin_post_for_campaign_x" |
| target_metric | String? | Optional success metric |
| deadline | Timestamp? | |
| created_at | Timestamp | |

#### Capability

A named, bounded ability that the platform can perform.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "content_generation", "compliance_review", "analytics_pull" |
| description | String | What this capability does |
| required_permissions | String[] | Permissions needed to invoke |
| created_at | Timestamp | |

#### ExecutionPattern

A reusable recipe for fulfilling a Capability. Encodes the steps, resources, and constraints.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| capability_id | UUID FK | The capability this pattern fulfills |
| name | String | e.g., "llm_draft_generation", "rule_based_compliance_check" |
| pattern_type | Enum | llm_call, api_call, rule_evaluation, workflow |
| config | JSON | Pattern-specific configuration |
| created_at | Timestamp | |

#### Resource

An external or internal resource required by an ExecutionPattern.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "openai_api", "postiz_api", "platform_rules_db" |
| resource_type | Enum | llm, api, database, file_system, renderer |
| access_mechanism | String | "mcp_translate", "direct_internal", "connector" |
| created_at | Timestamp | |

#### Implementation

A concrete implementation of an ExecutionPattern using specific Resources.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| execution_pattern_id | UUID FK | The pattern being implemented |
| resource_id | UUID FK | The resource used |
| implementation_config | JSON | Provider-specific config |
| is_active | Boolean | |
| created_at | Timestamp | |

#### Execution

A single invocation of an Implementation, producing an Artifact.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| implementation_id | UUID FK | The implementation invoked |
| agent_rep_id | UUID FK | The AgentRep that triggered execution |
| artifact_id | UUID FK? | The resulting artifact (null if failed) |
| started_at | Timestamp | |
| completed_at | Timestamp? | |
| status | Enum | pending, running, completed, failed |
| error | String? | |

---

## 4. SPINE — Execution Lineage

SPINE is the execution recording layer. Every Run produces Artifacts with full lineage and replay capability.

### Entities

#### Run

A complete execution context — from intent resolution through artifact production.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | Who initiated this run |
| intent_id | UUID FK | The intent being fulfilled |
| objective_id | UUID FK? | The specific objective |
| capability_id | UUID FK | The capability being invoked |
| execution_pattern_id | UUID FK | The pattern being followed |
| started_at | Timestamp | |
| completed_at | Timestamp? | |
| status | Enum | pending, running, completed, failed, cancelled |
| parent_run_id | UUID FK? | For nested/sub-runs |
| created_at | Timestamp | |

#### Artifact

A tangible output produced by a Run. Artifacts are immutable once created.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| run_id | UUID FK | The Run that produced this artifact |
| artifact_type | Enum | draft, score, approval_decision, analytics_snapshot, report, asset |
| content_ref | String | Reference to stored content (DB record, file path, S3 key) |
| content_hash | String | SHA-256 hash for integrity |
| metadata | JSON | Artifact-specific metadata |
| created_at | Timestamp | |

### Lineage

Every Artifact traces back through: Artifact → Run → Execution → Implementation → ExecutionPattern → Capability → Objective → Intent → AgentRep → HumanUser.

This lineage chain enables:
- **Audit**: Who did what, when, and why
- **Replay**: Reconstruct any execution from its lineage
- **Attribution**: Connect outcomes to decisions and actors

### Replay Index

The replay index enables deterministic re-execution of any Run. It records:
- The ExecutionPattern and Implementation used
- All input parameters (hashed for integrity)
- The Resource state at execution time
- The AgentRep context (RoleBinding, PermissionGrant)
- The resulting Artifact content hash

```
Replay Index Entry:
{
  run_id: UUID,
  execution_pattern_id: UUID,
  implementation_id: UUID,
  input_hash: SHA256,
  resource_state_hash: SHA256,
  agent_context_hash: SHA256,
  artifact_id: UUID,
  artifact_content_hash: SHA256,
  timestamp: ISO8601
}
```

---

## 5. Observability

Observability is first-class in STITCH — not an afterthought.

### Entities

#### Event

A discrete occurrence in the system. Events are immutable and append-only.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_type | String | e.g., "agent.activated", "capability.resolved", "artifact.created" |
| source | String | Component that emitted the event |
| agent_rep_id | UUID FK? | Associated AgentRep |
| run_id | UUID FK? | Associated Run |
| payload | JSON | Event-specific data |
| severity | Enum | info, warning, error, critical |
| timestamp | Timestamp | |

#### AuditRecord

A governance-focused record of a security-relevant action. Derived from Events but with additional policy context.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_id | UUID FK | Source event |
| actor | String | "human:email", "agent_rep:name", "governance_agent:name" |
| action | String | What was done |
| object_type | String | What was acted upon |
| object_id | UUID | |
| policy_decision | Enum | allowed, blocked, escalated |
| policy_reason | String | Why this decision was made |
| timestamp | Timestamp | |

#### LearningSignal

A structured observation derived from execution outcomes, used to improve future capability resolution and execution pattern selection.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| run_id | UUID FK | The Run that generated this signal |
| artifact_id | UUID FK? | The artifact this signal relates to |
| signal_type | Enum | performance, quality, compliance, efficiency |
| metric_name | String | What was measured |
| metric_value | Float | |
| confidence | Enum | low, medium, high |
| recommendation | String | Actionable suggestion |
| created_at | Timestamp | |

---

## 6. Asset Cognition

Asset Cognition is STITCH's model for managing digital assets (images, videos, documents, creative files) with full cognitive awareness.

### Entities

#### Asset

The canonical identity for any digital asset in the platform. Asset Cognition owns this identity — not ResourceSpace.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Human-readable name |
| asset_type | Enum | image, video, document, audio, template, other |
| content_hash | String | SHA-256 for deduplication and integrity |
| mime_type | String | |
| size_bytes | BigInt | |
| storage_ref | String | Where the actual file lives (S3, local, etc.) |
| metadata | JSON | Dimensions, duration, format-specific metadata |
| created_by_agent_rep_id | UUID FK? | Which AgentRep created this |
| created_at | Timestamp | |
| updated_at | Timestamp | |

#### AssetCognitionRecord

Cognitive metadata about an Asset — what the platform "knows" about it.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| asset_id | UUID FK | The asset this cognition applies to |
| cognition_type | Enum | brand_alignment, compliance_status, usage_context, performance_data |
| cognition_data | JSON | The cognitive assessment |
| confidence | Enum | low, medium, high |
| assessed_at | Timestamp | |
| assessed_by_agent_rep_id | UUID FK? | Which AgentRep performed assessment |

#### ResourceSpace (External Reference)

ResourceSpace is an external asset management system referenced by the platform, but it does NOT own canonical asset identity. The platform's Asset entity is the source of truth.

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| asset_id | UUID FK | The canonical Asset this maps to |
| resourcespace_id | String | ResourceSpace's internal ID |
| sync_status | Enum | synced, pending, conflict |
| last_synced_at | Timestamp | |
| created_at | Timestamp | |

### Key Constraint

**ResourceSpace must not own canonical asset identity.** The `Asset` table in the Tanaghum platform is the single source of truth for what an asset is, who created it, and what the platform knows about it. ResourceSpace is an adjacent surface — a storage and retrieval system that the platform references, but never the authoritative identity layer.

---

## 7. MCP Mediation Rules

STITCH enforces strict MCP (Model Context Protocol) mediation for all external access.

### Rules

1. **Agents must not directly access files, databases, analytics APIs, renderers, or enterprise APIs.** All access goes through MCP translator/provider boundaries.
2. **Enterprise API access must go through MCP translator/provider boundaries.** No direct HTTP calls from agents to external services.
3. **Every MCP-mediated call is logged** with the calling AgentRep, the target Resource, the input hash, and the output hash.
4. **MCP providers are registered as Resources** in the capability resolution pipeline. An agent cannot invoke a provider that is not registered.
5. **Credential access is mediated** — agents never see raw credentials. The MCP boundary injects credentials from CredentialBindings.

### Mediation Architecture

```
AgentRep
    ↓ (invokes)
FunctionalAgent
    ↓ (resolves capability)
Capability → ExecutionPattern → Resource
    ↓ (MCP boundary)
MCP Provider (translate/mediate)
    ↓ (authenticated call)
External System (Postiz, LLM, CRM, Analytics, File Storage)
```

### Prohibited Direct Access

| Resource Type | Prohibited | Required Path |
|---|---|---|
| Files | Direct file system read/write | MCP file provider |
| Databases | Direct Prisma/SQL queries | MCP database provider |
| Analytics APIs | Direct HTTP to analytics platforms | MCP analytics provider |
| Renderers | Direct invocation of rendering tools | MCP rendering provider |
| Enterprise APIs | Direct HTTP to CRM, ERP, etc. | MCP enterprise provider |

---

## 8. Department Seed (RevOps Structure)

The Tanaghum department structure aligns with the customer's RevOps organization.

### Departments

| Department | Description |
|---|---|
| Brand & Market Intelligence | Brand voice, positioning, market research, competitive intelligence, trend analysis |
| Demand Generation | Content strategy, SEO, algorithm optimization, reach, hashtag strategy, amplification |
| Conversion | CTA optimization, landing pages, WhatsApp flow, objection handling, sales routing |
| Customer Growth & Retention | Upsell, re-engagement, community, loyalty, nurturing, retention campaigns |
| Revenue Operations | CRM management, reporting, attribution, dashboards, analytics, pipeline visibility |

### Execution Surfaces (Not Canonical Ownership)

These are adjacent components / execution surfaces, not canonical ownership layers:

| Component | Role |
|---|---|
| Production/Design | Creative asset production (images, videos, carousels) |
| Paperclip | Content management / editorial workflow surface |
| ResourceSpace | Asset storage and retrieval (not identity owner) |
| Grafana | Observability dashboards and monitoring |
| Rendering Tools | Image/video rendering pipelines |

---

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Initial creation — STITCH architecture alignment | Sprint 4.5 |
