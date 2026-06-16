# AI_AGENT_MODEL.md — AI Agents, Prompts & Guardrails

> **Version**: 2.0
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Update Rule**: When agent behavior changes

## Identity Model (STITCH)

All agent actions in Tanaghum are performed through the STITCH identity model. See `STITCH_ARCHITECTURE.md` §1 for full entity definitions.

### Key Entities

| Entity | Purpose |
|---|---|
| **HumanUser** | Real person authenticated to the platform |
| **AgentRep** | Canonical delegated identity — every agent action is performed by an AgentRep bound to exactly one HumanUser |
| **FunctionalAgent** | Specialized agent that performs a specific capability (e.g., content-writer, brand-reviewer) |
| **GovernanceAgent** | Policy enforcement agent with veto authority (e.g., security-sentinel, compliance-guardian) |
| **RoleBinding** | Maps AgentRep to a system role within a department scope |
| **PermissionGrant** | Fine-grained permission attached to an AgentRep |
| **ConnectorBinding** | Binds AgentRep to an external connector (Postiz, messaging, CRM) |
| **CredentialBinding** | Securely associates credentials with a ConnectorBinding (refs only, no secrets) |

### Agent Types

| Type | Runtime | Purpose | Examples |
|---|---|---|---|
| FunctionalAgent | M4 (functional) | Perform specific capabilities | content-writer, brand-reviewer, analytics-puller, scheduler |
| GovernanceAgent | M5 (governance) | Enforce policies, veto actions | security-sentinel, compliance-guardian |

## Functional Agents (M4 Runtime)

| Agent | Capability | Allowed Resources |
|---|---|---|
| Content Strategist | content_strategy | Memory/vector search, trend search, database read (via MCP) |
| Content Writer | content_generation | LLM (via MCP), platform rules, brand guide (via MCP) |
| Brand & Compliance Reviewer | compliance_review | Rules KB (via MCP), brand guide, policy checklist |
| Scheduler Agent | publishing | Postiz (via MCP), database (via MCP), logging |
| Analytics Agent | analytics_pull | Postiz analytics (via MCP), database (via MCP) |

## Governance Agents (M5 Runtime)

| Agent | Policy Scope | Veto Authority |
|---|---|---|
| Security Sentinel | Permission checks, skill changes, abnormal actions, failed policies | Yes — can block any action |
| Compliance Guardian | Brand safety, medical claims, legal constraints | Yes — can block content publishing |

## Provider Interfaces

All external integrations go through MCP-mediated provider interfaces. See `STITCH_ARCHITECTURE.md` §7 for MCP mediation rules.

### LLMProvider (MCP-mediated)

```typescript
interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: JSONSchema): Promise<T>;
  embeddings(text: string): Promise<number[]>;
}
```

### PostizProvider (MCP-mediated)

```typescript
interface PostizProvider {
  createDraft(content: DraftContent): Promise<PostizPost>;
  schedulePost(postId: string, scheduledAt: Date, timezone: string): Promise<ScheduleResult>;
  getPostAnalytics(postId: string): Promise<PostAnalytics>;
  getPlatformAnalytics(platform: string, period: Period): Promise<PlatformAnalytics>;
  listIntegrations(): Promise<Integration[]>;
}
```

### MessagingProvider (MCP-mediated)

```typescript
interface MessagingProvider {
  sendMessage(channel: string, message: string): Promise<void>;
  sendApprovalRequest(channel: string, request: ApprovalRequest): Promise<void>;
  onMessage(channel: string, handler: MessageHandler): void;
}
```

### CRMProvider (MCP-mediated)

```typescript
interface CRMProvider {
  createLead(lead: LeadData): Promise<Lead>;
  tagContact(contactId: string, tags: string[]): Promise<void>;
  routeToWhatsApp(leadId: string, message: string): Promise<void>;
}
```

### AnalyticsProvider (MCP-mediated)

