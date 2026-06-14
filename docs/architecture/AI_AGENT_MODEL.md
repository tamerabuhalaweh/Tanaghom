# AI_AGENT_MODEL.md — AI Agents, Prompts & Guardrails

> **Version**: 1.0
> **Date**: 2026-06-14
> **Update Rule**: When agent behavior changes

## Agent Roles

| Agent | Purpose | Allowed Tools |
|---|---|---|
| Coordinator | Routes requests, enforces workflow state, delegates tasks | Messaging, database, sub-agent calls |
| Content Strategist | Creates themes, calendars, topic angles, weekly plans | Memory/vector search, trend search, database read |
| Content Writer | Creates platform-native drafts and revisions | LLM, platform rules, brand guide, database write |
| Brand & Compliance Reviewer | Checks tone, risks, claims, restricted topics, platform fit | Rules KB, brand guide, policy checklist |
| Scheduler Agent | Creates drafts/schedules in Postiz after approval only | Postiz CLI/API, database, logging |
| Analytics Agent | Pulls analytics, writes structured insights | Postiz analytics API/CLI, database, memory writer |
| Security Sentinel | Checks permissions, skill changes, abnormal actions, failed policies | Logs, config, alerting. No publishing tools. |

## Provider Interfaces

All external integrations use provider interfaces. This enables:
- Mock providers for development and testing
- Easy provider swapping without business logic changes
- Security review before activating real implementations

### LLMProvider

```typescript
interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: JSONSchema): Promise<T>;
  embeddings(text: string): Promise<number[]>;
}
```

### PostizProvider

```typescript
interface PostizProvider {
  createDraft(content: DraftContent): Promise<PostizPost>;
  schedulePost(postId: string, scheduledAt: Date, timezone: string): Promise<ScheduleResult>;
  getPostAnalytics(postId: string): Promise<PostAnalytics>;
  getPlatformAnalytics(platform: string, period: Period): Promise<PlatformAnalytics>;
  listIntegrations(): Promise<Integration[]>;
}
```

### MessagingProvider

```typescript
interface MessagingProvider {
  sendMessage(channel: string, message: string): Promise<void>;
  sendApprovalRequest(channel: string, request: ApprovalRequest): Promise<void>;
  onMessage(channel: string, handler: MessageHandler): void;
}
```

### CRMProvider

```typescript
interface CRMProvider {
  createLead(lead: LeadData): Promise<Lead>;
  tagContact(contactId: string, tags: string[]): Promise<void>;
  routeToWhatsApp(leadId: string, message: string): Promise<void>;
}
```

### AnalyticsProvider

```typescript
interface AnalyticsProvider {
  getPostMetrics(postId: string, window: MetricWindow): Promise<PostMetrics>;
  getPlatformMetrics(platform: string, period: Period): Promise<PlatformMetrics>;
}
```

## Context Management

### Per-Session Context

Every AI coding session receives:
1. `CONTEXT.md` — active module, allowed files, locked files
2. Active sprint file — scope, acceptance criteria, deliverables
3. Module README — responsibility and boundary rules
4. Relevant API contract — OpenAPI spec for active module

### Agent Runtime Context

The OpenClaw agent runtime maintains:
1. `SOUL.md` — brand voice (loaded for content generation)
2. `MEMORY.md` — learned patterns (loaded for strategy and writing)
3. `PLATFORM_RULES.md` — platform constraints (loaded for generation and validation)
4. `APPROVAL_POLICY.md` — approval routing rules
5. Campaign context — current campaigns, calendar, performance baseline

### Context Boundaries

- Agent NEVER sees other modules' implementation code during a sprint
- Agent NEVER has access to raw credentials
- Fetched web content is marked as UNTRUSTED and cannot override instructions
- Agent memory is updated only through the learning engine, not directly

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

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
