# Sprint 36 Productization Gap Closure

Status: Productization slice implemented; full production readiness still has remaining gaps

## Goal

Convert the Commercial/Social workspace from a scattered demo/admin console into a usable product MVP that can be sold, configured, operated, and audited by real customer users.

This sprint must not claim a gap is fixed unless the UI is connected to persisted backend state, the action is authorized by role, unsafe execution remains blocked by policy, and verification passes.

## Non-Negotiable Done Criteria

- No feature is marked fixed if it is only a static card, placeholder, or hardcoded mock.
- Customer-facing pages use one layout system, one typography hierarchy, one card style, and business language.
- Admin pages expose real configuration workflows, not only read-only registries.
- Secrets are never displayed after save.
- External execution remains blocked unless explicit sandbox flags and credentials allow it.
- M5 write execution remains disabled.
- Tests must cover the fixed behavior.

## Approved Gap Fix Tracks

### Track 1: Visual Product Dashboard

Required outcome:

- Commercial Command Center shows real API-backed metrics, workflow progress, charts, lead funnel, and integration readiness.
- Analytics & Leads shows real lead records and performance intelligence in a visual, readable dashboard.
- Dashboard components are reusable and consistent.

### Track 2: Users, Roles, and AgentReps

Required outcome:

- Admin can create users using business role templates.
- Admin can see each user's AgentRep and assigned agents/skills.
- Users can view their own AgentRep and effective permissions.
- AgentRep setup is not hidden behind technical IDs.

### Track 3: Skills Management

Required outcome:

- Admin can create a functional or governance agent skill for an AgentRep using the UI.
- Skills are persisted through existing backend APIs.
- The skill screen is not a static registry only.
- MCP-imported skills are represented as planned/import-ready only until tool discovery is implemented.

### Track 4: MCP and Integration Management

Required outcome:

- Admin can register an MCP connector through UI.
- Connector registration persists to backend.
- Admin can run a mock health check and tool preview.
- Live execution cannot be enabled from UI.
- Connector state is presented as product configuration, not fake readiness.

### Track 5: Credential and Provider Setup

Required outcome:

- Users can configure their own LLM provider credentials through UI.
- Credential status is visible; raw secrets are never shown after save.
- Integration credential pages clearly distinguish user-stored credentials from deployment-only credentials.
- Postiz, GoHighLevel, messaging, voice, and social connectors show real required configuration state.

### Track 6: Commercial/Social Journey Wiring

Required outcome:

- Campaign -> draft -> score -> approval -> publishing package -> analytics -> lead handoff remains the primary path.
- Admin technical concepts are secondary.
- Any publishing/CRM/voice action has explicit authorization gates and readable evidence.

## Remaining Future Tracks

These are not fixed by documentation or shell changes alone:

- Real MCP tool discovery from remote MCP server manifests.
- GitHub repository skill import and validation.
- Real social account OAuth / official API account connection.
- Production external writes.
- OpenClaw runtime orchestration bridge.
- LangGraph / agentgateway / AgentScope migration or integration.

## Sprint 36 Slice Completed

This implementation slice focuses on making the existing platform usable from the product UI instead of only from static readiness pages.

- Commercial dashboards now include reusable visual score, funnel, stepper, and signal components backed by loaded workflow state.
- Admin user creation now supports business role templates while preserving internal authorization roles.
- Users can view or initialize their own AgentRep identity from the UI.
- Admins can assign persisted functional and governance skills to AgentReps through existing backend APIs.
- Admins can register MCP connectors through the UI and run blocked/mock health and tool-preview checks.
- LLM provider settings remain user-owned and secret-safe.
- Integration credential pages now separate what is actually stored today from deployment-level configuration still required later.

## Not Claimed Complete

The following are still product gaps and must not be presented as production-ready:

- Tenant-level credential vault for Postiz, GoHighLevel, WhatsApp, Telegram, voice, and social OAuth.
- Remote MCP server discovery/import.
- GitHub repo skill import.
- Real Postiz scheduling to a sandbox account.
- Real CRM write to GoHighLevel sandbox.
- Real WhatsApp, Telegram, or voice execution.
- OpenClaw orchestration of STITCH workflows.
- LangGraph, agentgateway, and AgentScope production migration.
