# SAIF Decision Package Schema

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

SAIF decision packages are required for all significant decisions. This schema defines the structure and evaluation dimensions.

## Decision Package Structure

```yaml
decision_package:
  id: "SAIF-YYYY-NNN"
  title: "Decision title"
  date: "YYYY-MM-DD"
  status: "draft|under_review|approved|rejected|superseded"
  domain: "commercial|finance|hr|procurement|inventory|purchase|supply_chain|erp|cross_domain"
  significance: "low|medium|high|critical"
  requester: "AgentRep ID"
  reviewer: "GovernanceAgent ID"
  authority: "HumanUser ID"
  
  context:
    problem: "What problem does this solve?"
    background: "Relevant background"
    constraints: "Known constraints"
  
  evaluation_dimensions:
    capability_impact:
      score: 1-10
      notes: "Impact on capabilities"
    security_posture:
      score: 1-10
      critical: true
      notes: "Security implications"
    cost:
      score: 1-10
      notes: "Cost implications"
    latency:
      score: 1-10
      notes: "Latency impact"
    maintainability:
      score: 1-10
      notes: "Long-term maintainability"
    reversibility:
      score: 1-10
      notes: "Ease of reversal"
    human_oversight:
      score: 1-10
      critical: true
      notes: "Human oversight requirements"
    compliance:
      score: 1-10
      critical: true
      notes: "Compliance implications"
    observability:
      score: 1-10
      notes: "Observability requirements"
    learning_potential:
      score: 1-10
      notes: "Learning and improvement potential"
  
  cost_benefit:
    costs: []
    benefits: []
    roi_estimate: "Description"
  
  execution_handoff:
    acceptance_criteria: []
    test_requirements: []
    rollback_plan: "Rollback description"
  
  decision:
    outcome: "approved|rejected|deferred"
    rationale: "Decision rationale"
    conditions: []
    expiry: "YYYY-MM-DD or null"
```

## Mandatory Dimensions

| Dimension | Critical | Description |
|---|---|---|
| Capability Impact | No | Impact on platform capabilities |
| Security Posture | **Yes** | Security implications |
| Cost | No | Cost implications |
| Latency | No | Latency impact |
| Maintainability | No | Long-term maintainability |
| Reversibility | No | Ease of reversal |
| Human Oversight | **Yes** | Human oversight requirements |
| Compliance | **Yes** | Compliance implications |
| Observability | No | Observability requirements |
| Learning Potential | No | Learning and improvement potential |

## Critical Dimension Rules

1. **Security Posture** — Must be positive or have explicit mitigation
2. **Human Oversight** — Must be positive or have explicit mitigation
3. **Compliance** — Must be positive or have explicit mitigation

## Significance Levels

| Level | Description | Required Review |
|---|---|---|
| Low | Minor change, no impact | Single reviewer |
| Medium | Moderate impact | Two reviewers |
| High | Significant impact | Full review board |
| Critical | Critical impact | Executive approval |

## Domain-Specific Packages

| Domain | Package Type | Additional Dimensions |
|---|---|---|
| Commercial/Content | Content decision | Brand safety, audience impact |
| Finance | Financial decision | Financial compliance, audit trail |
| HR | HR decision | Privacy, employment law |
| Procurement | Procurement decision | Vendor compliance, cost control |
| Inventory | Inventory decision | Stock impact, supply chain |
| Purchase | Purchase decision | Budget approval, vendor selection |
| Supply Chain | Supply chain decision | Logistics, supplier compliance |
| ERP | ERP decision | Integration complexity, data mapping |
