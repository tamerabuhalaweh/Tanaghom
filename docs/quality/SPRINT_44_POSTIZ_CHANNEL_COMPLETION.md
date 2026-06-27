# Sprint 44: Postiz Channel Completion Path

## Objective

Make the Postiz channel path visible and diagnosable inside Tanaghum so a tenant admin can understand exactly what is required before sandbox scheduling can target a social channel.

## Completed

- Added backend Postiz diagnostics contract at `GET /postiz/diagnostics`.
- Validates the configured Postiz API key through the Postiz public connection endpoint.
- Lists connected Postiz integrations/channels through the Postiz public integrations endpoint.
- Requests a provider OAuth handoff URL through Postiz for the selected platform.
- Supports Postiz refresh handoff for existing channels.
- Returns safe, token-free diagnostics:
  - Postiz server URL status
  - API key validation status
  - OAuth URL readiness
  - connected channel count
  - selected scheduling channel status
  - sandbox scheduling gate status
- Added admin UI diagnostics in `Credentials & Integration Setup`.
- Fixed Command Center Postiz reachability to use the backend `serverReachable` workflow fact instead of the stale `reachable` field.
- Added channel-completion tests for OAuth-ready, provider-setup, and selected-channel states.

## Current Live Finding

The live Postiz API key can query Postiz and request an Instagram OAuth URL, but Postiz currently returns zero connected social channels from `/integrations`.

This means Tanaghum can start the Postiz OAuth handoff, but no channel is visible to Tanaghum until the provider OAuth flow is completed inside Postiz for the same organization/API key.

## Still Blocked By External Setup

- A connected Postiz channel must appear in Postiz `/integrations`.
- A Tanaghum admin must select that channel with `Use for Scheduling`.
- Sandbox scheduling remains blocked until explicit deployment flags and approval gates are enabled.
- Live publishing remains blocked.

## Safety

- No raw Postiz API key, OAuth token, refresh token, or provider secret is returned to the frontend.
- Diagnostics may return an authorization URL because the admin needs to open the provider consent flow; it does not return provider tokens.
- No real publishing is enabled by this sprint.
- No M5 execution is enabled by this sprint.

## Verification

- Backend typecheck passes.
- Postiz channel contract tests pass.
- Frontend production build passes.
