# Sprint 65 - Customer Onboarding and Credential Readiness

## Goal

Create customer-facing onboarding and credential readiness documentation for the Commercial/Social production candidate.

This sprint is documentation-only. It does not enable external writes, connector execution, publishing, CRM writes, messaging, voice calls, or M5/write execution.

## Issues

- Fixes #83 - Customer Onboarding And Operator Guide
- Fixes #84 - Customer-Owned Credential Checklist

## Deliverables

| Deliverable | Path | Purpose |
|---|---|---|
| Customer onboarding/operator guide | `docs/product/CUSTOMER_ONBOARDING_AND_OPERATOR_GUIDE.md` | Explains how admins, Amro, content users, reviewers, and sales roles use the product. |
| Customer-owned credential checklist | `docs/integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md` | Lists every customer-owned account/credential required for optional production connectors. |
| Walkthrough links | `docs/product/SYSTEM_WALKTHROUGH_GUIDE.md` | Points testers and customer operators to the new guides. |
| Sprint plan status | `docs/sprints/COMMERCIAL_EVENT_AUTOMATION_SPRINT_PLAN.md` | Records Sprint 65 documentation outputs. |

## In Scope

- Business-readable role guidance.
- Daily operator workflow for Amro and team roles.
- Event, campaign, content, approval, scheduling, lead, dashboard, and closeout workflow explanation.
- Credential requirements for AI, Postiz, Meta/Instagram, YouTube, Formaloo, GHL, WhatsApp, Telegram, SmartLabs, OpenClaw, agentgateway, AgentScope, SMTP, backups, and alerts.
- Explicit safety wording for blocked external execution.

## Out Of Scope

- Backend connector implementation.
- Frontend UI changes.
- Credential storage changes.
- Live scheduling or publishing.
- CRM writes.
- WhatsApp, Telegram, or SmartLabs execution.
- Billing or subscription implementation.

## Validation

- Documentation reviewed against current product pages and route labels.
- No raw customer credentials embedded.
- No claim that blocked production connectors are active.
- No claim of private social algorithm access.
- All external execution remains described as customer-owned and authorization-gated.

## Completion Checklist

- [ ] Customer guide added.
- [ ] Credential checklist added.
- [ ] Walkthrough guide links added.
- [ ] Sprint plan links added.
- [ ] `git diff --check` passes.
- [ ] Branch pushed and PR opened.
