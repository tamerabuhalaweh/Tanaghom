# SECURITY_POLICY.md — Operational Security Constraints

> **Purpose**: Define security controls, secrets management, agent permissions, and incident response.
> **Owner**: Security/Admin Owner
> **Review Cadence**: Monthly or after any security incident

## Core Principle

Treat the AI agent as an operational identity that can act, not a passive assistant. Assume the model can be manipulated by users, web content, comments, and fetched documents. Controls must limit blast radius even if the agent makes a bad decision.

## Secrets Management

### Rules

- **NEVER** store secrets in source code, markdown files, logs, commit messages, or prompts
- API keys stored in `.env` file (local dev) or secrets manager (production)
- `.env` is in `.gitignore` — never committed
- `.env.example` contains placeholder values only
- Secrets rotated on schedule: LLM keys (90 days), Postiz keys (90 days), messaging tokens (90 days), database passwords (180 days)
- Immediate rotation after any suspected compromise

### Secret Inventory

| Secret | Storage | Rotation | Owner |
|---|---|---|---|
| PostgreSQL password | `.env` / secrets manager | 180 days | Security Admin |
| Redis password | `.env` / secrets manager | 180 days | Security Admin |
| Postiz API key | `.env` / secrets manager | 90 days | Security Admin |
| LLM provider API key | `.env` / secrets manager | 90 days | Security Admin |
| Messaging channel token | `.env` / secrets manager | 90 days | Security Admin |
| JWT signing key | `.env` / secrets manager | 90 days | Security Admin |

## Agent Tool Allowlist

The agent may ONLY use these tools:

| Tool | Purpose | Scope |
|---|---|---|
| Postiz CLI/API | Draft creation, scheduling, analytics | Scoped credentials, no admin access |
| Database (via service) | Read/write operational data | Parameterized queries only |
| Messaging (via service) | Send notifications | Approved channels only |
| Web search | Trend research | Approved endpoints only |
| Logging | Audit trail | Write-only, no read of other logs |

### Explicitly Denied

- Shell command execution (unless sandboxed and approved)
- Direct filesystem access outside workspace
- Network access to unapproved endpoints
- Credential management (secrets rotation requires human)
- Installing skills/plugins without owner approval
- Sending messages to unapproved channels

## Skill/Plugin Installation Policy

- **Default**: BLOCKED. No skill or plugin may be installed without owner approval.
- **Process**: Request → Code review → Security checklist → Owner approval → Install in sandbox → Test → Enable
- **Pinned versions**: All skills pinned to specific versions. No auto-updates.
- **Verified sources only**: No skills from unverified registries.
- **Sandbox**: Installed skills run in sandbox mode with limited permissions.

## Prompt Injection Defense

### Threat Model

Untrusted content sources:
- Web pages fetched during research
- Social media comments and DMs
- User-provided links and attachments
- Competitor content analyzed for trends

### Controls

1. **Instruction hierarchy**: System prompt > workspace files > user input > fetched content
2. **Data boundary**: All fetched content is DATA, never INSTRUCTIONS
3. **No direct execution**: Content from untrusted sources cannot trigger tool calls
4. **Approval gate**: All outputs pass through human approval before external action
5. **Content sanitization**: Strip instruction-like patterns from fetched content before LLM processing

### Testing

- Monthly prompt injection test suite
- Test cases: instruction override attempts, tool call injection, data exfiltration attempts
- Results documented in security review log

## Audit Logging

Every external action must log:

```
{
  "actor": "user:john | agent:coordinator | system:scheduler",
  "action": "draft_created | approval_granted | post_scheduled | analytics_pulled",
  "object_type": "campaign | content_item | approval_event | schedule_event",
  "object_id": "uuid",
  "input_hash": "sha256 of input",
  "output_hash": "sha256 of output",
  "timestamp": "ISO 8601",
  "result": "success | failure | denied",
  "policy_decision": "allowed | blocked_by_policy | required_approval"
}
```

## Network Egress

| Destination | Allowed | Purpose |
|---|---|---|
| Postiz API | Yes | Publishing, scheduling, analytics |
| LLM provider | Yes | Text generation, embeddings |
| Messaging provider | Yes | WhatsApp/Telegram/Slack |
| Approved search endpoints | Yes | Trend research |
| All other external | No | Blocked by default |

## Backup & Recovery

| Asset | Frequency | Retention | Tested |
|---|---|---|---|
| PostgreSQL | Daily | 30 days | Monthly restore test |
| Redis | Daily | 7 days | Monthly restore test |
| Workspace files (MEMORY.md, etc.) | Daily | 30 days | — |
| Platform rules | On change | Indefinite | — |

## Kill Switch

**Triggers**:
- Suspected agent compromise
- Unauthorized post published
- Secret exposure detected
- Malicious skill installed

**Actions**:
1. Disable OpenClaw tool access immediately
2. Revoke all API keys
3. Alert Security/Admin Owner
4. Preserve audit logs for forensics
5. Notify affected stakeholders

**Procedure**:
1. Set `AGENT_ENABLED=false` in environment
2. Revoke Postiz API key
3. Revoke messaging channel token
4. Rotate database password
5. Document incident in security log

## Incident Response Playbook

| Incident | Immediate Action | Follow-Up |
|---|---|---|
| Wrong post scheduled | Cancel in Postiz, notify owner | Review approval logs |
| Wrong post published | Delete/remove if possible, issue correction | Incident report, policy update |
| Agent compromise suspected | Disable agent, revoke credentials | Forensic review of logs |
| Postiz unavailable | Pause scheduling, queue drafts | Root-cause, restore |
| LLM outage | Switch fallback or pause generation | Provider review |
| Secret exposed | Rotate immediately | Audit log review, access check |

## Security Checklist (Per Sprint)

- [ ] No secrets in committed files
- [ ] Agent tool scope is correct for this sprint
- [ ] New API endpoints have authentication
- [ ] New database queries use parameterized inputs
- [ ] Approval logic cannot be bypassed
- [ ] Audit logging covers new external actions
- [ ] Prompt injection test cases updated if needed

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
