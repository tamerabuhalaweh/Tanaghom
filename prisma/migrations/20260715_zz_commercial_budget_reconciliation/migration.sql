CREATE TYPE "CommercialBudgetAllocationLevel" AS ENUM (
  'monthly_item',
  'commercial_plan',
  'event',
  'campaign'
);

CREATE TYPE "CommercialBudgetAllocationStatus" AS ENUM (
  'planned',
  'approved',
  'committed',
  'archived'
);

CREATE TYPE "CommercialBudgetLedgerEntryType" AS ENUM (
  'allocated',
  'reallocated',
  'approved',
  'committed',
  'archived',
  'exception_approved'
);

CREATE TYPE "EventKpiVerificationStatus" AS ENUM (
  'unverified',
  'verified',
  'rejected'
);

CREATE TABLE "commercial_budget_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "annual_plan_id" UUID NOT NULL,
  "parent_allocation_id" UUID,
  "level" "CommercialBudgetAllocationLevel" NOT NULL,
  "monthly_portfolio_item_id" UUID,
  "commercial_plan_id" UUID,
  "event_id" UUID,
  "campaign_id" UUID,
  "currency" "CommercialCurrency" NOT NULL DEFAULT 'AED',
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "CommercialBudgetAllocationStatus" NOT NULL DEFAULT 'planned',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "over_allocation_exception_reason" TEXT,
  "exception_approved_by_user_id" UUID,
  "exception_approved_at" TIMESTAMP(3),
  "created_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(3),
  "committed_by_user_id" UUID,
  "committed_at" TIMESTAMP(3),
  "archived_by_user_id" UUID,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commercial_budget_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_budget_allocations_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "commercial_budget_allocations_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "commercial_budget_allocations_exception_check" CHECK (
    ("over_allocation_exception_reason" IS NULL AND "exception_approved_by_user_id" IS NULL AND "exception_approved_at" IS NULL)
    OR
    (length(trim("over_allocation_exception_reason")) >= 3 AND "exception_approved_by_user_id" IS NOT NULL AND "exception_approved_at" IS NOT NULL)
  ),
  CONSTRAINT "commercial_budget_allocations_target_check" CHECK (
    ("level" = 'monthly_item' AND "monthly_portfolio_item_id" IS NOT NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NULL AND "campaign_id" IS NULL)
    OR
    ("level" = 'commercial_plan' AND "monthly_portfolio_item_id" IS NULL AND "commercial_plan_id" IS NOT NULL AND "event_id" IS NULL AND "campaign_id" IS NULL)
    OR
    ("level" = 'event' AND "monthly_portfolio_item_id" IS NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NOT NULL AND "campaign_id" IS NULL)
    OR
    ("level" = 'campaign' AND "monthly_portfolio_item_id" IS NULL AND "commercial_plan_id" IS NULL AND "event_id" IS NULL AND "campaign_id" IS NOT NULL)
  )
);

CREATE TABLE "commercial_budget_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "allocation_id" UUID NOT NULL,
  "entry_type" "CommercialBudgetLedgerEntryType" NOT NULL,
  "currency" "CommercialCurrency" NOT NULL,
  "amount_before" DECIMAL(14,2),
  "amount_after" DECIMAL(14,2),
  "status_before" "CommercialBudgetAllocationStatus",
  "status_after" "CommercialBudgetAllocationStatus",
  "reason" TEXT NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_budget_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commercial_budget_allocations_tenant_key_idx" ON "commercial_budget_allocations"("tenant_key");
CREATE INDEX "commercial_budget_allocations_annual_plan_id_idx" ON "commercial_budget_allocations"("annual_plan_id");
CREATE INDEX "commercial_budget_allocations_parent_allocation_id_idx" ON "commercial_budget_allocations"("parent_allocation_id");
CREATE INDEX "commercial_budget_allocations_monthly_portfolio_item_id_idx" ON "commercial_budget_allocations"("monthly_portfolio_item_id");
CREATE INDEX "commercial_budget_allocations_commercial_plan_id_idx" ON "commercial_budget_allocations"("commercial_plan_id");
CREATE INDEX "commercial_budget_allocations_event_id_idx" ON "commercial_budget_allocations"("event_id");
CREATE INDEX "commercial_budget_allocations_campaign_id_idx" ON "commercial_budget_allocations"("campaign_id");
CREATE INDEX "commercial_budget_allocations_currency_idx" ON "commercial_budget_allocations"("currency");
CREATE INDEX "commercial_budget_allocations_status_idx" ON "commercial_budget_allocations"("status");
CREATE UNIQUE INDEX "commercial_budget_allocations_active_monthly_key"
  ON "commercial_budget_allocations"("tenant_key", "annual_plan_id", "monthly_portfolio_item_id")
  WHERE "monthly_portfolio_item_id" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX "commercial_budget_allocations_active_plan_key"
  ON "commercial_budget_allocations"("tenant_key", "annual_plan_id", "commercial_plan_id")
  WHERE "commercial_plan_id" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX "commercial_budget_allocations_active_event_key"
  ON "commercial_budget_allocations"("tenant_key", "annual_plan_id", "event_id")
  WHERE "event_id" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX "commercial_budget_allocations_active_campaign_key"
  ON "commercial_budget_allocations"("tenant_key", "annual_plan_id", "campaign_id")
  WHERE "campaign_id" IS NOT NULL AND "archived_at" IS NULL;

