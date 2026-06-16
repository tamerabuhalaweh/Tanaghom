# DATA_MODEL.md — Database Entities & Relationships

> **Version**: 2.0
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Update Rule**: With migration planning

## Data Stores

| Store | Purpose |
|---|---|
| PostgreSQL | Operational system of record (identity, capability graph, SPINE, asset cognition, observability, content, approvals) |
| Redis | Queue/scheduler (BullMQ), caching, rate limiting |
| Vector Store | Semantic search (brand knowledge, winning examples, lessons) |
| Markdown Files | Agent instructions and durable memory summaries |
| Secrets Manager | Credentials (referenced by CredentialBinding, never stored in DB) |

## STITCH Identity Model

### human_users
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | String | Unique, used for authentication |
| name | String | Display name |
| department_id | UUID FK | Department membership |
| is_active | Boolean | Account status |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### agent_reps
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| human_user_id | UUID FK | The HumanUser this AgentRep represents |
| name | String | Display name (e.g., "Alice's Content Agent") |
| agent_type | Enum | functional, governance |
| is_active | Boolean | Can be deactivated without deleting |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### functional_agents
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique identifier (e.g., "content-writer") |
| capability_id | UUID FK | The capability this agent implements |
| description | String | What this agent does |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### governance_agents
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique identifier (e.g., "security-sentinel") |
| policy_scope | String[] | Which policies this agent enforces |
| veto_authority | Boolean | Can block actions |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### role_bindings
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| role | Enum | admin, cco, department_head, specialist, reviewer, viewer |
| department_id | UUID FK? | Department scope (null = global) |
| granted_at | Timestamp | |
| granted_by | UUID FK | HumanUser who granted this binding |

### permission_grants
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| permission | String | e.g., "campaign:create", "approval:approve" |
| resource_scope | String? | Optional resource constraint |
| granted_at | Timestamp | |
| granted_by | UUID FK | HumanUser who granted this permission |
| expires_at | Timestamp? | Optional expiry |

### connector_bindings
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| agent_rep_id | UUID FK | The AgentRep |
| connector_type | String | postiz, messaging, crm, analytics |
| connector_config | JSON | Connection-specific configuration |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### credential_bindings
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| connector_binding_id | UUID FK | The ConnectorBinding |
| credential_ref | String | Reference to secrets manager (not the secret itself) |
| credential_type | Enum | api_key, oauth_token, service_account |
| expires_at | Timestamp? | Optional credential expiry |
| created_at | Timestamp | |
| updated_at | Timestamp | |

## STITCH Capability Resolution

### intents
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "create_social_post" |
| description | String | What this intent means |
| created_at | Timestamp | |

### objectives
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| intent_id | UUID FK | Parent intent |
| name | String | e.g., "generate_linkedin_post_for_campaign_x" |
| target_metric | String? | Optional success metric |
| deadline | Timestamp? | |
| created_at | Timestamp | |

### capabilities
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "content_generation", "compliance_review" |
| description | String | What this capability does |
| required_permissions | String[] | Permissions needed to invoke |
| created_at | Timestamp | |

### execution_patterns
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| capability_id | UUID FK | The capability this pattern fulfills |
| name | String | e.g., "llm_draft_generation" |
| pattern_type | Enum | llm_call, api_call, rule_evaluation, workflow |
| config | JSON | Pattern-specific configuration |
| created_at | Timestamp | |

### resources
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | e.g., "openai_api", "postiz_api" |
| resource_type | Enum | llm, api, database, file_system, renderer |
| access_mechanism | String | "mcp_translate", "direct_internal", "connector" |
| created_at | Timestamp | |

### implementations
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| execution_pattern_id | UUID FK | The pattern being implemented |
| resource_id | UUID FK | The resource used |
| implementation_config | JSON | Provider-specific config |
| is_active | Boolean | |
| created_at | Timestamp | |

### executions
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

## STITCH SPINE

### runs
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

