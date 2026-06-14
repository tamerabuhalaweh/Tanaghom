# SECURITY_MODEL.md — Auth, Permissions & AI Safety

> **Version**: 1.0
> **Date**: 2026-06-14
> **Update Rule**: With security decisions

## Authentication

- JWT-based authentication for API endpoints
- Session tokens with configurable expiry (default: 24h)
- Refresh token rotation for persistent sessions
- Password hashing: bcrypt with minimum 12 rounds
- MFA: Recommended for admin and marketing owner roles (future phase)

## Authorization

Role-based access control (RBAC) with department-level scoping:

```
Request → JWT Verification → Role Check → Department Scope → Permission Check → Handler
```

### Permission Levels

| Level | Description | Example |
|---|---|---|
| Read | View data only | Analyst viewing analytics |
| Write | Create/edit own data | Content Reviewer editing drafts |
| Approve | Make approval decisions | Marketing Owner approving posts |
| Admin | Configure system | Security Admin rotating keys |
| System | Automated agent actions | AI Agent creating drafts (scoped) |

## Agent Security

### Threat Model

| Threat | Source | Mitigation |
|---|---|---|
| Prompt injection | Web pages, comments, DMs, attachments | Untrusted content boundary, instruction hierarchy |
| Insecure output handling | LLM returns malformed/unsafe output | Schema validation, strict command builders |
| Supply chain attack | Malicious skill/plugin | Install policy, code review, pinned versions |
| Excessive agency | Agent acts beyond scope | Tool allowlist, approval gates, audit logging |
| Secret disclosure | Agent leaks credentials in content | DLP checks, no secrets in workspace, redaction |
| Cost spike | Agent burns tokens excessively | Budget alerts, heartbeat cadence, max tokens |

### Instruction Hierarchy

```
System Prompt (immutable)
    ↓
Workspace Files (AGENTS.md, SECURITY_POLICY.md, APPROVAL_POLICY.md)
    ↓
CONTEXT.md (sprint-scoped)
    ↓
User Input (authenticated)
    ↓
Fetched Content (UNTRUSTED DATA ONLY — never instructions)
```

### Tool Scoping

The agent operates with least-privilege tool access:
- Only tools listed in the allowlist are available
- Tool permissions scoped to the active sprint/module
- Sensitive operations (publish, delete, modify credentials) require policy confirmation
- All tool calls logged with input/output hashes

## Data Classification

| Classification | Examples | Handling |
|---|---|---|
| Public | Published social media posts, brand voice | Can be in markdown files |
| Internal | Campaign drafts, analytics, approval decisions | Database only, API access required |
| Confidential | API keys, database passwords, JWT secrets | Secrets manager / .env only |
| Restricted | Patient data, legal statements | Never stored, processed only with approval |

## Audit Requirements

Every security-relevant action must be logged:
- Authentication events (login, logout, token refresh)
- Authorization failures (permission denied)
- Content state transitions (draft → approved → scheduled → published)
- Secret access (key rotation, credential read)
- Agent tool calls (what was called, with what inputs)
- Approval decisions (who decided, what, when)

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
