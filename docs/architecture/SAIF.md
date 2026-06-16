# SAIF v1.2 — Strategic AI Framework

> **Version**: 1.2
> **Date**: 2026-06-16
> **Status**: Normative
> **Update Rule**: Only by formal revision with ADR

## Overview

SAIF (Strategic AI Framework) is the normative decision framework for the Tanaghum platform. It governs how AI-related decisions are made, evaluated, recorded, and handed off for execution. Every significant AI decision — from model selection to capability design to agent behavior — must follow SAIF.

SAIF is not a development methodology. It is a **decision architecture** that ensures:
- Decisions are explicit, not implicit
- Trade-offs are evaluated across mandatory dimensions
- Decision rationale is preserved for future sessions
- Execution handoffs are unambiguous
- Cost-benefit analysis is structural, not ad-hoc

---

## 1. DKS Declaration

**DKS** (Decision Knowledge Specification) is the formal declaration of a decision's scope, authority, and lifecycle.

### DKS Record

Every SAIF-governed decision produces a DKS record:

| Field | Type | Description |
|---|---|---|
| decision_id | String | Unique identifier (e.g., "SAIF-2026-001") |
| title | String | Short descriptive title |
| status | Enum | proposed, accepted, deprecated, superseded |
| authority | String | Who has authority to accept/reject (e.g., "Product Owner", "Architecture Board") |
| scope | String[] | Which modules/components this decision affects |
| stakeholders | String[] | Who must be consulted before acceptance |
| created_at | Timestamp | |
| accepted_at | Timestamp? | |
| superseded_by | String? | decision_id of superseding decision |

### DKS Lifecycle

```
Proposed → Under Review → Accepted
                        → Rejected (with rationale)
                        → Superseded (by newer decision)
```

### DKS Rules

