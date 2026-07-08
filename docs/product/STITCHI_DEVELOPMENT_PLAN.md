# Stitchi Development Plan

Status: Sprint ST-1 backend conversation foundation, ST-2 read-only assistant foundation, ST-2B backend workflow/action foundation, ST-2C natural-language orchestration, backend token streaming, and ST-3 Hybrid UI surface are implemented locally.

Target platform: Hybrid only. The AB reference deployment must remain untouched.

## 1. Product Goal

Stitchi is the governed AI work assistant for Tanaghum.

The purpose is to let a business user describe the work they want done in natural language, then let Stitchi guide, prepare, preview, and execute approved actions through Tanaghum's existing backend capabilities.

Stitchi should reduce page-hopping. The product pages remain available as workspaces and evidence views, but the primary user experience becomes:

1. User asks Stitchi what they want to accomplish.
2. Stitchi understands the business intent.
3. Stitchi gathers needed context from Tanaghum.
4. Stitchi proposes a plan.
5. User approves or edits the plan.
6. Stitchi executes allowed internal actions.
7. Risky or external actions remain preview-only or approval-gated.
8. Audit evidence is recorded.

## 2. Non-Negotiable Rules

- Stitchi must never bypass tenant isolation, RBAC, approval gates, audit, or integration policy.
- Stitchi must not directly call external systems from the browser.
- Stitchi must not expose raw secrets, tokens, API keys, or hidden credential fields.
- Stitchi must not publish, schedule, send messages, write CRM records, or trigger voice/chat unless the required customer credentials, execution flags, and approvals exist.
- Stitchi must never make OpenClaw, agentgateway, AgentScope, MCP tools, Postiz, GoHighLevel, SmartLabs, or any external system the source of truth.
- Stitchi must use Tanaghum domain services and action contracts, not ad hoc database writes.
- Every executed action must create audit/evidence.
- Every action must be tenant-scoped and user-role-scoped.
- Customer-facing language must be business language, not STITCH/SAIF/MCP/M5/internal runtime jargon.

## 3. Current Foundation

The repo already has useful building blocks:

- Tenant-aware auth, RBAC, audit, and credential vault foundations.
- LLM provider adapters for OpenAI, Claude, DeepSeek, Gemma, and fallback provider.
- Event, campaign, planner, lead, KPI, closeout, Postiz, GHL, SmartLabs, and connector readiness APIs.
- LangGraph dependency and an existing idea-selection workflow using interrupts and database snapshots.
- `langgraph_workflows` database table for durable workflow snapshots.
- agentgateway dry-run mediation pilot for connector preview policy checks.
- OpenClaw and AgentScope admin-only bridge endpoints, currently disabled unless explicitly configured.

Current truth:

- LangGraph is present but not yet the full workflow engine for all user work.
- agentgateway is a sandbox policy pilot, not full production gateway data-plane.
- OpenClaw is not orchestrating production workflows.
- AgentScope is not executing production agent sessions.

## 4. Recommended Runtime Direction

### Use LangGraph First

LangGraph should power Stitchi v1 because its strengths match the product need:

- long-running task workflows
- checkpoints and resumability
- human-in-the-loop interrupts
- stateful execution
- approval pauses
- inspectable workflow state

### Use agentgateway For Tool/Connector Mediation

agentgateway should not be the chat brain. It should mediate connector and tool traffic where policy enforcement matters, especially:

- connector dry-runs
- future MCP tool calls
- external read previews
- external write attempts, if authorized later

### Use OpenClaw Later

OpenClaw is useful later for channel orchestration, such as:

- chat-command routing from external channels
- approval notifications
- WhatsApp/Telegram/Slack/Teams style command surfaces

It should not own Tanaghum state or execute work independently.

### Use AgentScope Later

AgentScope becomes useful if Tanaghum needs multiple specialized agents with session isolation, tool permission boundaries, and observable agent sessions.

It is not required for Stitchi v1.

## 5. Target User Journeys

### Journey A - Event Preparation

User says:

> I have a new event next month. Help me prepare the marketing and sales plan.

Stitchi should:

1. Ask for missing basics: event name, type, date, location, audience, offer, budget, channels.
2. Create a proposed event strategy.
3. Preview campaign timeline.
4. Suggest email, WhatsApp, upsell, content, and sales task plans.
5. Ask for approval.
6. Create the event and planner records after approval.
7. Show next actions.

### Journey B - Daily Manager Check-In

