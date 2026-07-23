-- Customer-confirmed governed KPI targets and plan-scoped GHL attribution.

CREATE TYPE "CommercialKpiScope" AS ENUM (
  'annual_strategy',
  'monthly_portfolio',
  'execution_plan',
  'event',
  'product_campaign'
);

CREATE TYPE "CommercialKpiUnit" AS ENUM (
  'currency',
  'percentage',
  'count',
  'ratio',
  'duration_days'
);

CREATE TYPE "CommercialKpiDirection" AS ENUM (
  'minimum',
  'maximum',
  'target',
  'target_range'
);

CREATE TYPE "CommercialKpiControlMode" AS ENUM (
  'locked',
  'inherited',
  'adjustable'
);

CREATE TYPE "CommercialKpiTargetStatus" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'superseded',
  'archived'
);

CREATE TYPE "GhlAttributionMappingStatus" AS ENUM (
  'draft',
  'approved',
  'superseded',
  'archived'
);

CREATE TYPE "GhlAttributionMatchMode" AS ENUM ('any', 'all');

CREATE TYPE "LeadPaymentStatus" AS ENUM (
  'unknown',
  'partial',
  'paid_in_full',
  'refunded',
  'cancelled'
);

ALTER TABLE "commercial_events"
  ADD COLUMN "venue_capacity" INTEGER,
  ADD COLUMN "sellable_ticket_capacity" INTEGER,
  ADD COLUMN "capacity_source" TEXT,
  ADD COLUMN "capacity_confirmed_at" TIMESTAMP(3);

ALTER TABLE "lead_capture_records"
  ADD COLUMN "payment_status" "LeadPaymentStatus" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "sale_value" DECIMAL(12, 2),
  ADD COLUMN "amount_paid" DECIMAL(12, 2),
  ADD COLUMN "outstanding_balance" DECIMAL(12, 2),
  ADD COLUMN "ticket_quantity" INTEGER,
  ADD COLUMN "payment_source" TEXT,
  ADD COLUMN "commercial_plan_id" UUID,
  ADD COLUMN "ghl_attribution_mapping_id" UUID;

CREATE TABLE "commercial_kpi_targets" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "metric_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "unit" "CommercialKpiUnit" NOT NULL,
  "direction" "CommercialKpiDirection" NOT NULL,
  "scope" "CommercialKpiScope" NOT NULL,
  "control_mode" "CommercialKpiControlMode" NOT NULL,
  "status" "CommercialKpiTargetStatus" NOT NULL DEFAULT 'draft',
  "currency" "CommercialCurrency",
  "target_value" DECIMAL(16, 4) NOT NULL,
  "warning_value" DECIMAL(16, 4),
  "critical_value" DECIMAL(16, 4),
  "lower_bound" DECIMAL(16, 4),
  "upper_bound" DECIMAL(16, 4),
  "annual_plan_id" UUID,
  "monthly_item_id" UUID,
  "commercial_plan_id" UUID,
  "event_id" UUID,
  "campaign_id" UUID,
  "parent_target_id" UUID,
  "supersedes_target_id" UUID,
  "owner_user_id" UUID,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "amendment_reason" TEXT,
  "superseded_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_kpi_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ghl_plan_attribution_mappings" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "event_id" UUID,
  "mapping_version" INTEGER NOT NULL DEFAULT 1,
  "status" "GhlAttributionMappingStatus" NOT NULL DEFAULT 'draft',
  "location_id" TEXT NOT NULL,
  "pipeline_id" TEXT,
  "identifying_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source_values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "match_mode" "GhlAttributionMatchMode" NOT NULL DEFAULT 'any',
  "payment_amount_field" TEXT,
  "sale_value_field" TEXT,
  "ticket_quantity_field" TEXT,
  "payment_status_field" TEXT,
  "custom_field_rules" JSONB,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "created_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ghl_plan_attribution_mappings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ghl_lead_sync_runs"
  ADD COLUMN "attribution_mapping_id" UUID;

CREATE INDEX "commercial_kpi_targets_tenant_key_idx" ON "commercial_kpi_targets"("tenant_key");
CREATE INDEX "commercial_kpi_targets_scope_idx" ON "commercial_kpi_targets"("scope");
CREATE INDEX "commercial_kpi_targets_status_idx" ON "commercial_kpi_targets"("status");
CREATE INDEX "commercial_kpi_targets_metric_key_idx" ON "commercial_kpi_targets"("metric_key");
CREATE INDEX "commercial_kpi_targets_annual_plan_id_idx" ON "commercial_kpi_targets"("annual_plan_id");
CREATE INDEX "commercial_kpi_targets_monthly_item_id_idx" ON "commercial_kpi_targets"("monthly_item_id");
CREATE INDEX "commercial_kpi_targets_commercial_plan_id_idx" ON "commercial_kpi_targets"("commercial_plan_id");
CREATE INDEX "commercial_kpi_targets_event_id_idx" ON "commercial_kpi_targets"("event_id");
CREATE INDEX "commercial_kpi_targets_campaign_id_idx" ON "commercial_kpi_targets"("campaign_id");
CREATE INDEX "commercial_kpi_targets_parent_target_id_idx" ON "commercial_kpi_targets"("parent_target_id");
CREATE INDEX "commercial_kpi_targets_supersedes_target_id_idx" ON "commercial_kpi_targets"("supersedes_target_id");

CREATE UNIQUE INDEX "ghl_plan_mapping_plan_version_key"
  ON "ghl_plan_attribution_mappings"("commercial_plan_id", "mapping_version");
