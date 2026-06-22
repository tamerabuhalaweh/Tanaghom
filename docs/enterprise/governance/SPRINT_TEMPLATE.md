# Enterprise Sprint Template

> **Version**: 1.0
> **Date**: 2026-06-22

## Sprint Structure

Every sprint must follow this template:

```markdown
# Sprint N — [Sprint Name]

> **Date**: YYYY-MM-DD
> **Status**: 🔄 In Progress | ✅ Complete | ❌ Blocked
> **Branch**: feature/sprint-N-[name]
> **PR**: #[NUMBER]

## Goal

[Clear, concise goal statement]

## What This Sprint IS

- [Clear list of what this sprint includes]

## What This Sprint IS NOT

- [Clear list of what this sprint excludes]

## Source-of-Truth References

| Document | Reference | Status |
|---|---|---|
| SRD v1.2 | [Section] | ✅ Reviewed |
| STITCH | [Pattern] | ✅ Compliant |
| SAIF v1.2 | [Package] | ✅ Approved |

## Scope

| Item | Description | Status |
|---|---|---|
| [Item 1] | [Description] | 🔄 |
| [Item 2] | [Description] | 🔄 |

## Deliverables

| Deliverable | Description | Status |
|---|---|---|
| [Deliverable 1] | [Description] | 🔄 |
| [Deliverable 2] | [Description] | 🔄 |

## Tests

| Test | Description | Status |
|---|---|---|
| [Test 1] | [Description] | 🔄 |
| [Test 2] | [Description] | 🔄 |

## Acceptance Criteria

| Criteria | Description | Status |
|---|---|---|
| [Criteria 1] | [Description] | 🔄 |
| [Criteria 2] | [Description] | 🔄 |

## Evidence

| Artifact | Description | Status |
|---|---|---|
| [Artifact 1] | [Description] | 🔄 |
| [Artifact 2] | [Description] | 🔄 |

## Risks

| Risk | Mitigation |
|---|---|
| [Risk 1] | [Mitigation] |
| [Risk 2] | [Mitigation] |

## SAIF Decision Packages

| Package | Significance | Status |
|---|---|---|
| [Package 1] | [Level] | [Status] |
| [Package 2] | [Level] | [Status] |

## Architecture Compliance

| Rule | Status |
|---|---|
| STITCH compliance | ✅ |
| SAIF compliance | ✅ |
| Pack isolation | ✅ |
| MCP mediation | ✅ |

## Verification

- [ ] All tests pass
- [ ] CI 4/4 green
- [ ] Documentation complete
- [ ] Evidence artifacts ready
- [ ] Codex review complete
- [ ] All acceptance criteria met
```

## Sprint Naming Convention

```
feature/sprint-N-[short-name]
```

Examples:
- `feature/sprint-25-enterprise-architecture-reconciliation`
- `feature/sprint-26-commercial-content-overlay`
- `feature/sprint-27-finance-domain-pack`

## Sprint Review Checklist

- [ ] All deliverables complete
- [ ] All tests pass
- [ ] CI 4/4 green
- [ ] Documentation complete
- [ ] Evidence artifacts ready
- [ ] SAIF decision packages approved
- [ ] Architecture compliance verified
- [ ] Security compliance verified
- [ ] Quality compliance verified
- [ ] Codex review complete
- [ ] No blockers
- [ ] No scope creep
- [ ] No hidden assumptions
