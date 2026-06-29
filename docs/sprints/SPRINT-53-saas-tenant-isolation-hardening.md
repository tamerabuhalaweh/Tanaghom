# Sprint 53: SaaS Tenant Isolation Hardening

Status: implemented locally, pending CI/VPS migration application
Date: 2026-06-29

## Goal

Harden the Commercial/Social production runtime so core customer records carry direct tenant ownership and runtime reads/writes enforce tenant scope without relying only on indirect user joins.

## Delivered

- Added direct `tenant_key` ownership to core Commercial/Social records:
  - `ContentRequest`
  - `ContentItem`
  - `Approval`
  - `PublishingPackage`
  - `AnalyticsIngestionRequest`
  - `AnalyticsSnapshot`
  - `CampaignPerformanceReport`
  - `LeadCaptureRecord`
- Added migration `20260629_core_commercial_tenant_keys`:
  - creates/backfills tenant keys from existing user/campaign/package relationships
  - adds tenant indexes
  - adds foreign-key constraints to `tenants(tenant_key)`
- Updated runtime tenant enforcement for:
  - Campaign create/list/read/update/transition
  - AI draft generation/revision/edit
  - Approval list/read/decision packet/approve/reject/request changes
  - Publishing package creation/listing
  - Publishing preparation package/readiness/manifest helpers
  - Lead capture/list/stats/qualification
  - CRM conversion lead and handoff helpers
  - Analytics snapshots/reports/ingestion helpers
  - Postiz package payload and execution-request helpers
  - Commercial workflow state/evidence/run synchronization
- Added regression coverage:
  - `modules/tenant-isolation/core-commercial-tenant-isolation.test.ts`
  - updated AI provider readiness and workflow-run tests for tenant-scoped query behavior

## Verification

- `npx prisma generate`: passed
- `DATABASE_URL=... npx prisma validate`: passed
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run test`: 971 tests passed
- `npm run build`: passed
- `frontend npm run lint`: passed
- `frontend npm run build`: passed

## Not Verified Locally

- `npx prisma migrate status` could not run because local PostgreSQL was not listening on `localhost:5432`.
- The migration still must be applied and verified in CI/VPS/database environment before release.

## Remaining Production Gaps

- Full tenant lifecycle is still incomplete:
  - billing/subscriptions
  - tenant export/delete
  - hard-delete purge worker
  - tenant lifecycle automation
- Some child execution tables still rely on tenant validation through parent package/lead records rather than direct `tenant_key` columns.
- Production connector flows still need customer credentials and real account testing:
  - Postiz real channel scheduling
  - GHL writes
  - WhatsApp
  - Telegram
  - SmartLabs voice
  - social OAuth
- OpenClaw, agentgateway, and AgentScope are still not production runtime infrastructure.
- Off-server backups and external alert routing still require customer/team-provided destinations.
- Independent penetration/security review is still not complete.