### artifacts
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| run_id | UUID FK | The Run that produced this artifact |
| artifact_type | Enum | draft, score, approval_decision, analytics_snapshot, report, asset |
| content_ref | String | Reference to stored content |
| content_hash | String | SHA-256 for integrity |
| metadata | JSON | Artifact-specific metadata |
| created_at | Timestamp | |

### replay_index
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| run_id | UUID FK | The Run |
| execution_pattern_id | UUID FK | Pattern used |
| implementation_id | UUID FK | Implementation used |
| input_hash | SHA256 | Hash of all input parameters |
| resource_state_hash | SHA256 | Resource state at execution time |
| agent_context_hash | SHA256 | AgentRep context hash |
| artifact_id | UUID FK | Resulting artifact |
| artifact_content_hash | SHA256 | Artifact content hash |
| timestamp | Timestamp | |

## STITCH Observability

### events
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_type | String | e.g., "agent.activated", "capability.resolved" |
| source | String | Component that emitted the event |
| agent_rep_id | UUID FK? | Associated AgentRep |
| run_id | UUID FK? | Associated Run |
| payload | JSON | Event-specific data |
| severity | Enum | info, warning, error, critical |
| timestamp | Timestamp | |

### audit_records
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_id | UUID FK | Source event |
| actor | String | "human:email", "agent_rep:name" |
| action | String | What was done |
| object_type | String | What was acted upon |
| object_id | UUID | |
| policy_decision | Enum | allowed, blocked, escalated |
| policy_reason | String | Why this decision was made |
| timestamp | Timestamp | |

### learning_signals
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

## STITCH Asset Cognition

### assets
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Human-readable name |
| asset_type | Enum | image, video, document, audio, template, other |
| content_hash | String | SHA-256 for deduplication |
| mime_type | String | |
| size_bytes | BigInt | |
| storage_ref | String | Where the actual file lives |
| metadata | JSON | Dimensions, duration, format-specific |
| created_by_agent_rep_id | UUID FK? | Which AgentRep created this |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### asset_cognition_records
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| asset_id | UUID FK | The asset this cognition applies to |
| cognition_type | Enum | brand_alignment, compliance_status, usage_context, performance_data |
| cognition_data | JSON | The cognitive assessment |
| confidence | Enum | low, medium, high |
| assessed_at | Timestamp | |
| assessed_by_agent_rep_id | UUID FK? | Which AgentRep performed assessment |

### resourcespace_references
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| asset_id | UUID FK | The canonical Asset this maps to |
| resourcespace_id | String | ResourceSpace's internal ID |
| sync_status | Enum | synced, pending, conflict |
| last_synced_at | Timestamp | |
| created_at | Timestamp | |

**Key constraint**: ResourceSpace does NOT own canonical asset identity. The `assets` table is the single source of truth.

## Content & Campaign Entities

### departments (RevOps Structure)
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique — Brand & Market Intelligence, Demand Generation, Conversion, Customer Growth & Retention, Revenue Operations |
| description | String | |

### content_requests
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| requester_id | UUID FK | AgentRep who submitted |
| channel | String | Source messaging channel |
| raw_message | Text | Original request text |
| objective | String | Campaign goal |
| campaign_id | UUID FK | Optional campaign grouping |
| content_type | Enum | campaign, announcement, thought_leadership, product_update, hiring, event, evergreen, reactive |
| risk_category | Enum | low, medium, high |
| target_platforms | String[] | LinkedIn, Instagram, X, etc. |
| deadline | Timestamp | Optional |
| cta | String | Call to action |
| media_refs | JSON | Attached media references |
| status | Enum | See content state machine |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### content_items
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| request_id | UUID FK | Parent content request |
| platform | String | Target platform |
| content_type | Enum | post, carousel, reel, story, thread, video |
| draft_text | Text | Current draft content |
| media_refs | JSON | Media attachments |
| risk_score | Integer | 0–100 |
| risk_reason | Text | Why this risk score |
| reach_score | Integer | Reach Readiness Score (0–100) |
| reach_breakdown | JSON | Scoring component details |
| status | Enum | See content state machine |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### draft_versions
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| content_item_id | UUID FK | Parent content item |
| version_no | Integer | Sequential |
| text | Text | Draft content at this version |
| model_used | String | LLM model identifier |
| prompt_hash | SHA256 | Hash of prompt used |
| created_at | Timestamp | |