User says:

> What should I focus on today?

Stitchi should:

1. Load active events.
2. Summarize lead movement, KPI gaps, risks, delayed content, missing integrations, and upcoming tasks.
3. Produce a short prioritized action list.
4. Offer one-click actions like "create follow-up task", "review hot leads", or "prepare KPI import".

### Journey C - Content Creation

User says:

> Create social post ideas for this event.

Stitchi should:

1. Use the configured tenant LLM provider.
2. Generate ideas from event strategy and audience.
3. Show platform-aware options.
4. Let the user select or revise.
5. Convert approved ideas into campaign/content records.

### Journey D - Lead Follow-Up

User says:

> Which leads need follow-up and what should sales do?

Stitchi should:

1. Read event leads and statuses.
2. Identify hot, warm, no-show, and follow-up-needed leads.
3. Prepare suggested next actions.
4. Create sales tasks only after approval.
5. Prepare GHL or SmartLabs handoff previews if configured.

### Journey E - Integrations

User says:

> Connect my CRM and check if it is ready.

Stitchi should:

1. Guide the user to the right credential setup.
2. Explain what customer credentials are needed.
3. Run readiness checks after credentials are saved.
4. Run preview/dry-run only where allowed.
5. Never claim live sync unless the backend proves it.

## 6. Backend Architecture

```text
Stitchi UI
  -> /stitchi API
  -> Stitchi orchestration service
  -> Intent classifier
  -> Action registry
  -> LangGraph workflow
  -> Permission and safety policy
  -> Existing Tanaghum domain services
  -> Audit/evidence
  -> Optional agentgateway mediation for connector/tool calls
```

## 7. Proposed Backend Modules

Add:

- `modules/stitchi/controller.ts`
- `modules/stitchi/service.ts`
- `modules/stitchi/workflow.ts`
- `modules/stitchi/actions.ts`
- `modules/stitchi/policy.ts`
- `modules/stitchi/prompts.ts`
- `modules/stitchi/types.ts`
- `modules/stitchi/tests/*`

Register:

- `/stitchi/conversations`
- `/stitchi/conversations/:id/messages`
- `/stitchi/actions/:id/approve`
- `/stitchi/actions/:id/reject`
- `/stitchi/actions/:id/cancel`
- `/stitchi/events/:eventId/context`
- `/stitchi/conversations/:id/respond`
- `/stitchi/conversations/:id/respond/stream`
- `/stitchi/conversations/:id/orchestrate`
- `/stitchi/actions/:id/execute`

Streaming now uses backend Server-Sent Events. Provider adapters emit token events for OpenAI, Claude, DeepSeek, Gemma, and fallback provider responses.

## 8. Proposed Data Model

Add or adapt:

### StitchiConversation

- id
- tenant_key
- user_id
- event_id nullable
- title
- status: active, archived
- created_at
- updated_at

### StitchiMessage

- id
- conversation_id
- tenant_key
- role: user, assistant, system
- content
- metadata
- created_at

### StitchiActionRun

- id
- conversation_id
- tenant_key
- user_id
- action_type
- status: proposed, awaiting_approval, approved, rejected, running, completed, failed, cancelled
- input_payload
- preview_payload
- result_payload
- requires_approval
- risk_level: low, medium, high
- audit_record_id nullable
- langgraph_thread_id nullable
- created_at
- updated_at
- completed_at nullable

### StitchiActionApproval

- id
- action_run_id
- tenant_key
- approver_user_id
- decision: approved, rejected, changes_requested
- notes
- created_at

Reuse:

- `langgraph_workflows` for durable workflow snapshots.
- `AuditRecord` for evidence.

## 9. Action Registry

Stitchi must use explicit actions. No free-form execution.

### Read-Only Actions

- `summarize_active_events`
- `summarize_event_status`
- `summarize_event_leads`
- `summarize_event_kpis`
- `summarize_event_risks`
- `explain_integration_readiness`
- `list_next_actions`
- `open_workspace_link`

### Draft/Preview Actions

- `draft_event_strategy`
- `draft_campaign_timeline`
- `draft_content_requirements`
- `draft_email_plan`
- `draft_whatsapp_plan`
- `draft_upsell_plan`
- `draft_sales_tasks`
- `draft_social_post_ideas`
- `draft_ghl_handoff_preview`
- `draft_smartlabs_handoff_preview`
- `draft_postiz_scheduling_package`

