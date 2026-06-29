# Sprint 52: Unified Commercial/Social WorkflowRun Foundation

## Purpose

Convert the Commercial/Social journey from page-level record reconstruction into a tenant-scoped STITCH WorkflowRun foundation.

This sprint does not enable external publishing, CRM writes, messaging, voice execution, OpenClaw orchestration, agentgateway, AgentScope, or M5.

## Delivered

- Added persistent `CommercialWorkflowRun`, `CommercialWorkflowStep`, and `CommercialWorkflowRunEvent` schema.
- Added migration `20260629_commercial_workflow_runs`.
- Added `/commercial-workflow/runs`, `/commercial-workflow/runs/current`, and `/commercial-workflow/runs/:id/sync`.
- Updated `/commercial-workflow/state` to synchronize and return a workflow run when a campaign exists.
- Tenant-scoped workflow state derivation now filters campaigns, approvals, publishing packages, reports, and leads by users in the authenticated tenant.
- Commercial workflow evidence reconstruction now resolves campaigns only inside the authenticated tenant.
- Commercial workflow audit writes now attempt to attach audit actions to the relevant tenant WorkflowRun.
- Command Center now shows business-facing workflow run status without exposing raw IDs.

## Verification Added

- WorkflowRun creation and stage synchronization test.
- Cross-tenant campaign synchronization block test.
- Audit-to-WorkflowRun event linkage test.

## Still Not Solved

- Core business tables still need direct `tenant_key` columns for full SaaS isolation.
- Existing campaign/draft/approval/package endpoints are still separate product actions; this sprint adds the durable run foundation but does not replace every endpoint with a single action dispatcher.
- No SSE/WebSocket live updates yet.
- No autonomous worker runtime yet.
- No automated CD/deploy pipeline yet.
- No Kubernetes/Helm production deployment yet.
