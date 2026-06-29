CREATE TYPE "TenantPlanStatus" AS ENUM ('active', 'retired');
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired');
CREATE TYPE "TenantSubscriptionSource" AS ENUM ('manual', 'stripe', 'external_contract');

CREATE TABLE "tenant_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "TenantPlanStatus" NOT NULL DEFAULT 'active',
  "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthly_price_cents" INTEGER,
  "annual_price_cents" INTEGER,
  "entitlements" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'trialing',
  "source" "TenantSubscriptionSource" NOT NULL DEFAULT 'manual',
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "external_customer_ref" TEXT,
  "external_subscription_ref" TEXT,
  "trial_ends_at" TIMESTAMP(3),
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "entitlements_override" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_subscription_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "subscription_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_user_id" UUID,
  "reason" TEXT,
  "before_state" JSONB,
  "after_state" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_plans_plan_key_key" ON "tenant_plans"("plan_key");
CREATE INDEX "tenant_plans_status_idx" ON "tenant_plans"("status");
CREATE INDEX "tenant_subscriptions_tenant_key_idx" ON "tenant_subscriptions"("tenant_key");
CREATE INDEX "tenant_subscriptions_plan_id_idx" ON "tenant_subscriptions"("plan_id");
CREATE INDEX "tenant_subscriptions_status_idx" ON "tenant_subscriptions"("status");
CREATE INDEX "tenant_subscriptions_is_current_idx" ON "tenant_subscriptions"("is_current");
CREATE INDEX "tenant_subscriptions_current_period_end_idx" ON "tenant_subscriptions"("current_period_end");
CREATE INDEX "tenant_subscription_events_tenant_key_idx" ON "tenant_subscription_events"("tenant_key");
CREATE INDEX "tenant_subscription_events_subscription_id_idx" ON "tenant_subscription_events"("subscription_id");
CREATE INDEX "tenant_subscription_events_event_type_idx" ON "tenant_subscription_events"("event_type");
CREATE INDEX "tenant_subscription_events_actor_user_id_idx" ON "tenant_subscription_events"("actor_user_id");
CREATE INDEX "tenant_subscription_events_created_at_idx" ON "tenant_subscription_events"("created_at");

ALTER TABLE "tenant_subscriptions"
  ADD CONSTRAINT "tenant_subscriptions_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_subscriptions"
  ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "tenant_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_subscription_events"
  ADD CONSTRAINT "tenant_subscription_events_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_subscription_events"
  ADD CONSTRAINT "tenant_subscription_events_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "tenant_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_subscription_events"
  ADD CONSTRAINT "tenant_subscription_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "tenant_plans" (
  "plan_key",
  "name",
  "description",
  "status",
  "billing_interval",
  "currency",
  "monthly_price_cents",
  "annual_price_cents",
  "entitlements"
) VALUES (
  'commercial_social_production',
  'Commercial/Social Production',
  'Production Commercial/Social workspace with customer-owned AI and integration credentials.',
  'active',
  'monthly',
  'USD',
  NULL,
  NULL,
  '{
    "maxUsers": 25,
    "maxCampaigns": 500,
    "aiProviderCredentials": true,
    "postizSandboxScheduling": true,
    "postizLiveScheduling": "requires_customer_channel_and_authorization",
    "socialOAuth": "customer_configured",
    "goHighLevel": "customer_configured",
    "smartLabsVoice": "customer_configured",
    "whatsApp": "customer_configured",
    "telegram": "customer_configured",
    "mfaRequiredForAdmins": true,
    "tenantExport": true,
    "tenantPurgeReview": true,
    "auditRetention": "preserve"
  }'::jsonb
) ON CONFLICT ("plan_key") DO NOTHING;

INSERT INTO "tenant_subscriptions" (
  "tenant_key",
  "plan_id",
  "status",
  "source",
  "is_current",
  "current_period_start",
  "current_period_end",
  "notes"
)
SELECT
  t."tenant_key",
  p."id",
  'active',
  'manual',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  'Backfilled default production entitlement subscription during Sprint 55 migration.'
FROM "tenants" t
CROSS JOIN "tenant_plans" p
WHERE p."plan_key" = 'commercial_social_production'
  AND NOT EXISTS (
    SELECT 1
    FROM "tenant_subscriptions" s
    WHERE s."tenant_key" = t."tenant_key"
      AND s."is_current" = true
  );
