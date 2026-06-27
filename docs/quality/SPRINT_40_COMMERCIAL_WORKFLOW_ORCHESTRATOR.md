# Sprint 40 Commercial/Social Workflow Orchestrator

## Objective

Create a backend-owned Commercial/Social workflow state so the product UI renders one truthful operating journey instead of deriving workflow readiness separately in each page.

## Scope

- Add `/commercial-workflow/state`.
- Derive state from existing STITCH records: campaigns, drafts, scores, approvals, publishing packages, analytics reports, leads, LLM credential status, Postiz credential/channel status, and safety flags.
- Keep external execution blocked unless existing deployment flags and approval/MCP gates allow it.
- Wire Command Center to consume the backend workflow state.

## Non-Scope

- No real social publishing.
- No real CRM write.
- No WhatsApp, Telegram, or voice execution.
- No M5 bypass.
- No replacement of the existing LangGraph idea-selection workflow.

## Current Runtime Truth

The Sprint 40 workflow state is `derived_from_backend_records`. It is not yet a full durable LangGraph execution graph for the complete Commercial/Social lifecycle. LangGraph is currently present for idea selection with database snapshot persistence outside tests.

## Acceptance

- Backend workflow state is test-covered.
- Frontend Command Center uses the backend workflow state for readiness, next action, counts, and stage rail.
- No secrets are returned.
- External writes remain blocked by default.
