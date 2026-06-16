# SECURITY_MODEL.md — Auth, Permissions & AI Safety

> **Version**: 2.0
> **Date**: 2026-06-16
> **Sprint**: 4.5 — STITCH Alignment
> **Update Rule**: With security decisions

## Authentication

- JWT-based authentication for API endpoints
- Session tokens with configurable expiry (default: 24h)
- Refresh token rotation for persistent sessions
- Password hashing: bcrypt with minimum 12 rounds
- MFA: Recommended for admin and department head roles (future phase)

## Authorization (STITCH Identity Model)

Role-based access control (RBAC) with department-level scoping, mediated through the STITCH identity model:

```
HumanUser → AgentRep → RoleBinding → PermissionGrant → Handler
```

All agent actions are performed by AgentReps bound to HumanUsers. See `STITCH_ARCHITECTURE.md` §1 for full identity model.

### Permission Levels

| Level | Description | Example |
|---|---|---|
| Read | View data only | Viewer viewing analytics |
| Write | Create/edit own data | Specialist editing drafts |
| Approve | Make approval decisions | Department Head approving posts |
| Admin | Configure system | Admin rotating keys |
| System | Automated agent actions | FunctionalAgent creating drafts (scoped via AgentRep) |

### Session Context Lock

When a HumanUser starts a session, the system resolves their AgentRep(s), RoleBindings, and PermissionGrants, then locks the session context. This lock is immutable for the session duration. See `STITCH_ARCHITECTURE.md` §2.

## Agent Security (STITCH)

### MCP Mediation

All external access is mediated through MCP provider boundaries. Agents must not directly access files, databases, analytics APIs, renderers, or enterprise APIs. See `STITCH_ARCHITECTURE.md` §7.

### M4/M5 Runtime Separation

FunctionalAgents (M4) and GovernanceAgents (M5) run in separate runtime contexts. GovernanceAgents can veto FunctionalAgent actions. See ADR-007.

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
| 2026-06-16 | STITCH alignment — identity model, Session Context Lock, MCP mediation, M4/M5 | Sprint 4.5 |
