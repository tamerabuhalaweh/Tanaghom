# AI Engineering Protocol

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

Define strict engineering protocol for AI-assisted development on the Tanaghom AI Enterprise Platform.

## Core Principles

1. **No AI memory** — AI must not rely on memory for architecture decisions
2. **Source-of-truth first** — Always check SRD, STITCH, SAIF before coding
3. **Repo baseline first** — Always check current repo state before adding
4. **Architecture rules first** — Always follow STITCH patterns

## Development Protocol

### Before Starting Work

1. **Read source-of-truth documents**
   - SRD v1.2 and addendums
   - STITCH architecture documentation
   - SAIF v1.2 decision framework
   - Current repo state

2. **Verify sprint spec**
   - Clear deliverables
   - Clear tests
   - Clear acceptance criteria
   - Clear scope boundaries

3. **Check architecture compliance**
   - STITCH patterns
   - SAIF decision packages
   - Pack boundaries
   - MCP mediation rules

### During Development

1. **Follow sprint spec**
   - No scope creep
   - No hidden assumptions
   - No undocumented changes

2. **Follow architecture rules**
   - STITCH patterns
   - Pack isolation
   - MCP mediation
   - No direct external access

3. **Follow quality rules**
   - Tests mandatory
   - Documentation mandatory
   - CI must pass
   - Codex review required

### Before Merge

1. **Verify deliverables**
   - All sprint deliverables complete
   - All tests pass
   - All documentation complete
   - All evidence artifacts ready

2. **Verify compliance**
   - Architecture compliance
   - Security compliance
   - Quality compliance
   - Governance compliance

3. **Get approval**
   - Codex GPT-5.5 review
   - All CI jobs green
   - All acceptance criteria met
   - No blockers

## Prohibited Actions

| Action | Status | Reason |
|---|---|---|
| Rely on AI memory | ❌ Prohibited | Source-of-truth must be explicit |
| Skip source-of-truth check | ❌ Prohibited | Architecture compliance required |
| Redefine STITCH objects | ❌ Prohibited | STITCH supremacy |
| Direct external access | ❌ Prohibited | MCP mediation required |
| M5 without authorization | ❌ Prohibited | M5 requires explicit approval |
| Hidden assumptions | ❌ Prohibited | All assumptions documented |
| Scope creep | ❌ Prohibited | Sprint spec defines scope |
| Skip Codex review | ❌ Prohibited | All PRs require review |

## Required Actions

| Action | Status | Reason |
|---|---|---|
| Check source-of-truth | ✅ Required | Architecture compliance |
| Follow STITCH patterns | ✅ Required | Architecture supremacy |
| Use SAIF for decisions | ✅ Required | Decision governance |
| Document assumptions | ✅ Required | No hidden assumptions |
| Write tests | ✅ Required | Quality assurance |
| Write documentation | ✅ Required | Knowledge management |
| Get Codex review | ✅ Required | Quality gate |
| Create evidence | ✅ Required | Audit trail |

## AI Agent Behavior

### Acceptable

- Reading source-of-truth documents
- Following sprint spec
- Following architecture rules
- Writing tests
- Writing documentation
- Creating evidence artifacts
- Asking for clarification

### Unacceptable

- Making architecture decisions without SAIF
- Redefining STITCH objects
- Skipping source-of-truth checks
- Relying on memory for decisions
- Hidden assumptions
- Scope creep
- Direct external access
- M5 without authorization
