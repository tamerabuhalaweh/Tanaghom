# CLAUDE.md — Permanent AI Coding Instructions

## Project

Tanaghom AI Enterprise Platform. A STITCH-based, SAIF-governed, multi-agent enterprise operating platform covering Commercial/Social/Content, Finance, HR, Procurement, Inventory, Purchase Management, Supply Chain, and optional ERP integrations.

**AI memory is not authoritative.** Every sprint must start from repo docs, Sprint Template, Source-of-Truth Register, and Enterprise Acceptance Criteria.

## Core Rules

1. Read `CONTEXT.md` at the start of every session. It defines the active module, allowed files, and locked files.
2. Work only on the module specified in `CONTEXT.md`. Do not edit files outside your allowed scope.
3. Follow module structure: `controller.ts` → `service.ts` → `repository.ts` → `types.ts` → `validators.ts` → `events.ts` → `tests/`.
4. Never store secrets in code, markdown, logs, or prompts. Use `.env` and secrets manager only.
5. Never bypass approval, compliance, or audit logic. Every post requires human approval in MVP.
6. Never change database schema unless the current sprint explicitly allows it.
7. Never introduce a new architecture pattern without an ADR.
8. Write or update tests for every change. Unit + integration + permission tests where applicable.
9. Use provider interfaces (`LLMProvider`, `PostizProvider`, `MessagingProvider`, `CRMProvider`, `AnalyticsProvider`). Never couple directly to external services.
10. Campaign and approval statuses are a strict state machine. No module may bypass state transitions.
11. Read the Enterprise Control Plane docs before starting any sprint:
    - `docs/enterprise/governance/SOURCE_OF_TRUTH_REGISTER.md`
    - `docs/enterprise/governance/REPO_BASELINE_AUDIT.md`
    - `docs/enterprise/architecture/STITCH_SUPREMACY.md`
    - `docs/enterprise/architecture/CAPABILITY_AND_TOPOLOGY_MODEL.md`
    - `docs/enterprise/saif/SAIF_DECISION_PACKAGE_SCHEMA.md`
    - `docs/enterprise/packs/PACK_BOUNDARY_MODEL.md`
    - `docs/enterprise/architecture/CONTENT_DEPARTMENT_OVERLAY_MODEL.md`
    - `docs/enterprise/erp/ERP_CONNECTOR_GOVERNANCE.md`
    - `docs/enterprise/governance/ENTERPRISE_ACCEPTANCE_CRITERIA.md`
    - `docs/enterprise/governance/AI_ENGINEERING_PROTOCOL.md`
    - `docs/enterprise/governance/SPRINT_TEMPLATE.md`
    - `docs/enterprise/ENTERPRISE_ROADMAP.md`

## Sprint Deliverable Checklist

Every sprint must deliver ALL of the following:

- [ ] API contract (OpenAPI spec updated in `docs/api/openapi.yaml`)
- [ ] Database migration (if schema changed, via Prisma)
- [ ] Backend logic (service + repository + controller + validators)
- [ ] Frontend screen (if the sprint has a UI component)
- [ ] Tests (unit, integration, permission, API)
- [ ] Documentation update (sprint file, CONTEXT.md, ADR if needed)
- [ ] PR summary (files changed, tests added, risks, what remains)

## When Finished With a Sprint

Summarize:
1. Files changed
2. Tests added
3. Risks
4. What remains

## Forbidden Actions

- Editing unrelated modules in the same session
- Changing database schema outside allowed sprints
- Bypassing approval or audit logic
- Storing secrets in documentation or code
- Claiming algorithm certainty (outputs are probability-based)
- Using real provider implementations before mock providers are validated
