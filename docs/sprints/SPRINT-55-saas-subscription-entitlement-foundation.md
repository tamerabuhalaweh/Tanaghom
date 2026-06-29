# Sprint 55: SaaS Subscription and Entitlement Foundation

Status: implemented locally, pending CI/VPS migration application
Date: 2026-06-29

## Goal

Close the production readiness gap where tenant billing/subscription lifecycle was documented as not implemented. This sprint adds a real internal SaaS subscription and entitlement foundation without pretending payment collection is already automated.

## Delivered

- Added tenant billing/subscription data model:
  - `TenantPlan`
  - `TenantSubscription`
  - `TenantSubscriptionEvent`
- Added migration `20260629_tenant_subscription_entitlements`.
- Added default production plan:
  - key: `commercial_social_production`
  - customer-owned AI/integration credentials
  - Postiz sandbox scheduling entitlement
  - customer-configured social OAuth, GHL, SmartLabs, WhatsApp, Telegram
  - MFA/admin/export/purge-review entitlements
- Backfilled existing tenants with a current active subscription in the migration.
- Updated seed data to create:
  - default tenant
  - production plan
  - current active default subscription
- Added tenant subscription health evaluation:
  - blocks inactive tenant status
  - blocks missing/non-active subscription
  - blocks expired current period
  - merges plan entitlements with subscription overrides
- Added optional production login enforcement:
  - `ENFORCE_TENANT_SUBSCRIPTION=true`
  - when enabled, login requires active/trialing non-expired current subscription
- Added admin API:
  - `GET /admin/tenant/plans`
  - `GET /admin/tenant/subscription`
  - `POST /admin/tenant/subscription`
- Added subscription events with:
  - actor
  - reason
  - before state
  - after state
- Updated Tenant Administration UI:
  - current plan
  - subscription status/source
  - service access
  - entitlements table
  - subscription blockers/warnings
  - manual/external/Stripe-ready update form
- Updated tenant export/delete governance:
  - tenant export includes subscription state and events
  - deletion readiness blocks active/current subscriptions
  - purge worker counts and deletes subscription records only after readiness passes
- Updated production docs and environment variables.

## What This Does Not Claim

- Payment collection is not automated.
- Stripe is not integrated.
- Invoice lifecycle is not implemented.
- Tax/VAT handling is not implemented.
- Dunning/retry/reconciliation is not implemented.
- Subscription enforcement is optional until `ENFORCE_TENANT_SUBSCRIPTION=true` is enabled after migration and tenant records are verified.

## Verification

- `npx prisma generate`: passed
- `DATABASE_URL=... npx prisma validate`: passed
- `npm run typecheck`: passed
- `npx vitest run modules/tenant-admin/lifecycle.test.ts`: 6 tests passed
- `npm run lint`: passed
- `npm run test`: 975 tests passed
- `npm run build`: passed
- `frontend npm run lint`: passed
- `frontend npm run build`: passed
- `npx eslint scripts/purge-tenant.ts`: passed

## Not Verified Locally

- `npx prisma migrate status` could not complete because local PostgreSQL is not reachable on `localhost:5432`.
- Migration `20260629_tenant_subscription_entitlements` must be applied and verified in the CI/VPS database before release.

## Remaining Production Gaps

- Real payment provider integration:
  - Stripe/Paddle/provider choice
  - checkout/customer portal
  - signed webhook verification
  - invoice/payment/dunning/reconciliation workflows
  - taxes/VAT/commercial policy
- Tenant lifecycle automation is still admin/manual driven.
- Off-server backup target and external alert routing still require real destinations.
- Production connector flows still need real customer credentials/accounts:
  - Postiz real channel scheduling
  - GHL writes
  - WhatsApp
  - Telegram
  - SmartLabs voice
  - social OAuth
- OpenClaw, agentgateway, and AgentScope are still not production runtime infrastructure.
- Independent penetration/security review is still not complete.