CREATE UNIQUE INDEX "ghl_plan_mapping_one_approved_per_plan_key"
  ON "ghl_plan_attribution_mappings"("commercial_plan_id")
  WHERE "status" = 'approved';
CREATE INDEX "ghl_plan_mapping_tenant_idx" ON "ghl_plan_attribution_mappings"("tenant_key");
CREATE INDEX "ghl_plan_mapping_event_idx" ON "ghl_plan_attribution_mappings"("event_id");
CREATE INDEX "ghl_plan_mapping_status_idx" ON "ghl_plan_attribution_mappings"("status");
CREATE INDEX "ghl_plan_mapping_pipeline_idx" ON "ghl_plan_attribution_mappings"("pipeline_id");

CREATE INDEX "lead_capture_records_commercial_plan_id_idx" ON "lead_capture_records"("commercial_plan_id");
CREATE INDEX "lead_capture_records_ghl_mapping_id_idx" ON "lead_capture_records"("ghl_attribution_mapping_id");
CREATE INDEX "lead_capture_records_payment_status_idx" ON "lead_capture_records"("payment_status");
CREATE INDEX "ghl_lead_sync_runs_attribution_mapping_id_idx" ON "ghl_lead_sync_runs"("attribution_mapping_id");

ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_tenant_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_annual_fkey"
  FOREIGN KEY ("annual_plan_id") REFERENCES "annual_commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_monthly_fkey"
  FOREIGN KEY ("monthly_item_id") REFERENCES "monthly_portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_plan_fkey"
  FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_event_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_campaign_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "content_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_parent_fkey"
  FOREIGN KEY ("parent_target_id") REFERENCES "commercial_kpi_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_supersedes_fkey"
  FOREIGN KEY ("supersedes_target_id") REFERENCES "commercial_kpi_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_owner_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_submitted_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_approved_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_created_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_tenant_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_plan_fkey"
  FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_event_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_created_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_approved_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lead_capture_records"
  ADD CONSTRAINT "lead_capture_records_commercial_plan_fkey"
  FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_capture_records"
  ADD CONSTRAINT "lead_capture_records_ghl_mapping_fkey"
  FOREIGN KEY ("ghl_attribution_mapping_id") REFERENCES "ghl_plan_attribution_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ghl_lead_sync_runs"
  ADD CONSTRAINT "ghl_lead_sync_runs_attribution_mapping_fkey"
  FOREIGN KEY ("attribution_mapping_id") REFERENCES "ghl_plan_attribution_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_events"
  ADD CONSTRAINT "commercial_events_capacity_check"
  CHECK (
    ("venue_capacity" IS NULL AND "sellable_ticket_capacity" IS NULL)
    OR (
      "venue_capacity" > 0
      AND "sellable_ticket_capacity" > 0
      AND "sellable_ticket_capacity" <= "venue_capacity"
    )
  );

ALTER TABLE "lead_capture_records"
  ADD CONSTRAINT "lead_capture_records_payment_values_check"
  CHECK (
    ("sale_value" IS NULL OR "sale_value" >= 0)
    AND ("amount_paid" IS NULL OR "amount_paid" >= 0)
    AND ("outstanding_balance" IS NULL OR "outstanding_balance" >= 0)
    AND ("ticket_quantity" IS NULL OR "ticket_quantity" > 0)
  );

ALTER TABLE "commercial_kpi_targets"
  ADD CONSTRAINT "commercial_kpi_targets_values_check"
  CHECK (
    "target_value" >= 0
    AND ("warning_value" IS NULL OR "warning_value" >= 0)
    AND ("critical_value" IS NULL OR "critical_value" >= 0)
    AND ("lower_bound" IS NULL OR "lower_bound" >= 0)
    AND ("upper_bound" IS NULL OR "upper_bound" >= 0)
    AND ("lower_bound" IS NULL OR "upper_bound" IS NULL OR "lower_bound" <= "upper_bound")
  ),
  ADD CONSTRAINT "commercial_kpi_targets_scope_check"
  CHECK (
    ("scope" = 'annual_strategy' AND "annual_plan_id" IS NOT NULL AND "monthly_item_id" IS NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NULL AND "campaign_id" IS NULL)
    OR ("scope" = 'monthly_portfolio' AND "annual_plan_id" IS NULL AND "monthly_item_id" IS NOT NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NULL AND "campaign_id" IS NULL)
    OR ("scope" = 'execution_plan' AND "annual_plan_id" IS NULL AND "monthly_item_id" IS NULL AND "commercial_plan_id" IS NOT NULL AND "event_id" IS NULL AND "campaign_id" IS NULL)
    OR ("scope" = 'event' AND "annual_plan_id" IS NULL AND "monthly_item_id" IS NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NOT NULL AND "campaign_id" IS NULL)
    OR ("scope" = 'product_campaign' AND "annual_plan_id" IS NULL AND "monthly_item_id" IS NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NULL AND "campaign_id" IS NOT NULL)
  );

ALTER TABLE "ghl_plan_attribution_mappings"
  ADD CONSTRAINT "ghl_plan_mapping_identity_check"
  CHECK (
    "pipeline_id" IS NOT NULL
    OR cardinality("identifying_tags") > 0
    OR cardinality("source_values") > 0
    OR (
      "custom_field_rules" IS NOT NULL
      AND jsonb_typeof("custom_field_rules") = 'array'
      AND jsonb_array_length("custom_field_rules") > 0
    )
  ),
  ADD CONSTRAINT "ghl_plan_mapping_effective_dates_check"
  CHECK (
    "effective_from" IS NULL
    OR "effective_to" IS NULL
    OR "effective_to" >= "effective_from"
  );