### approval_events
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| content_item_id | UUID FK | Content being reviewed |
| reviewer_id | UUID FK | AgentRep or HumanUser who reviewed |
| department | String | Reviewer's department |
| decision | Enum | approved, rejected, needs_changes |
| comments | Text | Reviewer feedback |
| timestamp | Timestamp | |

### schedule_events
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| content_item_id | UUID FK | Content being scheduled |
| postiz_post_id | String | Postiz internal ID |
| integration_id | String | Postiz platform integration ID |
| scheduled_at | Timestamp | When to publish |
| timezone | String | IANA timezone |
| status | Enum | pending, scheduled, published, failed, cancelled |
| retry_count | Integer | Number of retry attempts |
| last_error | Text | Last failure reason |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### analytics_snapshots
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| postiz_post_id | String | Reference to Postiz post |
| platform | String | Platform name |
| collected_at | Timestamp | When data was pulled |
| metric_name | String | likes, comments, shares, impressions, reach |
| metric_value | Float | Numeric value |
| metric_window | Enum | 48h, 7d, 30d |

### learning_insights
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| platform | String | Platform this applies to |
| insight_type | Enum | content_type, hook, cta, timing, format, topic |
| evidence_summary | Text | What data supports this insight |
| confidence | Enum | low, medium, high |
| recommendation | Text | Actionable recommendation |
| created_at | Timestamp | |

### platform_rules
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| platform | String | LinkedIn, Instagram, X, etc. |
| rule_type | String | length, media, hashtags, cadence |
| rule_value | Text | The actual rule |
| source_url | String | Official source |
| source_type | Enum | official_docs, official_policy, internal_benchmark, team_decision |
| confidence | Enum | high, medium, low |
| owner | String | Person responsible |
| last_reviewed_at | Timestamp | |
| next_review_at | Timestamp | |
| agent_instruction | Text | How rule affects drafting |

### audit_logs
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| actor | String | user:email, agent_rep:name, system:name |
| action | String | draft_created, approval_granted, etc. |
| object_type | String | campaign, content_item, approval_event |
| object_id | UUID | Referenced object |
| input_hash | SHA256 | Hash of input |
| output_hash | SHA256 | Hash of output |
| result | String | success, failure, denied |
| policy_decision | String | allowed, blocked_by_policy |
| timestamp | Timestamp | |

### reach_optimization_rules
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| platform | String | |
| rule_type | String | format, hook, timing, hashtag |
| rule_value | Text | |
| source_url | String | |
| source_type | Enum | official_docs, third_party_research, internal_analytics |
| confidence | Enum | high, medium, low |
| owner | String | |
| last_reviewed_at | Timestamp | |
| next_review_at | Timestamp | |

## Entity Relationships

```
human_users 1──* agent_reps
agent_reps 1──* role_bindings
agent_reps 1──* permission_grants
agent_reps 1──* connector_bindings
connector_bindings 1──* credential_bindings
functional_agents *──1 capabilities

intents 1──* objectives
capabilities 1──* execution_patterns
execution_patterns *──* resources (via implementations)
implementations 1──* executions
executions *──1 artifacts

runs 1──* artifacts
runs 1──* replay_index
runs *──1 agent_reps
runs *──1 intents

assets 1──* asset_cognition_records
assets 1──* resourcespace_references

departments 1──* human_users
content_requests 1──* content_items
content_items 1──* draft_versions
content_items 1──* approval_events
content_items 1──* schedule_events
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
| 2026-06-16 | STITCH alignment — identity model, capability resolution, SPINE, observability, asset cognition, RevOps departments | Sprint 4.5 |