### Internal Write Actions

Require user confirmation:

- `create_event`
- `update_event_strategy`
- `create_content_requirement`
- `create_email_plan`
- `create_whatsapp_plan`
- `create_upsell_plan`
- `create_sales_task`
- `create_event_problem`
- `update_lead_status`
- `record_lead_temperature`
- `create_kpi_record`

### External/Gated Actions

Require credentials, explicit flags, policy, approval, and audit:

- `run_connector_dry_run`
- `run_ghl_pull_preview`
- `run_ghl_pull_sync`
- `run_postiz_channel_validation`
- `prepare_postiz_payload`
- `run_smartlabs_validation`
- `trigger_smartlabs_test_conversation`

Default state: blocked or preview-only.

## 10. LangGraph Workflow Shape

Recommended graph:

```text
receive_user_message
  -> classify_intent
  -> load_context
  -> decide_if_clarification_needed
  -> propose_action_or_answer
  -> validate_policy
  -> interrupt_for_human_approval if needed
  -> execute_action
  -> record_audit
  -> summarize_result
```

Failure handling:

- If LLM fails, return useful error and keep conversation state.
- If permission fails, explain the allowed path.
- If credential is missing, tell user exactly where to configure it.
- If an action is unsafe, return preview-only output.

## 11. Frontend UX

### Primary Surface

Add a persistent Stitchi button in Hybrid:

- bottom-right floating button, or
- right-side assistant drawer.

Current implementation:

- Persistent bottom-right "Ask Stitchi" button in the authenticated Hybrid shell.
- Right-side drawer with "Ask" and "Prepare work" modes.

### Full Page

Add `/stitchi` for full-screen work mode.

Current implementation:

- `/stitchi` full workspace route.
- Uses the Aiero-style Hybrid visual system.
- Shows chat, safe action cards, approval controls, and useful workspace links.

### Chat Experience

Messages should support:

- normal text
- action cards
- preview cards
- approval cards
- next-action buttons
- links to relevant pages
- "what changed" confirmation

Current implementation:

- Token-streamed assistant answers for "Ask" mode.
- Governed action cards for "Prepare work" mode.
- Approval/rejection buttons for approver roles.
- "Save approved work" button for approved internal actions.
- External execution remains blocked.

### Starter Prompts

Examples:

- "Plan a new event campaign."
- "What should I focus on today?"
- "Create content ideas for my active event."
- "Show me leads that need follow-up."
- "Check if my CRM and social integrations are ready."
- "Prepare a closeout report."

### Customer Language

Use:

- "Prepare plan"
- "Needs approval"
- "Ready to save"
- "Missing connection"
- "Preview only"
- "Saved"
- "Requires customer credentials"

Avoid:

- STITCH
- SAIF
- MCP
- M5
- LangGraph
- agentgateway
- runtime bridge
- raw IDs

## 12. Security And Governance

### Permission Checks

Every action must declare:

- required role/capability
- whether it is read-only
- whether it writes internal records
- whether it touches external systems
- whether approval is required
- whether customer credentials are required

### Prompt Injection Protection

Stitchi must ignore requests to:

- reveal secrets
- bypass permissions
- impersonate another user
- switch tenant
- execute external writes without approval
- disable safety gates
- produce fake metrics

### Audit Requirements

Record:

- user prompt
- selected intent
- proposed action
- approval decision
- executed action
- result summary
- external connector policy result if applicable

Do not record:

- raw secrets
- raw external payloads containing PII beyond approved normalized fields
- API keys or tokens

## 13. Development Sprints

### Sprint ST-0 - Final Design And Guardrails

Deliverables:

- Finalize action registry.
- Finalize database schema.
- Finalize permission matrix.
- Finalize Stitchi UX wireframe.
- Create GitHub issues for ST-1 through ST-8.

Acceptance:

- No code execution path exists yet.
- Plan is reviewed and approved.

### Sprint ST-1 - Backend Conversation Foundation

Deliverables:

- Add Stitchi conversation/message/action-run models.
- Add migration.
- Add REST endpoints for conversations and messages.
- Add tenant/RBAC tests.
- Add audit for conversation/action creation.

Acceptance:

- Users can create/list conversations in their tenant.
- Cross-tenant access is rejected.
- No LLM execution yet.

Status: Implemented locally.

Implemented scope:

