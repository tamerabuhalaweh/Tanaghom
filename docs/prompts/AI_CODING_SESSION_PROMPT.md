# AI Coding Session Prompt

Use this prompt at the start of every AI coding session.

---

## Project

Tanaghum AI Commercial Automation Platform. Read `CONTEXT.md`, `CLAUDE.md`, and `AGENTS.md` before starting.

## Active Sprint

Read the sprint file in `docs/sprints/` for the current sprint scope and acceptance criteria.

## Your Task

We are working only on: **[MODULE NAME]**

### Allowed Files
- [LIST FILES/FOLDERS]

### Locked Files
- [LIST LOCKED MODULES]

### Contract
- [Reference to openapi.yaml or module API spec]

### Acceptance Criteria
- [LIST ACCEPTANCE CRITERIA]

## Rules

1. Follow `docs/architecture/ARCHITECTURE.md`
2. Follow `docs/architecture/MODULE_BOUNDARIES.md`
3. Follow `docs/architecture/STATE_MACHINES.md` for status transitions
4. Follow `CLAUDE.md` and `AGENTS.md`
5. Write or update tests
6. Do not introduce new architecture patterns without an ADR
7. Do not change database schema unless this sprint allows it
8. Do not bypass approval, security, or audit rules
9. Use provider interfaces (mock implementations only)

## When Finished

Summarize:
1. Files changed
2. Tests added
3. Risks
4. What remains

---

## Template Variables

Replace these before each session:

| Variable | Example |
|---|---|
| `[MODULE NAME]` | `campaigns` |
| `[LIST FILES/FOLDERS]` | `modules/campaigns/`, `prisma/schema.prisma` |
| `[LIST LOCKED MODULES]` | `modules/auth/`, `modules/approvals/` |
| `[API SPEC REF]` | `docs/api/openapi.yaml#/paths/~1campaigns` |
| `[ACCEPTANCE CRITERIA]` | `Campaign CRUD works, state machine enforced, tests pass` |
