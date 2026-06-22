# Pack Boundary Model

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

Tanaghum-specific doctrine must live in governed packs, not STITCH Core. This model defines how domain-specific knowledge is organized.

## Pack Structure

```
enterprise-packs/
├── commercial/          # Commercial/Social/Content domain
├── finance/             # Finance domain
├── hr/                  # HR domain
├── procurement/         # Procurement domain
├── inventory/           # Inventory domain
├── purchase/            # Purchase Management domain
├── supply-chain/        # Supply Chain domain
└── erp/                 # ERP integrations
```

## Pack Contents

Each pack contains:

| File | Purpose |
|---|---|
| `README.md` | Pack overview and domain description |
| `capabilities.md` | Domain-specific capabilities |
| `workflows.md` | Domain-specific workflows |
| `state-machines.md` | Domain-specific state machines |
| `integrations.md` | Domain-specific integrations |
| `governance.md` | Domain-specific governance rules |
| `saif-packages.md` | Domain-specific SAIF decision packages |

## Pack Rules

1. **Packs are isolated** — Each pack is self-contained
2. **Packs reference STITCH** — Packs must reference STITCH objects, not redefine them
3. **Packs are governed** — Each pack has its own governance rules
4. **Packs are versioned** — Each pack is versioned independently
5. **Packs are approved** — Each pack requires approval before use

## Content Overlay Model

The Commercial/Content domain is the current implementation. It serves as an overlay on top of STITCH.

| Layer | Purpose | Current Status |
|---|---|---|
| STITCH Core | Substrate objects | ✅ Implemented |
| Commercial/Content Overlay | Domain-specific logic | ✅ Implemented |
| Other Domain Overlays | Future domains | ⏳ Future |

## Pack Boundary Enforcement

1. **No cross-pack imports** — Packs must not import from other packs directly
2. **Shared capabilities** — Common capabilities go in STITCH Core or shared modules
3. **Event-driven communication** — Packs communicate via domain events
4. **MCP mediation** — External access through MCP mediation
5. **SAIF decisions** — Cross-pack decisions require SAIF decision packages

## ERP Connector Governance

ERP integrations are optional, separately scoped, separately quoted, separately priced, and separately approved.

| Rule | Description |
|---|---|
| Optional | ERP integrations are not required for platform operation |
| Separately scoped | ERP scope is defined separately from core platform |
| Separately quoted | ERP work is quoted separately |
| Separately priced | ERP pricing is separate from platform pricing |
| Separately approved | ERP approval is separate from platform approval |
| Write-back blocked | ERP write-back is blocked by default |
| Read-only default | ERP access is read-only by default |
| MCP mediation | ERP access through MCP mediation only |