- `stitchi_conversations`, `stitchi_messages`, `stitchi_action_runs`, and `stitchi_action_approvals`.
- `/stitchi/conversations` list/create/get/archive.
- `/stitchi/conversations/:id/messages` list/create.
- `/stitchi/conversations/:id/actions` list/create.
- `/stitchi/actions/:id/approve`, `/reject`, and `/cancel`.
- Tenant/user scoping.
- Admin/CCO/department-head tenant visibility.
- Approver-role action decisions.
- Audit records for conversation, message, action, and decision events.
- Secret redaction for message content and action payload storage.

Not included:

- LLM chat responses.
- Streaming.
- UI drawer/page.
- Business action execution.
- External connector execution.

### Sprint ST-2 - Read-Only Assistant

Deliverables:

- Add LLM-backed chat response through tenant AI provider.
- Add read-only context loader for events, leads, KPIs, risks, integrations.
- Add safe answer policy.
- Add fallback response when provider missing.

Acceptance:

- Stitchi can answer status questions.
- No writes happen.
- No secrets exposed.
- Non-admin users do not see hidden admin errors.

Status: Implemented locally.

Implemented scope:

- `/stitchi/conversations/:id/respond` accepts a user prompt and optional event focus.
- Saves the user message with redaction.
- Loads tenant-scoped, read-only context for events, leads, KPI records, open risks, connector jobs, and credential readiness counts.
- Uses the logged-in user's selected AI provider through the existing encrypted AI Provider settings path.
- Saves the assistant response with provider/model metadata and read-only safety metadata.
- Returns an honest setup-required assistant message when no production AI provider is configured for that user.
- Does not create action runs, business records, connector jobs, CRM records, publishing packages, scheduling requests, or external calls other than the configured LLM provider.
- Adds tests for context loading, provider-required behavior, provider-backed response, redaction, and no action-run creation.

Not included:

- UI drawer or full page.
- Token-by-token LLM streaming.
- Full end-to-end LangGraph natural-language orchestration.
- Autonomous action selection.
- External connector execution.

### Sprint ST-2B - Workflow, Streaming, And Approved Internal Action Execution

Deliverables:

- Add server-sent event response endpoint.
- Add LangGraph-backed action approval workflow.
- Add safe internal action registry.
- Add execute endpoint for approved internal actions.
- Add tests proving no unsupported external actions execute.

Acceptance:

- Stitchi has a streaming backend path.
- Action proposals that can write internal records create an approval interrupt.
- Approved internal actions execute through existing Tanaghum domain services.
- External actions remain unsupported/blocked until connector-specific sprints.
- Tests prove unsupported actions are rejected.

Status: Implemented locally.

Implemented scope:

- `/stitchi/conversations/:id/respond/stream` emits lifecycle SSE events: started, context loading, completed, or error.
- `modules/stitchi/workflow.ts` uses LangGraph `StateGraph`, `MemorySaver`, and `interrupt` for action approval.
- LangGraph approval workflows are persisted to `langgraph_workflows` with a database state snapshot.
- `/stitchi/actions/:id/execute` executes only approved action runs and only for roles with `stitchi:execute_action`.
- Supported executable internal actions:
  - `create_event_problem`
  - `update_event_strategy`
  - `create_event_kpi_record`
  - `update_lead_status`
  - `set_lead_temperature`
- All executable actions route through existing Tanaghum services, not direct ad hoc database writes.
- Action execution records completion/failure on the `StitchiActionRun`.
- Tests cover RBAC, LangGraph interrupt/resume, internal action execution, and unsupported external action rejection.

Not included:

- Frontend chat drawer/page.
- Token-by-token LLM streaming. The current implementation is lifecycle streaming because existing provider adapters expose non-streaming `generate`.
- Autonomous intent-to-action execution. Users or UI must create an explicit action proposal before approval/execution.
- Postiz publishing/scheduling, GHL writes, WhatsApp, Telegram, SmartLabs calls, social OAuth writes, or any external execution.
- Full LangGraph orchestration for every natural-language journey.
- External connector execution.

### Sprint ST-3 - Chat UI Drawer And Full Page

Deliverables:

- Add Stitchi floating assistant/drawer.
- Add `/stitchi` full-page assistant.
- Add starter prompts.
- Add action cards and loading/error states.
- Add links into Event, Content, Leads, Integration pages.

Acceptance:

- User can chat from any customer-facing page.
- UI works desktop and mobile.
- Browser QA shows no overlaps or console errors.