1. Every ADR is a DKS record (ADR is SAIF's implementation of DKS)
2. DKS records are immutable after acceptance — only status can change
3. Superseded DKS records must reference their successor
4. DKS records must be version-controlled alongside code

---

## 2. Mandatory Evaluation Dimensions

Every SAIF-governed decision must be evaluated across these dimensions. No dimension may be skipped — if a dimension is not applicable, state why explicitly.

### Dimensions

| Dimension | Question | Weight |
|---|---|---|
| **Capability Impact** | Does this decision expand or constrain platform capabilities? | High |
| **Security Posture** | Does this decision increase or decrease attack surface? | Critical |
| **Cost** | What is the direct cost (tokens, API calls, compute, storage)? | High |
| **Latency** | Does this decision affect response time or throughput? | Medium |
| **Maintainability** | Does this decision make the system easier or harder to maintain? | High |
| **Reversibility** | How hard is it to undo this decision later? | Medium |
| **Human Oversight** | Does this decision preserve or weaken human control? | Critical |
| **Compliance** | Does this decision meet regulatory and policy requirements? | Critical |
| **Observability** | Does this decision improve or degrade system observability? | Medium |
| **Learning Potential** | Does this decision enable the system to improve over time? | Low |

### Evaluation Template

```markdown
## Evaluation: [Decision Title]

| Dimension | Assessment | Rating | Notes |
|---|---|---|---|
| Capability Impact | [assessment] | +/0/- | [notes] |
| Security Posture | [assessment] | +/0/- | [notes] |
| Cost | [assessment] | +/0/- | [notes] |
| Latency | [assessment] | +/0/- | [notes] |
| Maintainability | [assessment] | +/0/- | [notes] |
| Reversibility | [assessment] | +/0/- | [notes] |
| Human Oversight | [assessment] | +/0/- | [notes] |
| Compliance | [assessment] | +/0/- | [notes] |
| Observability | [assessment] | +/0/- | [notes] |
| Learning Potential | [assessment] | +/0/- | [notes] |

Overall: [summary]
Critical dimensions (Security, Human Oversight, Compliance) must be positive or explicitly accepted.
```

### Rating Scale

- **+** Positive impact on this dimension
- **0** Neutral or no impact
- **-** Negative impact (requires mitigation plan)

### Critical Dimension Rule

Three dimensions are **Critical**: Security Posture, Human Oversight, and Compliance. A decision that rates negative on any Critical dimension requires:
1. Explicit mitigation plan
2. Acceptance by the authority specified in the DKS record
3. Review cadence (cannot be accepted without a review date)

---

## 3. SAIF Decision Record Model

SAIF extends the ADR model with mandatory evaluation dimensions and DKS metadata.

### SAIF Decision Record Template

```markdown
# SAIF-NNN: [Title]

> **Status**: Proposed | Accepted | Deprecated | Superseded by SAIF-NNN
> **Date**: YYYY-MM-DD
> **Authority**: [Who accepts/rejects]
> **Scope**: [Modules/components affected]
> **Stakeholders**: [Who must be consulted]

## Context

What is the issue that motivates this decision?

## Decision

What is the change being proposed?

## Evaluation

| Dimension | Assessment | Rating | Notes |
|---|---|---|---|
| Capability Impact | ... | +/0/- | ... |
| Security Posture | ... | +/0/- | ... |
| Cost | ... | +/0/- | ... |
| Latency | ... | +/0/- | ... |
| Maintainability | ... | +/0/- | ... |
| Reversibility | ... | +/0/- | ... |
| Human Oversight | ... | +/0/- | ... |
| Compliance | ... | +/0/- | ... |
| Observability | ... | +/0/- | ... |
| Learning Potential | ... | +/0/- | ... |

## Cost-Benefit Analysis

[See §5 Cost-Benefit Guidance]

## Execution Handoff

[See §4 Execution Handoff Model]

## Consequences

What becomes easier or more difficult?

## Alternatives Considered

What other options were evaluated?

## References

Links to relevant documentation.
```

### Relationship to ADR

- Every ADR is a DKS record
- SAIF Decision Records are ADRs with mandatory evaluation
- Existing ADRs (001–009) are grandfathered — new ADRs must use the SAIF template
- ADR numbering continues (010+) with SAIF evaluation dimensions

---

## 4. Execution Handoff Model

SAIF defines how decisions are handed off for execution. Ambiguous handoffs are a primary source of implementation drift.

### Handoff Record

Every accepted SAIF decision that requires implementation must include a Handoff Record:

| Field | Type | Description |
|---|---|---|
| decision_id | String | The SAIF decision being implemented |
| implementer | String | Who is responsible for implementation (AgentRep or HumanUser) |
| scope | String[] | Specific files/modules to be modified |
| acceptance_criteria | String[] | What must be true for implementation to be considered complete |
| blocking_dependencies | String[] | What must be done before implementation can start |
| estimated_effort | String | Small / Medium / Large |
| deadline | Timestamp? | Optional |

### Handoff Rules

1. **No decision is implemented without a Handoff Record.** Even if the implementer is the same person who made the decision.
2. **Acceptance criteria must be testable.** "Make it faster" is not an acceptance criterion. "Reduce API response time to < 200ms for p95" is.
3. **Blocking dependencies must be resolved before implementation starts.** The implementer must verify this.
4. **Implementer must acknowledge the handoff.** A handoff without acknowledgment is incomplete.
5. **Handoff records are appended to the SAIF Decision Record** (not stored separately).

### Handoff Lifecycle

```
Decision Accepted
    ↓
Handoff Record Created
    ↓
Implementer Acknowledges
    ↓
Implementation Begins
    ↓
Acceptance Criteria Verified
    ↓
Implementation Complete
```

### Agent Handoff (STITCH)

When the implementer is an AgentRep:
1. The AgentRep must have the required capabilities (resolved through STITCH capability pipeline)
2. The AgentRep must have the required permissions (RoleBinding + PermissionGrant)
3. The handoff must specify the ExecutionPattern to be used
4. The resulting Artifact must be recorded in SPINE

---

## 5. Cost-Benefit Guidance

SAIF requires structural cost-benefit analysis for decisions with significant resource implications.

### When Cost-Benefit Analysis is Required

- Model selection decisions (which LLM, which provider)
- Capability additions that increase API calls or compute
- Storage architecture decisions
- Integration decisions (new external services)
- Agent behavior changes that affect token usage

### Cost Categories

| Category | Examples | Measurement |
|---|---|---|
| **Compute** | LLM tokens, CPU time, memory | Per-request cost, monthly aggregate |
| **Storage** | Database, file storage, vector store | Per-GB cost, growth rate |
| **API Calls** | External service calls | Per-call cost, rate limits |
| **Human Time** | Review, approval, oversight | Hours per decision cycle |
| **Opportunity Cost** | What we can't do because of this decision | Qualitative assessment |

### Benefit Categories

| Category | Examples | Measurement |
|---|---|---|
| **Capability** | New functionality enabled | Qualitative: High/Medium/Low |
| **Quality** | Improved output quality | Metric-based where possible |
| **Speed** | Faster execution or delivery | Measurable time savings |
| **Risk Reduction** | Reduced security/compliance risk | Qualitative: High/Medium/Low |
| **Learning** | Improved future performance | Expected signal quality |

### Cost-Benefit Template

```markdown
## Cost-Benefit Analysis: [Decision Title]

### Costs

| Category | Estimated Cost | Frequency | Monthly Total |
|---|---|---|---|
| Compute | $X per request | Y requests/month | $Z |
| Storage | $X per GB | Z GB | $Z |
| API Calls | $X per call | Y calls/month | $Z |
| Human Time | X hours | Y decisions/month | $Z |
| **Total** | | | **$Z/month** |

### Benefits

| Category | Expected Benefit | Measurement Method |
|---|---|---|
| Capability | [description] | [how to measure] |
| Quality | [description] | [how to measure] |
| Speed | [description] | [how to measure] |
| Risk Reduction | [description] | [how to measure] |
| Learning | [description] | [how to measure] |

### Break-Even Analysis

[When does the investment pay off?]

### Recommendation

[Accept / Reject / Defer with rationale]
```

### Cost Thresholds

| Threshold | Monthly Cost | Approval Required |
|---|---|---|
| Low | < $100 | Team lead |
| Medium | $100–$500 | Product owner |
| High | $500–$2000 | Architecture board |
| Critical | > $2000 | Executive approval |

---

## 6. SAIF in STITCH

SAIF is integrated into the STITCH operating substrate:

- **Capability Resolution**: SAIF evaluation is required before adding new capabilities
- **ADR Integration**: All new ADRs use the SAIF template with mandatory evaluation dimensions
- **Agent Decisions**: FunctionalAgents must produce SAIF evaluation artifacts for significant decisions
- **Governance Review**: GovernanceAgents evaluate decisions against SAIF Critical dimensions
- **SPINE Recording**: SAIF decision records are linked to SPINE Runs and Artifacts

---

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | SAIF v1.2 initial adoption | Sprint 4.5 |
