# Customer-Owned Credential Checklist

## Purpose

This checklist lists the accounts, credentials, permissions, and approvals a customer must provide before optional production connectors can be activated.

No customer credential should be committed to the repository, placed in documentation, pasted into tickets, or shared in chat. Credentials must be entered only through the approved Tanaghum credential setup flow or the agreed deployment secret process.

## Status Legend

| Status | Meaning |
|---|---|
| Missing | Customer has not provided the required account or credential. |
| Configured | Credential is stored for the tenant, but runtime validation may still be required. |
| Validated | Tanaghum has verified the connector can be reached for that tenant. |
| Blocked | Required credential, approval, or execution flag is missing. |
| Customer Action Required | The next step must be done by the customer's admin or provider account owner. |

## Connector Checklist

| Connector | Customer Must Provide | Required Scopes / Access | Data Accessed | Write Actions | Approval Gate | Current Platform Status |
|---|---|---|---|---|---|---|
| AI Provider | Provider, model name, API key, billing-enabled account | Text generation for selected provider | Campaign brief and draft context sent to provider | None to external business systems | Admin setup required | Supported by AI Settings when tenant key is provided |
| Postiz | Postiz base URL, API key, connected social channel/integration ID | Postiz Public API access in the same workspace as connected channel | Channel list, scheduling payload status | Scheduling only when explicitly enabled | Human approval, scheduling flags, M5/write authorization | Channel visibility and payload preparation supported; real scheduling remains gated |
| Meta / Instagram Analytics | Meta Business account, app/OAuth credentials, page/ad account IDs, business Instagram eligibility | Official Meta permissions approved by customer/app review where required | Reach, impressions, clicks, ad/campaign metrics | No direct publishing by default | Connector import approval | Readiness/import path being built around customer-owned credentials |
| YouTube Analytics | Google Cloud project, OAuth client/API access, channel ID | YouTube Analytics read scopes | Views, engagement, traffic, campaign attribution | None by default | Connector import approval | Requires configured credential path before production validation |
| Formaloo | Formaloo workspace/API key, form IDs, field mapping | Form response read/export access | Form completions, lead fields, campaign source | None by default | Import approval | CSV/manual import path supported; official connector requires customer credential |
| GoHighLevel | API key or OAuth app, location/workspace ID, pipeline/stage IDs, tag mapping | Contacts, opportunities, tags depending on selected integration level | Lead profile, attribution, qualification status | CRM write-back only if explicitly authorized | Customer-selected integration level, approval, audit | Handoff/readiness supported; production writes remain customer-configured and gated |
| WhatsApp | Provider account, phone number ID, templates, token, consent process | Message send/read depending on provider | Message status and replies if configured | Outbound messages | Consent, template approval, execution authorization | Blocked until customer provider credentials and policy approval exist |
| Telegram | Bot token, allowed chat/channel IDs, consent/operator rules | Bot API access for approved chats | Message status and replies if configured | Outbound messages | Execution authorization | Blocked until customer token and allowed destinations exist |
| SmartLabs Voice | SmartLabs API key, agent ID, optional voice ID/TTS backend | SmartLabs REST API access | Agent list, conversation response, voice output when authorized | Voice/chat conversation or TTS call | Explicit test/customer authorization | Connector path exists; must be tested with tenant SmartLabs key |
| OpenClaw | Endpoint URL, API key if used, allowed channel scope | Orchestration/channel bridge only | STITCH-approved workflow handoff metadata | No autonomous external writes | STITCH approval and MCP boundary | Not source of truth; production runtime integration not yet complete |
| agentgateway | Gateway endpoint, policy config, routing secrets | Network mediation for approved tools | Tool request/response metadata | Only policy-approved calls | STITCH/SAIF/MCP policy | Not production runtime infrastructure yet |
| AgentScope | Runtime endpoint/config if adopted | Agent runtime and memory isolation configuration | Agent execution metadata | No direct business writes | STITCH approval | Not production runtime infrastructure yet |
| SMTP / Email | SMTP host, port, username, password, from address | Email delivery | Invite/reset email delivery status | Sends account email only | Admin configuration | Required for production email invite/reset delivery |
| Off-Server Backups | S3/compatible bucket or rsync target, credentials, retention policy | Backup target write access | Database backup artifacts | Backup copy only | Operations approval | Local backup supported; off-server copy requires customer/ops target |
| Alerts / Uptime | Webhook/email destination, uptime monitor target | Alert delivery endpoint | Health/readiness events | Alert messages | Operations approval | Monitoring exists; external routing requires destination |

