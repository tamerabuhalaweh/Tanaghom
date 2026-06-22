# Capability and Topology Model

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

Define the enterprise capability and topology model. **Capabilities are the stable reusable architecture unit. Departments are topology nodes, not hardcoded architecture primitives.**

## Core Principles

1. **Capabilities are stable** — Capabilities persist across department reorganizations
2. **Departments are topology nodes** — Departments are organizational groupings, not architecture primitives
3. **Agent labels are projections** — Agent labels are business-facing, not necessarily one runtime agent per department
4. **Capabilities are reusable** — The same capability can serve multiple departments

## Capability Model

### Capability Structure

```
Capability
├── Name
├── Description
├── Domain (optional)
├── Reusable (true/false)
├── Dependencies (other capabilities)
├── ExecutionPatterns
│   ├── Pattern 1
│   └── Pattern 2
├── Resources
│   ├── Resource 1
│   └── Resource 2
└── Implementations
    ├── Implementation 1
    └── Implementation 2
```

### Enterprise Capabilities

| Capability | Domain | Reusable | Description |
|---|---|---|---|
| Content Generation | Commercial/Content | ✅ | Generate content across platforms |
| Campaign Management | Commercial/Content | ✅ | Create, manage, track campaigns |
| Approval Workflow | Cross-domain | ✅ | Risk-based approval routing |
| Analytics Reporting | Cross-domain | ✅ | Collect, analyze, report metrics |
| Asset Management | Cross-domain | ✅ | Manage digital assets |
| Learning & DKS | Cross-domain | ✅ | Learn from signals, update knowledge |
| CRM Integration | Commercial/Content | ✅ | Capture leads, manage contacts |
| Messaging Integration | Cross-domain | ✅ | Send/receive messages |
| Rendering | Cross-domain | ✅ | Generate visual content |
| Publishing | Commercial/Content | ✅ | Publish to platforms |
| Financial Reporting | Finance | ✅ | Financial data reporting |
| HR Management | HR | ✅ | Employee data management |
| Procurement | Procurement | ✅ | Vendor and purchase management |
| Inventory Tracking | Inventory | ✅ | Stock and inventory management |
| Purchase Orders | Purchase | ✅ | Purchase order management |
| Supply Chain | Supply Chain | ✅ | Supply chain coordination |
| ERP Integration | ERP | ✅ | ERP system integration |
| Workflow Orchestration | Cross-domain | ✅ | Cross-domain workflow |
| Document Management | Cross-domain | ✅ | Document lifecycle management |
| Notification | Cross-domain | ✅ | Multi-channel notifications |

### Capability Dependencies

```
Content Generation → Asset Management → Rendering → Publishing
Campaign Management → Approval Workflow → Content Generation
Analytics Reporting → Learning & DKS
CRM Integration → Messaging Integration
Financial Reporting → ERP Integration
Procurement → Purchase Orders → Inventory Tracking
Supply Chain → Inventory Tracking → Purchase Orders
```

## Topology Model

### Department as Topology Node

```
Enterprise Topology
├── Commercial/Content Node
│   ├── Brand & Market Intelligence
│   ├── Demand Generation
│   ├── Conversion
│   ├── Customer Growth & Retention
│   └── Revenue Operations
├── Finance Node
│   ├── Financial Reporting
│   ├── Accounts Payable
│   ├── Accounts Receivable
│   └── Budget Management
├── HR Node
│   ├── Recruitment
│   ├── Employee Management
│   ├── Training
│   └── Compliance
├── Procurement Node
│   ├── Vendor Management
│   ├── Purchase Requests
│   └── Contract Management
├── Inventory Node
│   ├── Stock Management
│   ├── Warehouse
│   └── Tracking
├── Purchase Management Node
│   ├── Purchase Orders
│   ├── Receiving
│   └── Payment Processing
├── Supply Chain Node
│   ├── Supplier Management
│   ├── Logistics
│   └── Distribution
└── CCO (Executive Authority)
    └── Cross-department governance
```

### Topology Rules

1. **Nodes are organizational** — Nodes group related functions
2. **Nodes are flexible** — Nodes can be reorganized without changing capabilities
3. **Nodes share capabilities** — Multiple nodes can use the same capability
4. **Nodes communicate via events** — Nodes communicate through domain events
5. **Nodes are governed** — Each node has governance rules

## Agent Label Model

### Agent Labels as Business Projections

| Agent Label | Business Role | Topology Node | Runtime Agent |
|---|---|---|---|
| Content Specialist | Content creation | Commercial/Content | FunctionalAgent |
| Campaign Manager | Campaign management | Commercial/Content | FunctionalAgent |
| Approval Manager | Approval workflow | Cross-domain | GovernanceAgent |
| Analytics Manager | Analytics reporting | Cross-domain | FunctionalAgent |
| CRM Manager | CRM operations | Commercial/Content | FunctionalAgent |
| Financial Analyst | Financial reporting | Finance | FunctionalAgent |
| HR Manager | HR operations | HR | FunctionalAgent |
| Procurement Manager | Procurement operations | Procurement | FunctionalAgent |
| Inventory Manager | Inventory operations | Inventory | FunctionalAgent |
| Purchase Manager | Purchase operations | Purchase | FunctionalAgent |
| Supply Chain Manager | Supply chain operations | Supply Chain | FunctionalAgent |
| CCO | Executive authority | Cross-domain | GovernanceAgent |

### Agent Label Rules

1. **Labels are business-facing** — Labels map to business roles, not runtime agents
2. **Labels are flexible** — Labels can change without changing runtime agents
3. **Labels map to topology** — Labels belong to topology nodes
4. **Labels share agents** — Multiple labels can use the same runtime agent

## Capability-Topology Mapping

| Capability | Primary Node | Secondary Nodes |
|---|---|---|
| Content Generation | Commercial/Content | — |
| Campaign Management | Commercial/Content | — |
| Approval Workflow | Cross-domain | All nodes |
| Analytics Reporting | Cross-domain | All nodes |
| Asset Management | Cross-domain | All nodes |
| Learning & DKS | Cross-domain | All nodes |
| CRM Integration | Commercial/Content | — |
| Messaging Integration | Cross-domain | All nodes |
| Rendering | Cross-domain | All nodes |
| Publishing | Commercial/Content | — |
| Financial Reporting | Finance | — |
| HR Management | HR | — |
| Procurement | Procurement | — |
| Inventory Tracking | Inventory | — |
| Purchase Orders | Purchase | — |
| Supply Chain | Supply Chain | — |
| ERP Integration | ERP | All nodes |
| Workflow Orchestration | Cross-domain | All nodes |
| Document Management | Cross-domain | All nodes |
| Notification | Cross-domain | All nodes |
