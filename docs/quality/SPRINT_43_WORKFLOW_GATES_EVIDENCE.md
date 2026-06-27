# Sprint 43: Workflow Gates and Evidence Trail

## Purpose

Sprint 43 closes a verified architecture/product gap from the STITCH review:
Commercial/Social actions were visible in the UI and application logs, but core workflow steps were not consistently reconstructable from persistent database evidence.

This sprint keeps the platform safe:

- No real publishing enabled.
- No real Postiz scheduling enabled.
- No CRM, WhatsApp, Telegram, or voice execution enabled.
- No M5 write execution enabled.
- No external writes enabled by this sprint.

## Delivered

- Added a Commercial/Social evidence endpoint:
  - `GET /commercial-workflow/evidence`
  - Optional `campaignId` query parameter.
  - Reconstructs evidence from STITCH database records.
- Added persistent audit recording helper for commercial workflow actions.
- Persisted durable audit records for:
  - draft generated
  - draft generation failed
  - draft revised
  - human-edited draft saved
  - approval submitted
  - approval decided
  - publishing package created
  - publishing package blocked by approval gate
  - Postiz sandbox schedule blocked
  - Postiz sandbox schedule attempted
- Replaced the old publishing stub page with a product-facing Publishing Readiness workspace.
- Added Publishing Readiness to the product navigation.
- Fixed workflow next-action links so they point to real routes:
  - `/approvals`
  - `/publishing`
  - `/analytics`
  - `/observability`

## Acceptance

- Evidence trail source of truth is STITCH database records.
- Publishing package creation remains approval-gated.
- Postiz channel readiness is visible without exposing raw tokens.
- Customer-facing publishing page uses product language instead of internal engineering keys.
- External scheduling remains blocked unless explicitly authorized by future deployment flags and tenant credentials.

## Remaining Gaps

- This is not a durable LangGraph execution engine yet.
- Capability resolution is not yet the mandatory route for every commercial workflow action.
- Existing historical actions before Sprint 43 may not have full persistent audit coverage.
- Postiz still requires real provider OAuth/channel setup before Tanaghum can see a social channel.
- GHL, WhatsApp, Telegram, voice, OpenClaw, agentgateway, and AgentScope remain gated integration/runtime work.
