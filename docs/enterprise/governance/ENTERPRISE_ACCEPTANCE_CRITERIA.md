# Enterprise Acceptance Criteria

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

Enterprise acceptance criteria define the cross-domain acceptance rules for the Tanaghom AI Enterprise Platform.

## Universal Acceptance Criteria

### Architecture

| Criteria | Description | Status |
|---|---|---|
| STITCH compliance | All implementations follow STITCH patterns | Required |
| SAIF compliance | All significant decisions use SAIF packages | Required |
| Pack isolation | Domain packs are isolated and self-contained | Required |
| MCP mediation | All external access through MCP mediation | Required |
| No STITCH redefinition | No sprint redefines STITCH substrate objects | Required |

### Security

| Criteria | Description | Status |
|---|---|---|
| No direct external access | All external access mediated | Required |
| M5 blocked by default | M5 write execution blocked unless authorized | Required |
| No secrets in code | Secrets in secrets manager only | Required |
| Audit trail | All actions logged and audited | Required |
| Kill switches | All integrations have kill switches | Required |

### Quality

| Criteria | Description | Status |
|---|---|---|
| Tests | Unit, integration, permission, API tests | Required |
| Documentation | All features documented | Required |
| CI green | All CI jobs pass | Required |
| Codex review | All PRs reviewed by Codex GPT-5.5 | Required |
| Evidence | Demo evidence artifacts | Required |

### Governance

| Criteria | Description | Status |
|---|---|---|
| SAIF decision packages | All significant decisions documented | Required |
| Source-of-truth compliance | All work follows source-of-truth hierarchy | Required |
| AI engineering protocol | All AI work follows protocol | Required |
| Sprint spec | All sprints have clear spec | Required |
| Clear deliverables | All sprints have clear deliverables | Required |

## Domain-Specific Acceptance Criteria

### Commercial/Content

| Criteria | Description | Status |
|---|---|---|
| Campaign workflow | State machine-based campaign management | Required |
| Approval workflow | Risk-based approval routing | Required |
| Content generation | Mock LLM-based content generation | Required |
| Publishing preparation | Readiness checks before publishing | Required |
| Analytics reporting | Mock analytics reporting | Required |

### Finance (Future)

| Criteria | Description | Status |
|---|---|---|
| Financial compliance | Financial regulations compliance | Required |
| Audit trail | Financial audit trail | Required |
| Data accuracy | Financial data accuracy | Required |
| Reporting | Financial reporting | Required |

### HR (Future)

| Criteria | Description | Status |
|---|---|---|
| Privacy compliance | Employee data privacy | Required |
| Employment law | Employment law compliance | Required |
| Data security | Employee data security | Required |
| Access control | HR access control | Required |

### Procurement (Future)

| Criteria | Description | Status |
|---|---|---|
| Vendor compliance | Vendor compliance checks | Required |
| Cost control | Procurement cost control | Required |
| Approval workflow | Procurement approval workflow | Required |
| Audit trail | Procurement audit trail | Required |

### ERP Integration

| Criteria | Description | Status |
|---|---|---|
| SAIF decision package | ERP integration approved via SAIF | Required |
| Separately scoped | ERP scope separate from platform | Required |
| Write-back blocked | ERP write-back blocked by default | Required |
| MCP mediation | ERP access through MCP mediation | Required |
| Audit trail | All ERP access logged | Required |

## QC as Evaluator Role

QC (Quality Control) is an Evaluator role, not final human approval.

| Role | Responsibility |
|---|---|
| QC Evaluator | Evaluates quality, reports findings |
| Human Approver | Makes final approval decisions |
| GovernanceAgent | Supports QC with automated checks |

## Acceptance Criteria Enforcement

1. **CI enforcement** — Acceptance criteria enforced in CI
2. **Codex review** — Acceptance criteria verified in Codex review
3. **Evidence artifacts** — Acceptance criteria documented in evidence
4. **Sprint review** — Acceptance criteria reviewed in sprint review
5. **Continuous monitoring** — Acceptance criteria monitored continuously
