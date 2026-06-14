# DATA_MODEL.md — Database Entities & Relationships

> **Version**: 1.0
> **Date**: 2026-06-14
> **Update Rule**: With migration planning

## Data Stores

| Store | Purpose |
|---|---|
| PostgreSQL | Operational system of record (content, approvals, analytics, audit) |
| Redis | Queue/scheduler (BullMQ), caching, rate limiting |
| Vector Store | Semantic search (brand knowledge, winning examples, lessons) |
| Markdown Files | Agent instructions and durable memory summaries |

## Core Entities

### users
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | String | Unique |
| name | String | Display name |
| department_id | UUID FK | Department membership |
| role | Enum | admin, marketing_owner, reviewer, analyst, agent_operator |
| is_active | Boolean | Account status |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### departments
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | String | Unique (CCO, Brand & Positioning, Acquisition, Conversion & Closing, Growth & Retention, Commercial Operations, Production & Design, Event Operations & Logistics) |
| description | String | |
| primary_approver_id | UUID FK | Default approver for this department |
| backup_approver_id | UUID FK | Backup approver |

### content_requests
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| requester_id | UUID FK | User who submitted |
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
| reviewer_id | UUID FK | User who reviewed |
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
| metric_name | String | likes, comments, shares, impressions, reach, saves, clicks, engagement_rate |
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
| rule_type | String | length, media, hashtags, cadence, link_treatment, safety_policy |
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
| actor | String | user:email, agent:name, system:name |
| action | String | draft_created, approval_granted, post_scheduled, etc. |
| object_type | String | campaign, content_item, approval_event, schedule_event |
| object_id | UUID | Referenced object |
| input_hash | SHA256 | Hash of input |
| output_hash | SHA256 | Hash of output |
| result | String | success, failure, denied |
| policy_decision | String | allowed, blocked_by_policy, required_approval |
| timestamp | Timestamp | |

### reach_optimization_rules
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| platform | String | |
| rule_type | String | format, hook, timing, hashtag, engagement_signal |
| rule_value | Text | |
| source_url | String | |
| source_type | Enum | official_docs, third_party_research, internal_analytics |
| confidence | Enum | high, medium, low |
| owner | String | |
| last_reviewed_at | Timestamp | |
| next_review_at | Timestamp | |

## Entity Relationships

```
departments 1──* users
content_requests 1──* content_items
content_items 1──* draft_versions
content_items 1──* approval_events
content_items 1──* schedule_events
schedule_events 1──* analytics_snapshots
users 1──* approval_events (as reviewer)
users 1──* content_requests (as requester)
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