## Per-Connector Setup Evidence

For each connector that will be activated, collect:

| Evidence | Required |
|---|---|
| Customer owner | Name and role of the account owner. |
| Business purpose | Why the connector is needed for this customer. |
| Environment | Sandbox, test, or production. |
| Credential location | Tanaghum credential vault or deployment secret reference only. |
| Validation result | Date, tester, and result of health check or dry run. |
| Data boundary | Which records can be read and which can be written. |
| Approval rule | Who can approve execution. |
| Rollback rule | How to disable the connector. |

## Postiz Requirements

Postiz social channel setup is completed inside Postiz, not inside Tanaghum.

Required:

1. Customer has a Postiz workspace.
2. Customer connects the social channel inside the same Postiz organization that owns the API key.
3. For Instagram/Facebook, the account must satisfy provider requirements such as Meta/Instagram professional or business account eligibility.
4. Customer creates a Postiz Public API key from that same workspace.
5. Admin enters Postiz base URL and API key in Tanaghum.
6. Tanaghum diagnostics must show the channel/integration.
7. Admin selects the channel for scheduling.
8. Scheduling remains blocked until human approval and execution authorization are enabled.

## GoHighLevel Requirements

The customer chooses the integration level.

Possible levels:

- Readiness only: show required fields and payload preview.
- Contact preview: prepare contact payload without writing.
- Sandbox/test write: write to a customer-approved test location only.
- Production write: requires customer approval, mapped tags, mapped pipeline, rollback plan, and audit.

Required before any write:

- Customer-owned API key or OAuth setup.
- Location/workspace ID.
- Tag mapping.
- Pipeline/stage mapping if opportunities are created.
- Consent and data-processing agreement if personal data is sent.
- Approved rollback and duplicate-prevention rule.

## SmartLabs Voice Requirements

SmartLabs belongs to the customer or operating company and must be configured per tenant.

Required:

- SmartLabs API key.
- Agent ID.
- Optional voice ID.
- TTS backend if voice output is used.
- Test lead or approved test conversation.
- Explicit authorization before triggering real customer conversation or call behavior.

Example data needed by Tanaghum:

| Field | Example Format |
|---|---|
| baseUrl | `https://api.thesmartlabs.net` |
| apiKey | Stored securely; never displayed after save |
| agentId | Provider-specific agent ID |
| voiceId | Optional voice ID such as a SmartLabs voice identifier |
| ttsBackend | Optional TTS backend |

## Social Analytics Requirements

Official analytics requires customer/provider approval.

Tanaghum must not scrape social platforms, fake engagement, or claim private algorithm access.

Allowed paths:

- official provider analytics APIs
- Postiz-supported channel metadata where available
- Formaloo/GHL/customer exports
- customer-uploaded CSV or approved connector import
- internal performance records created by approved workflows

## Production Activation Checklist

Before enabling any connector for production use:

- [ ] Customer owner is named.
- [ ] Credential is tenant-owned.
- [ ] Credential is stored securely.
- [ ] Raw secret is not visible in frontend responses.
- [ ] Credential validation passes.
- [ ] Required field mapping is configured.
- [ ] Dry run succeeds with real customer data or approved sample export.
- [ ] Import preview is reviewed by a human.
- [ ] External write action is still blocked unless explicitly approved.
- [ ] Audit record is created for setup, validation, approval, and execution.
- [ ] Rollback/disable action is documented.

## Current Known Blockers

These blockers are expected until the customer provides the needed account or approval:

- Postiz may show zero channels until a supported business/professional social account is connected in the correct Postiz workspace.
- Meta/Instagram analytics requires customer Meta account and approved provider access.
- YouTube analytics requires Google/YouTube credential setup.
- GHL writes require customer-selected integration level, tags, and location/pipeline mapping.
- WhatsApp, Telegram, and SmartLabs execution require customer credentials and explicit authorization.
- Off-server backup copy requires a backup destination.
- External alert routing requires webhook or email destination.
