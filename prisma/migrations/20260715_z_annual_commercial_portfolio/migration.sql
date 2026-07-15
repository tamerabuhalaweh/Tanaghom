CREATE TYPE "AnnualCommercialPlanStatus" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'active',
  'closed',
  'archived'
);

CREATE TYPE "MonthlyPortfolioPriority" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "MonthlyPortfolioReadiness" AS ENUM ('planned', 'needs_brief', 'ready', 'blocked', 'completed');

CREATE TABLE "annual_commercial_plans" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "scenario_version" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "strategy" TEXT,
  "currency" "CommercialCurrency" NOT NULL DEFAULT 'AED',
  "budget_target" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "revenue_target" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "AnnualCommercialPlanStatus" NOT NULL DEFAULT 'draft',
  "owner_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "activated_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "annual_commercial_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "annual_commercial_plans_year_check" CHECK ("year" BETWEEN 2000 AND 2200),
  CONSTRAINT "annual_commercial_plans_targets_check" CHECK ("budget_target" >= 0 AND "revenue_target" >= 0),
  CONSTRAINT "annual_commercial_plans_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "annual_commercial_plans_scenario_version_check" CHECK ("scenario_version" > 0)
);

CREATE TABLE "monthly_portfolio_items" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "annual_plan_id" UUID NOT NULL,
  "month" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "revenue_line_id" UUID NOT NULL,
  "commercial_plan_id" UUID,
  "event_id" UUID,
  "title" TEXT NOT NULL,
  "planned_start_date" TIMESTAMP(3),
  "planned_end_date" TIMESTAMP(3),
  "currency" "CommercialCurrency" NOT NULL DEFAULT 'AED',
  "budget_allocation" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "revenue_target" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "priority" "MonthlyPortfolioPriority" NOT NULL DEFAULT 'medium',
  "readiness" "MonthlyPortfolioReadiness" NOT NULL DEFAULT 'planned',
  "owner_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_portfolio_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_portfolio_items_month_check" CHECK ("month" BETWEEN 1 AND 12),
  CONSTRAINT "monthly_portfolio_items_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "monthly_portfolio_items_targets_check" CHECK ("budget_allocation" >= 0 AND "revenue_target" >= 0),
  CONSTRAINT "monthly_portfolio_items_dates_check" CHECK (
    "planned_start_date" IS NULL OR "planned_end_date" IS NULL OR "planned_end_date" >= "planned_start_date"
  )
);

CREATE TABLE "annual_commercial_plan_learning_sets" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "annual_plan_id" UUID NOT NULL,
  "learning_set_id" UUID NOT NULL,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "annual_commercial_plan_learning_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "annual_commercial_plans_tenant_key_year_scenario_version_key"
  ON "annual_commercial_plans"("tenant_key", "year", "scenario_version");
CREATE UNIQUE INDEX "annual_commercial_plans_one_current_year_key"
  ON "annual_commercial_plans"("tenant_key", "year")
  WHERE "status" IN ('approved', 'active');
CREATE INDEX "annual_commercial_plans_tenant_key_idx" ON "annual_commercial_plans"("tenant_key");
CREATE INDEX "annual_commercial_plans_year_idx" ON "annual_commercial_plans"("year");
CREATE INDEX "annual_commercial_plans_status_idx" ON "annual_commercial_plans"("status");
CREATE INDEX "annual_commercial_plans_owner_user_id_idx" ON "annual_commercial_plans"("owner_user_id");

CREATE INDEX "monthly_portfolio_items_tenant_key_idx" ON "monthly_portfolio_items"("tenant_key");
CREATE INDEX "monthly_portfolio_items_annual_plan_id_month_sort_order_idx"
  ON "monthly_portfolio_items"("annual_plan_id", "month", "sort_order");
CREATE INDEX "monthly_portfolio_items_revenue_line_id_idx" ON "monthly_portfolio_items"("revenue_line_id");
CREATE INDEX "monthly_portfolio_items_commercial_plan_id_idx" ON "monthly_portfolio_items"("commercial_plan_id");
CREATE INDEX "monthly_portfolio_items_event_id_idx" ON "monthly_portfolio_items"("event_id");
CREATE INDEX "monthly_portfolio_items_readiness_idx" ON "monthly_portfolio_items"("readiness");
CREATE INDEX "monthly_portfolio_items_owner_user_id_idx" ON "monthly_portfolio_items"("owner_user_id");

CREATE UNIQUE INDEX "annual_commercial_plan_learning_sets_annual_plan_id_learning_set_id_key"
  ON "annual_commercial_plan_learning_sets"("annual_plan_id", "learning_set_id");
CREATE INDEX "annual_commercial_plan_learning_sets_tenant_key_idx"
  ON "annual_commercial_plan_learning_sets"("tenant_key");
CREATE INDEX "annual_commercial_plan_learning_sets_learning_set_id_idx"
  ON "annual_commercial_plan_learning_sets"("learning_set_id");

ALTER TABLE "annual_commercial_plans"
  ADD CONSTRAINT "annual_commercial_plans_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plans_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plans_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plans_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monthly_portfolio_items"
  ADD CONSTRAINT "monthly_portfolio_items_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_annual_plan_id_fkey" FOREIGN KEY ("annual_plan_id") REFERENCES "annual_commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_revenue_line_id_fkey" FOREIGN KEY ("revenue_line_id") REFERENCES "commercial_revenue_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "monthly_portfolio_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "annual_commercial_plan_learning_sets"
  ADD CONSTRAINT "annual_commercial_plan_learning_sets_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plan_learning_sets_annual_plan_id_fkey" FOREIGN KEY ("annual_plan_id") REFERENCES "annual_commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "annual_commercial_plan_learning_sets_learning_set_id_fkey" FOREIGN KEY ("learning_set_id") REFERENCES "commercial_learning_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
