# AI_SESSION_PROTOCOL.md — AI Coding Session Rules

> **Version**: 1.0
> **Date**: 2026-06-14

## Session Start

Every AI coding session MUST begin by reading:

1. `CONTEXT.md` — active module, allowed files, locked files
2. `AGENTS.md` — permanent rules
3. `CLAUDE.md` — coding instructions
4. Active sprint file in `docs/sprints/` — scope and acceptance criteria
5. Module `README.md` — responsibility and boundary rules

## Session Scope

- Work ONLY on the module specified in `CONTEXT.md`
- Do NOT edit files outside allowed scope
- Do NOT change database schema unless sprint allows it
- Do NOT introduce new architecture patterns without an ADR

## During Session

- Follow the module pattern: controller → service → repository → types → validators → events → tests
- Write or update tests for every change
- Use provider interfaces, never direct external service calls
- Use the state machine for content/approval status transitions
- Log significant decisions as they happen

## Session End

When finished, summarize:

1. **Files changed** — list of modified/created files
2. **Tests added** — what was tested and how
3. **Risks** — any concerns, known limitations, technical debt
4. **What remains** — incomplete work, follow-up items

## Forbidden Actions

- Editing unrelated modules
- Changing database schema outside allowed sprints
- Bypassing approval or audit logic
- Storing secrets in code or documentation
- Claiming algorithm certainty
- Using real provider implementations before mock providers pass tests
