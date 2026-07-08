DO $$ BEGIN
  CREATE TYPE "CommercialRevenueLineType" AS ENUM ('live_event', 'online_course', 'b2b', 'platinum_elite', 'certified_trainer_network', 'loyalty_community');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialRevenueLineStatus" AS ENUM ('active', 'paused', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialOperatingStage" AS ENUM ('assess', 'strategy_planning', 'implementation_engagement');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialPlanHorizon" AS ENUM ('three_year', 'one_year', 'quarterly', 'product_or_event');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialPlanStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialAssessmentSeverity" AS ENUM ('info', 'watch', 'risk', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialAssessmentStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "commercial_revenue_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "revenue_line_type" "CommercialRevenueLineType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CommercialRevenueLineStatus" NOT NULL DEFAULT 'active',
  "system_of_record" TEXT NOT NULL DEFAULT 'tanaghum',
  "owner_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commercial_revenue_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commercial_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "revenue_line_id" UUID NOT NULL,
  "linked_event_id" UUID,
  "horizon" "CommercialPlanHorizon" NOT NULL,
  "stage" "CommercialOperatingStage" NOT NULL DEFAULT 'assess',
  "title" TEXT NOT NULL,
  "objective" TEXT,
  "audience" TEXT,
  "budget_target" DECIMAL(12,2),
  "revenue_target" DECIMAL(12,2),
  "kpi_targets" JSONB,
  "strategy_summary" TEXT,
  "action_plan" TEXT,
  "status" "CommercialPlanStatus" NOT NULL DEFAULT 'draft',
  "owner_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commercial_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commercial_assessment_signals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "revenue_line_id" UUID,
  "commercial_plan_id" UUID,
  "source_type" TEXT NOT NULL DEFAULT 'manual',
  "title" TEXT NOT NULL,
  "severity" "CommercialAssessmentSeverity" NOT NULL DEFAULT 'watch',
  "finding" TEXT,
  "recommended_action" TEXT,
  "status" "CommercialAssessmentStatus" NOT NULL DEFAULT 'open',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commercial_assessment_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commercial_revenue_lines_tenant_key_revenue_line_type_key" ON "commercial_revenue_lines"("tenant_key", "revenue_line_type");
CREATE INDEX IF NOT EXISTS "commercial_revenue_lines_tenant_key_idx" ON "commercial_revenue_lines"("tenant_key");
CREATE INDEX IF NOT EXISTS "commercial_revenue_lines_revenue_line_type_idx" ON "commercial_revenue_lines"("revenue_line_type");
CREATE INDEX IF NOT EXISTS "commercial_revenue_lines_status_idx" ON "commercial_revenue_lines"("status");
CREATE INDEX IF NOT EXISTS "commercial_revenue_lines_owner_user_id_idx" ON "commercial_revenue_lines"("owner_user_id");

CREATE INDEX IF NOT EXISTS "commercial_plans_tenant_key_idx" ON "commercial_plans"("tenant_key");
CREATE INDEX IF NOT EXISTS "commercial_plans_revenue_line_id_idx" ON "commercial_plans"("revenue_line_id");
CREATE INDEX IF NOT EXISTS "commercial_plans_linked_event_id_idx" ON "commercial_plans"("linked_event_id");
CREATE INDEX IF NOT EXISTS "commercial_plans_horizon_idx" ON "commercial_plans"("horizon");
CREATE INDEX IF NOT EXISTS "commercial_plans_stage_idx" ON "commercial_plans"("stage");
CREATE INDEX IF NOT EXISTS "commercial_plans_status_idx" ON "commercial_plans"("status");
CREATE INDEX IF NOT EXISTS "commercial_plans_owner_user_id_idx" ON "commercial_plans"("owner_user_id");

CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_tenant_key_idx" ON "commercial_assessment_signals"("tenant_key");
CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_revenue_line_id_idx" ON "commercial_assessment_signals"("revenue_line_id");
CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_commercial_plan_id_idx" ON "commercial_assessment_signals"("commercial_plan_id");
CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_severity_idx" ON "commercial_assessment_signals"("severity");
CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_status_idx" ON "commercial_assessment_signals"("status");
CREATE INDEX IF NOT EXISTS "commercial_assessment_signals_created_by_user_id_idx" ON "commercial_assessment_signals"("created_by_user_id");

ALTER TABLE "commercial_revenue_lines"
  ADD CONSTRAINT "commercial_revenue_lines_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_revenue_lines"
  ADD CONSTRAINT "commercial_revenue_lines_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_revenue_lines"
  ADD CONSTRAINT "commercial_revenue_lines_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_revenue_line_id_fkey"
  FOREIGN KEY ("revenue_line_id") REFERENCES "commercial_revenue_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_linked_event_id_fkey"
  FOREIGN KEY ("linked_event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_assessment_signals"
  ADD CONSTRAINT "commercial_assessment_signals_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_assessment_signals"
  ADD CONSTRAINT "commercial_assessment_signals_revenue_line_id_fkey"
  FOREIGN KEY ("revenue_line_id") REFERENCES "commercial_revenue_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_assessment_signals"
  ADD CONSTRAINT "commercial_assessment_signals_commercial_plan_id_fkey"
  FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_assessment_signals"
  ADD CONSTRAINT "commercial_assessment_signals_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
