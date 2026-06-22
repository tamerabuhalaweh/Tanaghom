# ERP Connector Governance

> **Version**: 1.0
> **Date**: 2026-06-22

## Purpose

ERP integrations are optional, separately scoped, separately quoted, separately priced, and separately approved. This document defines the governance rules for ERP connectors.

## Supported ERP Systems (Optional)

| ERP System | Integration Type | Status |
|---|---|---|
| Oracle Fusion | REST API / SOAP | ⏳ Future |
| SAP | RFC / REST API | ⏳ Future |
| Microsoft Dynamics | REST API | ⏳ Future |
| Other | Custom | ⏳ Future |

## Governance Rules

### 1. Separation of Concerns

| Concern | Rule |
|---|---|
| Scope | ERP scope is defined separately from core platform |
| Quoting | ERP work is quoted separately |
| Pricing | ERP pricing is separate from platform pricing |
| Approval | ERP approval is separate from platform approval |
| Timeline | ERP timeline is separate from platform timeline |

### 2. Technical Constraints

| Constraint | Rule |
|---|---|
| Write-back blocked | ERP write-back is blocked by default |
| Read-only default | ERP access is read-only by default |
| MCP mediation | ERP access through MCP mediation only |
| No direct access | No direct ERP API access from agents |
| Audit trail | All ERP access logged and audited |

### 3. Data Governance

| Rule | Description |
|---|---|
| Data mapping | ERP data mapping must be explicitly defined |
| Data validation | ERP data must be validated before use |
| Data transformation | ERP data transformation must be documented |
| Data conflict resolution | ERP data conflicts must have resolution rules |

### 4. Security

| Rule | Description |
|---|---|
| Credential management | ERP credentials in secrets manager |
| Access control | ERP access through role-based control |
| Rate limiting | ERP access rate-limited |
| Error handling | ERP errors handled gracefully |

### 5. SAIF Decision Package

ERP integrations require SAIF decision packages with:

- **Significance**: High or Critical
- **Security Posture**: Must be positive
- **Human Oversight**: Must be positive
- **Compliance**: Must be positive
- **Cost-Benefit**: Must be documented
- **Execution Handoff**: Must be explicit

## Implementation Pattern

```
Agent → MCP Mediator → ERP Connector → ERP System
```

## Blocked Operations

| Operation | Status |
|---|---|
| Direct ERP API access | ❌ Blocked |
| ERP write-back | ❌ Blocked by default |
| Unmediated ERP calls | ❌ Blocked |
| Credential exposure | ❌ Blocked |

## Future ERP Connector Architecture

When ERP connectors are approved:

1. **SAIF decision package** required
2. **Separate sprint** for implementation
3. **Separate testing** for ERP integration
4. **Separate deployment** for ERP connectors
5. **Separate monitoring** for ERP access
6. **Separate documentation** for ERP operations