CREATE INDEX "commercial_budget_ledger_entries_tenant_key_idx" ON "commercial_budget_ledger_entries"("tenant_key");
CREATE INDEX "commercial_budget_ledger_entries_allocation_id_idx" ON "commercial_budget_ledger_entries"("allocation_id");
CREATE INDEX "commercial_budget_ledger_entries_entry_type_idx" ON "commercial_budget_ledger_entries"("entry_type");
CREATE INDEX "commercial_budget_ledger_entries_created_at_idx" ON "commercial_budget_ledger_entries"("created_at");

ALTER TABLE "commercial_budget_allocations"
  ADD CONSTRAINT "commercial_budget_allocations_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_annual_plan_id_fkey" FOREIGN KEY ("annual_plan_id") REFERENCES "annual_commercial_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_parent_allocation_id_fkey" FOREIGN KEY ("parent_allocation_id") REFERENCES "commercial_budget_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_monthly_portfolio_item_id_fkey" FOREIGN KEY ("monthly_portfolio_item_id") REFERENCES "monthly_portfolio_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_allocations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "content_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_budget_ledger_entries"
  ADD CONSTRAINT "commercial_budget_ledger_entries_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_budget_ledger_entries_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "commercial_budget_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_kpi_records"
  ADD COLUMN "currency" "CommercialCurrency" NOT NULL DEFAULT 'AED',
  ADD COLUMN "verification_status" "EventKpiVerificationStatus" NOT NULL DEFAULT 'unverified',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "connector_import_job_id" UUID,
  ADD COLUMN "campaign_id" UUID,
  ADD COLUMN "source_record_key" TEXT,
  ADD COLUMN "verified_by_user_id" UUID,
  ADD COLUMN "verified_at" TIMESTAMP(3),
  ADD COLUMN "verification_reason" TEXT;

UPDATE "event_kpi_records" AS kpi
SET "currency" = tenant."default_currency"
FROM "tenants" AS tenant
WHERE tenant."tenant_key" = kpi."tenant_key";

-- Existing imported and connector records could only be written by the approval-gated
-- import paths. Manual entries remain unverified and do not count as actual spend.
UPDATE "event_kpi_records"
SET
  "verification_status" = 'verified',
  "verified_by_user_id" = COALESCE("updated_by_user_id", "created_by_user_id"),
  "verified_at" = "updated_at",
  "verification_reason" = 'Migrated from an approval-gated imported or connector KPI record'
WHERE "source_type" IN ('imported', 'connector');

ALTER TABLE "event_kpi_records"
  ADD CONSTRAINT "event_kpi_records_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "event_kpi_records_verification_check" CHECK (
    "verification_status" <> 'verified'
    OR ("verified_by_user_id" IS NOT NULL AND "verified_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "event_kpi_records_connector_import_job_id_fkey" FOREIGN KEY ("connector_import_job_id") REFERENCES "connector_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "event_kpi_records_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "content_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "event_kpi_records_tenant_key_source_name_source_record_key_key"
  ON "event_kpi_records"("tenant_key", "source_name", "source_record_key");
CREATE INDEX "event_kpi_records_verification_status_idx" ON "event_kpi_records"("verification_status");
CREATE INDEX "event_kpi_records_connector_import_job_id_idx" ON "event_kpi_records"("connector_import_job_id");
CREATE INDEX "event_kpi_records_campaign_id_idx" ON "event_kpi_records"("campaign_id");

-- Preserve existing monthly budget values as planned allocation evidence. They are not
-- silently approved or committed during migration.
INSERT INTO "commercial_budget_allocations" (
  "id",
  "tenant_key",
  "annual_plan_id",
  "level",
  "monthly_portfolio_item_id",
  "currency",
  "amount",
  "status",
  "revision",
  "reason",
  "created_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  item."tenant_key",
  item."annual_plan_id",
  'monthly_item',
  item."id",
  item."currency",
  item."budget_allocation",
  'planned',
  1,
  'Migrated planned monthly allocation',
  item."created_by_user_id",
  item."created_at",
  CURRENT_TIMESTAMP
FROM "monthly_portfolio_items" AS item
WHERE item."archived_at" IS NULL;

INSERT INTO "commercial_budget_ledger_entries" (
  "id",
  "tenant_key",
  "allocation_id",
  "entry_type",
  "currency",
  "amount_before",
  "amount_after",
  "status_before",
  "status_after",
  "reason",
  "actor_user_id",
  "metadata",
  "created_at"
)
SELECT
  gen_random_uuid(),
  allocation."tenant_key",
  allocation."id",
  'allocated',
  allocation."currency",
  NULL,
  allocation."amount",
  NULL,
  allocation."status",
  allocation."reason",
  allocation."created_by_user_id",
  jsonb_build_object('migration', true, 'source', 'monthly_portfolio_items.budget_allocation'),
  allocation."created_at"
FROM "commercial_budget_allocations" AS allocation
WHERE allocation."reason" = 'Migrated planned monthly allocation';
