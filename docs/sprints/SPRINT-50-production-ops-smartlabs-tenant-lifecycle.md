# Sprint 50 — Production Operations, SmartLabs Voice, and Tenant Lifecycle Hardening

## Goal

Close the next production readiness gaps without hardcoding customer credentials or weakening external execution policy.

## Implemented

- SmartLabs Voice connector:
  - tenant-owned credential requirement: `smartlabs_voice` / `api_key`
  - status endpoint
  - read tests for agents and voices
  - conversation payload preview and gated execution
  - text-to-speech payload preview and gated execution
  - no raw API keys returned
- SmartLabs UI:
  - credential setup guidance
  - agent/voice read test buttons
  - conversation preview/execute form
  - text-to-speech preview/execute form
  - generated audio playback when execution is authorized
- Docker-native backup support:
  - backup script using the running PostgreSQL container
  - Docker-based backup verification script
  - systemd service/timer templates
- Tenant lifecycle hardening:
  - suspended or archived tenants are blocked at login
  - admin lifecycle status endpoint
  - admin suspend/reactivate/archive endpoint
  - Tenant Admin UI controls
- Security review baseline:
  - CSRF/session position
  - MFA recovery SOP
  - dependency policy
  - penetration review scope

## Production Safety

- No shared SmartLabs API key.
- No hardcoded SmartLabs credential.
- SmartLabs reads require `SMARTLABS_READ_ENABLED=true`.
- SmartLabs execution requires:
  - tenant credential
  - `EXTERNAL_EXECUTION_ENABLED=true`
  - `M5_WRITE_EXECUTION_ENABLED=true`
  - `VOICE_CHAT_LIVE_ENABLED=true`
  - `SMARTLABS_LIVE_ENABLED=true`
  - human approval/capability/MCP policy inputs
  - explicit user confirmation

## Still Not Complete

- Monitoring stack still needs live VPS deployment evidence after merge/deploy.
- Backup timer still needs live VPS install evidence and off-server copy target.
- Restore drill still needs evidence.
- Full SaaS billing/subscription automation is not implemented.
- Tenant export/delete automation is not implemented.
- SmartLabs real customer integration testing requires a real tenant API key and approved test agent.
- Postiz/GHL/social production connector tests still require customer-owned credentials and connected channels.
