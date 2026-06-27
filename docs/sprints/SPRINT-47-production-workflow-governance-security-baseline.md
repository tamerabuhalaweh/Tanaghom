# Sprint 47 — Production Workflow Governance + SaaS Credential Readiness + Security Baseline

## Status

Implemented for review.

## Production Intent

Sprint 47 moves the Commercial/Social platform from preparation screens toward production SaaS foundations:

- customer-owned credentials only
- tenant vault before environment fallback
- persisted governance links for publishing packages
- request correlation for production support
- Redis-backed rate limiting and token revocation
- safer default API security headers and body limits

## Completed

### Publishing Package Governance

Publishing package creation now persists and links:

- SAIF decision record
- capability resolution
- MCP mediation request
- MCP mediation allow decision for prepare-only scheduling package creation

The package stores:

- `saif_decision_record_id`
- `capability_resolution_id`
- `mcp_mediation_request_id`

This means downstream Postiz payload and scheduling gates can read governance IDs from the package instead of relying on manual internal ID entry.

### SaaS Credential Readiness

GoHighLevel now resolves runtime credentials in this order:

1. customer tenant vault credential
2. no credential

Server-wide environment GHL credentials are disabled by default. They are used only if `ALLOW_GLOBAL_GHL_CREDENTIALS=true`, which should not be used for multi-tenant SaaS unless there is a deliberate enterprise-hosted deployment decision.

Integration setup wording now says customer/tenant credential instead of implying a shared platform credential.

### Security Baseline

Added:

- `X-Request-Id` request correlation
- request completion logging with request ID
- response error bodies include request ID
- origin guard for state-changing browser requests
- tighter default JSON body limit via `REQUEST_BODY_LIMIT`, default `1mb`
- Helmet CSP/referrer hardening
- Redis-backed rate limiting in production
- in-memory rate limit fallback only outside production
- JWT `jti`
- Redis-backed logout/token revocation
- global revoked-token enforcement before protected route handlers

## Tests Added

- publishing governance creates SAIF/capability/MCP links
- JWTs include revocable token IDs
- revoked JWTs are rejected
- GHL ignores server-wide env credentials unless explicitly enabled
- GHL uses tenant vault credentials
- GHL payloads do not fall back to server-wide location IDs

## Still Not Production Complete

These are not solved by Sprint 47:

- real Postiz channel completion still depends on eligible customer social accounts and Postiz provider OAuth configuration
- real Postiz scheduling still requires customer channel ID plus explicit external execution/M5 flags
- real GHL write still requires customer tenant GHL credentials and explicit runtime flags
- WhatsApp, Telegram, and voice connectors still require customer credentials plus execution-specific product workflows
- full SaaS tenant/org/membership model is still basic and needs deeper product design
- MFA is not implemented yet
- full CSP must be reviewed once frontend and backend deployment domains are finalized
- durable LangGraph workflow engine is not yet the system-of-record for every workflow
- agentgateway and AgentScope are not production runtime dependencies yet
