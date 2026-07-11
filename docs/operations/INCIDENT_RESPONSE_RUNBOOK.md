# Hybrid Production Incident Response Runbook

## Scope And Ownership

This runbook applies only to the Hybrid production environment. The customer or delivery owner must assign named people to these roles before unrestricted production sign-off:

| Role | Responsibility |
|---|---|
| Incident Commander | Owns severity, coordination, timeline, and closure |
| Technical Lead | Diagnoses application, database, Redis, and deployment state |
| Security Lead | Handles suspected compromise, secrets, evidence, and notifications |
| Customer Contact | Communicates customer impact and business workaround |

## Severity

| Severity | Definition | Initial response target |
|---|---|---|
| SEV-1 | Security breach, cross-tenant exposure, data loss, or full outage | 15 minutes |
| SEV-2 | Major customer workflow unavailable or sustained connector failure | 30 minutes |
| SEV-3 | Degraded non-critical feature with workaround | 4 business hours |

## First 15 Minutes

1. Open an incident record and assign an Incident Commander.
2. Record start time, affected tenant, URLs, request IDs, and customer impact.
3. Check the GitHub `Hybrid External Uptime` workflow and VPS systemd/Prometheus state.
4. Check `/api/health`, containers, PostgreSQL, Redis, disk, and latest backup evidence.
5. If external writes may be unsafe, keep or set all execution flags to `false`.
6. Preserve logs and audit evidence. Do not delete containers, logs, or database records.
7. Rotate only credentials known or reasonably suspected to be exposed.

## Recovery Priorities

1. Protect tenant data and stop unsafe external actions.
2. Restore authentication and read-only customer access.
3. Restore internal writes and approval workflows.
4. Restore customer-owned connector reads.
5. Re-enable external execution only after explicit authorization and validation.

## Required Closure Evidence

- Timeline and customer impact.
- Root cause and contributing conditions.
- Commands/actions taken, with request IDs where available.
- Data-integrity and tenant-isolation validation.
- Corrective issue, owner, deadline, and regression test.
- Customer communication and Incident Commander approval.
