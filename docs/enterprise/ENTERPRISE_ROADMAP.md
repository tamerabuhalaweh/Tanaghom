# Enterprise Sprint Roadmap

> **Version**: 1.1
> **Date**: 2026-06-23

## Overview

Enterprise sprint roadmap for the Tanaghom AI Enterprise Platform.

**Note**: STITCH architecture concepts are NOT Tanaghum business pillars. 5-pillar business taxonomy confirmed; exact names/definitions pending customer confirmation.

## Completed Sprints

| Sprint | Name | Status | Tests |
|---|---|---|---|
| 4.5–11 | STITCH substrates | ✅ Complete | 532 |
| 12–13 | Asset Cognition, Operating Surface | ✅ Complete | 604 |
| 14–16 | Publishing, Postiz, Analytics | ✅ Complete | 703 |
| 17–19 | Learning, CRM, Production | ✅ Complete | 793 |
| 20 | E2E QA & Security | ✅ Complete | 826 |
| 21 | UI/UX Demo Shell | ✅ Complete | 826 |
| 22 | Deployment & Security | ✅ Complete | 856 |
| 23 | Demo Deployment Package | ✅ Complete | 856 |
| 24 | Pilot Hardening & Evidence | ✅ Complete | 855 |
| 25 | Enterprise Architecture Reconciliation | ✅ Complete | 855 |
| 26 | Taxonomy Decision + Capability/Topology Registry | 🔄 In Progress | 871 |

## Next Sprint (After PR #27 Merge)

| Sprint | Name | Domain | Status |
|---|---|---|---|
| 27 | Commercial/Social Media Demo Readiness & Golden Path | Commercial/Content | ⏳ Planned |

## Planned Sprints (Deferred)

### Phase 1: Enterprise Foundation (After Demo Approval)

| Sprint | Name | Domain | Status |
|---|---|---|---|
| TBD | Finance Domain Pack | Finance | ⏳ Deferred |
| TBD | HR Domain Pack | HR | ⏳ Deferred |
| TBD | Procurement Domain Pack | Procurement | ⏳ Deferred |
| TBD | Inventory Domain Pack | Inventory | ⏳ Deferred |
| TBD | Purchase Management Domain Pack | Purchase | ⏳ Deferred |
| TBD | Supply Chain Domain Pack | Supply Chain | ⏳ Deferred |

### Phase 2: ERP Integration (After Domain Packs)

| Sprint | Name | Domain | Status |
|---|---|---|---|
| TBD | ERP Connector Framework | ERP | ⏳ Deferred |
| TBD | Oracle Fusion Connector | ERP | ⏳ Deferred |
| TBD | SAP Connector | ERP | ⏳ Deferred |
| TBD | Microsoft Dynamics Connector | ERP | ⏳ Deferred |
| 30 | Inventory Domain Pack | Inventory | ⏳ Planned |

### Phase 2: Domain Implementation (Sprints 31–36)

| Sprint | Name | Domain | Status |
|---|---|---|---|
| 31 | Purchase Management Domain Pack | Purchase | ⏳ Planned |
| 32 | Supply Chain Domain Pack | Supply Chain | ⏳ Planned |
| 33 | Cross-Domain Integration Layer | Cross-domain | ⏳ Planned |
| 34 | Enterprise Dashboard UI | Cross-domain | ⏳ Planned |
| 35 | Enterprise Analytics & Reporting | Cross-domain | ⏳ Planned |
| 36 | Enterprise Governance & Compliance | Cross-domain | ⏳ Planned |

### Phase 3: ERP Integration (Sprints 37–40+)

| Sprint | Name | Domain | Status |
|---|---|---|---|
| 37 | ERP Connector Framework | ERP | ⏳ Planned |
| 38 | Oracle Fusion Connector | ERP | ⏳ Planned |
| 39 | SAP Connector | ERP | ⏳ Planned |
| 40 | Microsoft Dynamics Connector | ERP | ⏳ Planned |

## Domain Pack Structure

Each domain pack follows:

1. **Sprint N+1**: Domain pack documentation and architecture
2. **Sprint N+2**: Domain pack implementation
3. **Sprint N+3**: Domain pack testing and integration
4. **Sprint N+4**: Domain pack deployment and evidence

## ERP Integration Rules

| Rule | Description |
|---|---|
| Optional | ERP integrations are not required |
| Separately scoped | ERP scope separate from platform |
| Separately quoted | ERP work quoted separately |
| Separately priced | ERP pricing separate |
| Separately approved | ERP approval separate |
| Write-back blocked | ERP write-back blocked by default |
| SAIF decision | ERP integration requires SAIF package |

## Milestone Markers

| Milestone | Sprint | Description |
|---|---|---|
| Enterprise Foundation | 30 | All domain packs documented |
| Domain Implementation | 36 | All domains implemented |
| ERP Integration | 40+ | ERP connectors available |
| Production Ready | TBD | Platform ready for production |

## Dependencies

| Dependency | Status | Impact |
|---|---|---|
| SRD v1.2 | ✅ Approved | All sprints |
| STITCH Reconciliation | ✅ Approved | All sprints |
| SAIF v1.2 | ✅ Approved | All sprints |
| Customer Approval | ✅ Approved | All sprints |
| ERP Vendor Access | ⏳ Future | ERP sprints |
| Production Environment | ⏳ Future | Deployment sprints |