### Sprint ST-4 - Event Strategy Actions

Deliverables:

- Add action contracts for event strategy planning.
- Add preview before internal write.
- Add approval card.
- Add create event and update strategy actions.
- Add LangGraph workflow with approval interrupt.

Acceptance:

- User can ask Stitchi to plan an event.
- Stitchi previews the plan.
- User approves.
- Event and strategy records are created through domain services.
- Audit evidence exists.

### Sprint ST-5 - Planner And Content Actions

Deliverables:

- Add email, WhatsApp, upsell, content requirement, and sales task actions.
- Add content idea generation via configured LLM provider.
- Add selected idea conversion path.

Acceptance:

- Stitchi can build a practical event preparation package.
- Records are saved only after approval.
- Generated ideas are visible in the content library/workspace.

### Sprint ST-6 - Lead And Daily Operations Assistant

Deliverables:

- Add lead summary and next-action recommendations.
- Add lead follow-up task creation.
- Add lead status/temperature update with approval.
- Add daily check-in summary.

Acceptance:

- User can ask "what should I focus on today?"
- Stitchi returns prioritized actions based on real records.
- Internal writes require approval.

### Sprint ST-7 - Connector Assistant

Deliverables:

- Add integration readiness explanations.
- Add Postiz channel validation action.
- Add GHL pull preview action.
- Add SmartLabs validation preview action.
- Route eligible connector dry-runs through existing agentgateway mediation hook.

Acceptance:

- Stitchi can guide user through missing credentials and mappings.
- Stitchi can run safe read-only previews when configured.
- External writes remain blocked unless explicitly authorized.

### Sprint ST-8 - Production Hardening

Deliverables:

- Add rate limits for Stitchi endpoints.
- Add action idempotency keys.
- Add prompt-injection tests.
- Add audit/evidence tests.
- Add Playwright workflow tests.
- Add visual QA checks.
- Add handover docs.

Acceptance:

- Full browser walkthrough passes.
- Backend tests pass.
- Frontend build passes.
- No raw secrets in responses.
- No hidden 403s for normal users.
- No external write without explicit authorization.

## 14. Testing Strategy

### Backend Tests

- conversation tenant isolation
- message tenant isolation
- action registry policy
- role permission enforcement
- approval-required behavior
- LangGraph interrupt/resume
- audit evidence creation
- no secret leakage
- prompt-injection refusal
- external action blocked by default

### Frontend Tests

- Stitchi drawer opens/closes
- starter prompts render
- event context conversation works
- action preview card renders
- approval/reject actions work
- error states are useful
- mobile layout works

### Playwright Acceptance

Minimum scenario:

1. Login as marketing manager.
2. Open Stitchi.
3. Ask to plan a new event.
4. Provide event basics.
5. Preview plan.
6. Approve creation.
7. Confirm event appears in Events.
8. Ask for next actions.
9. Confirm no console errors.

## 15. Release Strategy

Use feature flag:

- `STITCHI_ENABLED=false` by default.

Suggested rollout:

1. Enable for admin only.
2. Enable for marketing manager in staging/hybrid.
3. Run acceptance tests.
4. Enable for customer pilot tenant.
5. Review audit logs.
6. Expand action registry gradually.

## 16. Definition Of Done

Stitchi is production-acceptable only when:

- Normal users can use it without seeing admin/runtime jargon.
- It performs real Tanaghum actions through backend services.
- It asks for approval before writes or risky actions.
- It never exposes secrets.
- It never bypasses tenant/RBAC/audit.
- It explains missing customer credentials clearly.
- It records evidence for every action.
- It passes backend, frontend, and browser workflow tests.
- It improves the user journey instead of adding another confusing surface.

## 17. Honest Risk Assessment

This is a high-value feature, but it is not a small UI task.

Main risks:

- LLM hallucination causing wrong actions.
- Too much autonomy before governance is ready.
- Users trusting generated output without review.
- Chat becoming another disconnected surface.
- Permission or tenant bugs if action contracts are weak.

Mitigation:

- Start read-only.
- Add action previews before writes.
- Use strict action schemas.
- Execute only through existing domain services.
- Keep external execution blocked by default.
- Add Playwright and backend policy tests before release.

## 18. Recommended Next Step

Next implementation sprint:

Sprint ST-3: Chat UI Drawer And Full Page

Do not start with OpenClaw or AgentScope. Start with a governed Tanaghum assistant using LangGraph and existing backend services.
