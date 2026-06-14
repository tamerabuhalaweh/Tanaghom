# SRS.md — Software Requirements Specification

> **Version**: 1.0
> **Date**: 2026-06-14
> **Status**: Draft
> **Owner**: Product Owner

## Functional Requirements

### Content Intake

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | System receives content requests from one approved messaging interface | Must |
| FR-002 | System supports structured intake: topic, goal, audience, platforms, deadline, CTA, source links, media | Must |
| FR-003 | System classifies requests by content type and risk category | Must |

### Strategy

| ID | Requirement | Priority |
|---|---|---|
| FR-004 | System maintains a content calendar with weekly themes, campaigns, cadence | Must |
| FR-005 | System suggests weekly content plans based on priorities and performance | Should |

### Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-006 | System generates distinct platform-native drafts (not cross-posted identical text) | Must |
| FR-007 | Each draft includes objective, audience, CTA, hashtags, format, schedule, rationale | Must |
| FR-008 | System supports revision requests and retains previous versions | Must |

### Brand Governance

| ID | Requirement | Priority |
|---|---|---|
| FR-009 | System validates drafts against brand voice, restricted claims, prohibited terms, platform rules | Must |
| FR-010 | System assigns risk score to every draft with explanation | Must |

### Approval

| ID | Requirement | Priority |
|---|---|---|
| FR-011 | System requires human approval before scheduling any post in MVP | Must |
| FR-012 | System allows approve, reject, edit, request-changes actions | Must |
| FR-013 | System sends reminders for pending approvals based on configurable SLA | Should |

### Publishing

| ID | Requirement | Priority |
|---|---|---|
| FR-014 | System connects to Postiz via CLI or Public API using scoped credentials | Must |
| FR-015 | System lists connected Postiz integrations and maps to internal records | Must |
| FR-016 | System creates Postiz drafts by default for review workflows | Must |
| FR-017 | System schedules approved drafts with ISO 8601 timestamps and timezone awareness | Must |
| FR-018 | System records Postiz post IDs and integration IDs for analytics | Must |
| FR-019 | System retries with exponential backoff for API 5xx and rate-limit responses | Must |

### Analytics

| ID | Requirement | Priority |
|---|---|---|
| FR-020 | System pulls post-level analytics 48h and 7 days after publication | Must |
| FR-021 | System pulls platform-level analytics weekly | Should |

### Learning

| ID | Requirement | Priority |
|---|---|---|
| FR-022 | System generates structured insights by platform, content type, CTA, timing, topic | Must |
| FR-023 | System updates agent memory with concise lessons, not raw analytics | Must |

### Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-024 | System sends weekly performance summary and proposed content plan | Should |

### Audit

| ID | Requirement | Priority |
|---|---|---|
| FR-026 | System logs all agent actions, approvals, API calls, errors, state transitions | Must |

## Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Availability | Postiz and workflow API available during publishing windows | ≥ 99% |
| Reliability | Failed publishing retried and escalated | 3 retries + exponential backoff |
| Performance | Draft generation response time | < 60s for 3-platform draft |
| Security | No plaintext secrets in code, logs, or prompts | 0 leaks |
| Auditability | Every external action has audit event | 100% |
| Maintainability | Platform rules reviewed on schedule | Monthly |
| Cost Control | LLM calls tracked by task and platform | Per-post cost report |
| Scalability | Adding platforms requires config + rules entry only | No major redesign |
| Portability | Containerized services, documented env vars | Reproducible deployment |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