```typescript
interface AnalyticsProvider {
  getPostMetrics(postId: string, window: MetricWindow): Promise<PostMetrics>;
  getPlatformMetrics(platform: string, period: Period): Promise<PlatformMetrics>;
}
```

## Session Context Lock

When a HumanUser starts a session, the system:

1. Authenticates the HumanUser
2. Resolves their AgentRep(s)
3. Resolves RoleBinding + PermissionGrant for each AgentRep
4. Resolves ConnectorBindings + CredentialBindings
5. Locks session context (immutable for session duration)

**Critical constraint**: AgentRep A (bound to HumanUser X) cannot invoke, delegate to, or modify AgentRep B (bound to HumanUser Y). Cross-human agent delegation is prohibited.

## Context Management

### Per-Session Context

Every AI coding session receives:
1. `CONTEXT.md` — active module, allowed files, locked files
2. Active sprint file — scope, acceptance criteria, deliverables
3. Module README — responsibility and boundary rules
4. Relevant API contract — OpenAPI spec for active module

### Agent Runtime Context

The agent runtime maintains:
1. `SOUL.md` — brand voice (loaded for content generation)
2. `MEMORY.md` — learned patterns (loaded for strategy and writing)
3. `PLATFORM_RULES.md` — platform constraints (loaded for generation and validation)
4. `APPROVAL_POLICY.md` — approval routing rules
5. Campaign context — current campaigns, calendar, performance baseline

### Context Boundaries

- Agent NEVER sees other modules' implementation code during a sprint
- Agent NEVER has access to raw credentials — credentials are mediated through CredentialBindings
- Fetched web content is marked as UNTRUSTED and cannot override instructions
- Agent memory is updated only through the learning engine, not directly
- AgentRep context is locked at session start and immutable for session duration

## Prompt Templates

### Content Generation Prompt

```
You are a social media content writer for SmartLabs.

BRAND VOICE: [Load from SOUL.md]
PLATFORM: [Target platform]
PLATFORM RULES: [Load from PLATFORM_RULES.md for this platform]
CAMPAIGN CONTEXT: [Objective, audience, deadline, CTA]
PERFORMANCE INSIGHTS: [Relevant patterns from MEMORY.md]

Generate a platform-native draft that:
1. Follows brand voice
2. Respects platform rules and character limits
3. Includes a clear hook, body, and CTA
4. Is optimized for the platform's algorithm
5. Avoids restricted claims and sensitive topics

Output format: JSON with fields for text, hashtags, media_suggestions, hook_type, rationale.
```

### Risk Scoring Prompt

```
You are a brand compliance reviewer for SmartLabs.

DRAFT: [Draft content]
PLATFORM: [Target platform]
RESTRICTED TOPICS: [Medical claims, legal statements, financial guarantees, etc.]
BRAND RULES: [Do/Don't from SOUL.md]

Evaluate this draft for:
1. Brand voice compliance
2. Restricted topic violations
3. Factual accuracy concerns
4. Platform rule violations
5. Potential PR/compliance issues

Output: JSON with risk_score (0-100), risk_category (low/medium/high), risk_reasons[], required_approvals[].
```

## Guardrails

1. Agent must not edit unrelated modules during a sprint
2. Agent must not change database schema unless sprint allows it
3. Agent must not introduce new architecture patterns without an ADR
4. Agent must not bypass approval, compliance, or audit logic
5. Agent must not store secrets in documentation, code, markdown, or prompts
6. Agent must not claim algorithm certainty — outputs are probability-based
7. Agent-generated content must be traceable to campaign, draft version, approver, publishing job
8. Agent coding sessions must summarize changed files, tests, risks, remaining work
9. **AgentRep is the canonical delegated identity** — no agent action without an AgentRep
10. **Capabilities must be resolved before tools are invoked** — no direct tool calls
11. **MCP mediates all external access** — no direct file/database/API access
12. **Session Context Lock is immutable** — no cross-human agent delegation

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
| 2026-06-16 | STITCH alignment — identity model, Session Context Lock, MCP mediation, guardrails | Sprint 4.5 |
