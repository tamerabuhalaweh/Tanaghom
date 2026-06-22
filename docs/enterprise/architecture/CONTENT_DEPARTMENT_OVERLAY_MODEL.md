# Content Department Overlay Model

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

Define the Commercial/Content department overlay model. The Commercial/Content domain is the current implementation and serves as the reference overlay for future enterprise domains.

## Overlay Architecture

```
STITCH Core (Immutable)
    ↓
Enterprise Overlay Layer
    ↓
Domain-Specific Overlays
    ├── Commercial/Content Overlay (Current)
    ├── Finance Overlay (Future)
    ├── HR Overlay (Future)
    ├── Procurement Overlay (Future)
    ├── Inventory Overlay (Future)
    ├── Purchase Overlay (Future)
    ├── Supply Chain Overlay (Future)
    └── ERP Overlay (Future)
```

## Commercial/Content Overlay

### Overlay Structure

```
Commercial/Content Overlay
├── Departments (Topology Nodes)
│   ├── Brand & Market Intelligence
│   ├── Demand Generation
│   ├── Conversion
│   ├── Customer Growth & Retention
│   └── Revenue Operations
├── Capabilities
│   ├── Content Generation
│   ├── Campaign Management
│   ├── CRM Integration
│   ├── Messaging Integration
│   ├── Rendering
│   └── Publishing
├── Workflows
│   ├── Campaign Workflow
│   ├── Approval Workflow
│   ├── Publishing Workflow
│   └── Analytics Workflow
├── State Machines
│   ├── Campaign State Machine
│   ├── Approval State Machine
│   └── Content State Machine
└── Integrations
    ├── Postiz (Mock)
    ├── CRM (Mock)
    ├── WhatsApp (Mock)
    ├── Analytics (Mock)
    └── Rendering (Mock)
```

### Department Details

#### Brand & Market Intelligence

| Attribute | Value |
|---|---|
| Role | Intelligence gathering and analysis |
| Capabilities | Market analysis, brand monitoring, competitive intelligence |
| Agent Labels | Brand Analyst, Market Researcher |
| Workflows | Market analysis, brand monitoring |

#### Demand Generation

| Attribute | Value |
|---|---|
| Role | Content and campaign creation |
| Capabilities | Content generation, campaign management |
| Agent Labels | Content Specialist, Campaign Manager |
| Workflows | Content creation, campaign setup |

#### Conversion

| Attribute | Value |
|---|---|
| Role | Lead capture and conversion |
| Capabilities | CRM integration, lead management |
| Agent Labels | CRM Manager, Conversion Specialist |
| Workflows | Lead capture, CRM handoff |

#### Customer Growth & Retention

| Attribute | Value |
|---|---|
| Role | Customer engagement and retention |
| Capabilities | Messaging integration, customer engagement |
| Agent Labels | Customer Success Manager |
| Workflows | Customer engagement, retention campaigns |

#### Revenue Operations

| Attribute | Value |
|---|---|
| Role | Analytics and optimization |
| Capabilities | Analytics reporting, optimization |
| Agent Labels | Analytics Manager |
| Workflows | Analytics reporting, optimization |

### CCO Executive Authority

| Attribute | Value |
|---|---|
| Role | Cross-department governance |
| Authority | Final approval, policy enforcement |
| Agent Labels | CCO (GovernanceAgent) |
| Workflows | Policy enforcement, cross-department coordination |

## Overlay Rules

1. **Overlay extends STITCH** — Overlay adds domain-specific logic, doesn't redefine STITCH
2. **Overlay is isolated** — Overlay is self-contained, doesn't import from other overlays
3. **Overlay references STITCH** — Overlay references STITCH objects, not duplicates them
4. **Overlay is versioned** — Overlay is versioned independently
5. **Overlay is governed** — Overlay has its own governance rules

## Overlay Implementation

### Current Implementation (Commercial/Content)

| Module | Status | Location |
|---|---|---|
| auth | ✅ Implemented | `modules/auth/` |
| users-departments | ✅ Implemented | `modules/users-departments/` |
| campaigns | ✅ Implemented | `modules/campaigns/` |
| ai-generation | ✅ Implemented | `modules/ai-generation/` |
| algorithm-intelligence | ✅ Implemented | `modules/algorithm-intelligence/` |
| approvals | ✅ Implemented | `modules/approvals/` |
| publishing-preparation | ✅ Implemented | `modules/publishing-preparation/` |
| postiz-integration | ✅ Implemented | `modules/postiz-integration/` |
| analytics-reporting | ✅ Implemented | `modules/analytics-reporting/` |
| learning-review | ✅ Implemented | `modules/learning-review/` |
| crm-conversion | ✅ Implemented | `modules/crm-conversion/` |
| production-rendering | ✅ Implemented | `modules/production-rendering/` |

### STITCH Substrate Usage

| STITCH Object | Usage in Commercial/Content |
|---|---|
| AgentRep | User delegation and identity |
| FunctionalAgent | Content specialists, campaign managers |
| GovernanceAgent | Approval managers, CCO |
| SessionContext | Session lock enforcement |
| Capability | Content generation, campaign management |
| ExecutionPattern | Campaign execution, publishing |
| Resource | External platforms, assets |
| Implementation | Mock providers |
| Run | SPINE execution records |
| Artifact | Campaign artifacts, analytics |
| Event | Observability events |
| AuditRecord | Audit trail entries |
| LearningSignal | Learning signals for DKS |
| Asset | Digital asset management |
| AssetCognitionRecord | Asset metadata |

## Future Overlay Template

When creating a new domain overlay:

1. **Create overlay documentation** — `docs/enterprise/packs/[domain]/`
2. **Define departments** — Topology nodes for the domain
3. **Define capabilities** — Domain-specific capabilities
4. **Define workflows** — Domain-specific workflows
5. **Define state machines** — Domain-specific state machines
6. **Define integrations** — Domain-specific integrations
7. **Create SAIF decision package** — For significant decisions
8. **Get approval** — Before implementation

## Overlay Comparison

| Aspect | Commercial/Content | Finance (Future) | HR (Future) |
|---|---|---|---|
| Departments | 5 + CCO | 4 + CFO | 4 + CHRO |
| Capabilities | 6 | 5 | 5 |
| Workflows | 4 | 4 | 4 |
| State Machines | 3 | 3 | 3 |
| Integrations | 5 (Mock) | 3 (Future) | 3 (Future) |
| SAIF Packages | 1 | TBD | TBD |
