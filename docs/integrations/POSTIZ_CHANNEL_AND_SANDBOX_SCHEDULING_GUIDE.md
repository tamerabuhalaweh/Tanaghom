# Postiz Channel Connection and Sandbox Scheduling Guide

## Current Product Rule

Tanaghum owns campaign strategy, AI drafting, scoring, approval, evidence, and scheduling package preparation.
Postiz owns social provider login, connected social channels, provider tokens, and the scheduling API surface.

Tanaghum must never store or display raw Postiz/provider tokens.

## Required Admin Steps

0. For self-hosted Postiz, configure provider app credentials before starting OAuth.
   - Instagram/Facebook require Meta/Facebook app credentials in the Postiz deployment.
   - At minimum, the Postiz container must have a provider client/app ID and secret for the platform.
   - If Tanaghum diagnostics reports `clientIdStatus: missing`, the Postiz OAuth URL is not usable yet.
1. Open the Postiz workspace used for this tenant.
2. Connect the social channel inside Postiz.
   - For Instagram/Facebook, complete the provider OAuth flow in the same Postiz organization that owns the API key.
   - The social account must satisfy provider requirements, such as a valid Meta/Instagram professional or business setup when required by the provider.
3. In Postiz, open Settings > Developers > Public API and copy an API key from the same organization.
4. In Tanaghum, open Credentials.
5. Configure Postiz Sandbox API Key:
   - `baseUrl`: Postiz workspace URL.
   - `apiKey`: Postiz Public API key.
   - `integrationId`: leave empty until Tanaghum can list channels.
6. Click Run Diagnostics in the Postiz Social Channels section.
7. If a channel is visible, click Use for Scheduling.
8. Open Scheduling & Review, prepare the scheduling payload from an approved package, and review the gate status.

## How Tanaghum Reads Channels

Tanaghum calls the Postiz Public API integrations endpoint using the tenant Postiz API key.
Postiz calls connected accounts "channels" in the UI and "integrations" in the API.

If Postiz returns zero integrations, Tanaghum must show zero channels. Do not create fake channel rows in Tanaghum.

Most common causes:

- The API key belongs to a different Postiz organization than the one where the channel was connected.
- The provider OAuth flow was started but not completed.
- Provider app credentials or permissions are incomplete inside Postiz. For Instagram/Facebook, Tanaghum diagnostics will show this when Postiz returns an OAuth URL without a provider `client_id`.
- The connected social account does not meet provider requirements.

## Sandbox Scheduling Gates

Tanaghum can prepare a Postiz payload without external execution.

Actual sandbox scheduling requires all of the following:

- Postiz base URL configured.
- Postiz API key configured.
- A visible Postiz channel selected in Tanaghum.
- `DEMO_MODE` not set to `true`.
- `EXTERNAL_EXECUTION_ENABLED=true`.
- `POSTIZ_SANDBOX_SCHEDULING_ENABLED=true`.
- `POSTIZ_LIVE_ENABLED=true`.
- Human-approved publishing package.
- Approved capability resolution for the scheduling operation.
- Approved MCP mediation request with an allow decision.
- Explicit M5 write-execution authorization for the sandbox scheduling action.

`POSTIZ_LIVE_ENABLED` currently means "allow Postiz API scheduling execution." It does not mean uncontrolled production publishing. The product path must still use sandbox/test channels unless production authorization is explicitly approved.

## Safety Rules

- Do not call Postiz `now` publishing from Tanaghum.
- Do not schedule to customer production channels without explicit authorization.
- Do not expose raw Postiz API keys or provider OAuth tokens to the frontend.
- Do not bypass Tanaghum approval or audit records.
- Do not enable M5 write execution for this workflow until the sandbox channel, approval, capability resolution, MCP mediation, and operator authorization are all complete.

## Useful Postiz Documentation

- Public API overview: https://docs.postiz.com/public-api/introduction
- Create/schedule posts: https://docs.postiz.com/public-api/posts/create
