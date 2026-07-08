CREATE TYPE "CommercialDisciplineId" AS ENUM (
  'brand_positioning',
  'acquisition',
  'conversion_closing',
  'growth_retention',
  'commercial_operations'
);

CREATE TYPE "CommercialDisciplineRecordCategory" AS ENUM (
  'research_note',
  'competitor_intelligence',
  'brand_voice',
  'messaging_library',
  'pr_partnership',
  'paid_media',
  'seo_keyword',
  'influencer_partnership',
  'attribution',
  'approved_script',
  'objection_handling',
  'closer_feedback',
  'cro_note',
  'upsell_ascension',
  'platinum_elite',
  'b2b_account',
  'trainer_network',
  'loyalty_lifecycle',
  'crm_data_quality',
  'tech_stack',
  'reporting_schedule',
  'training_library'
);

CREATE TYPE "CommercialDisciplineRecordStatus" AS ENUM (
  'draft',
  'active',
  'blocked',
  'completed',
  'archived'
);

CREATE TYPE "CommercialDisciplineRecordPriority" AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TABLE "commercial_discipline_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "discipline" "CommercialDisciplineId" NOT NULL,
  "category" "CommercialDisciplineRecordCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "details" TEXT,
  "status" "CommercialDisciplineRecordStatus" NOT NULL DEFAULT 'active',
  "priority" "CommercialDisciplineRecordPriority" NOT NULL DEFAULT 'medium',
  "source_type" TEXT NOT NULL DEFAULT 'manual',
  "revenue_line_id" UUID,
  "commercial_plan_id" UUID,
  "event_id" UUID,
  "owner_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commercial_discipline_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commercial_discipline_records_tenant_key_idx" ON "commercial_discipline_records"("tenant_key");
CREATE INDEX "commercial_discipline_records_discipline_idx" ON "commercial_discipline_records"("discipline");
CREATE INDEX "commercial_discipline_records_category_idx" ON "commercial_discipline_records"("category");
CREATE INDEX "commercial_discipline_records_status_idx" ON "commercial_discipline_records"("status");
CREATE INDEX "commercial_discipline_records_priority_idx" ON "commercial_discipline_records"("priority");
CREATE INDEX "commercial_discipline_records_revenue_line_id_idx" ON "commercial_discipline_records"("revenue_line_id");
CREATE INDEX "commercial_discipline_records_commercial_plan_id_idx" ON "commercial_discipline_records"("commercial_plan_id");
CREATE INDEX "commercial_discipline_records_event_id_idx" ON "commercial_discipline_records"("event_id");
CREATE INDEX "commercial_discipline_records_owner_user_id_idx" ON "commercial_discipline_records"("owner_user_id");

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_revenue_line_id_fkey"
  FOREIGN KEY ("revenue_line_id") REFERENCES "commercial_revenue_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_commercial_plan_id_fkey"
  FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_discipline_records"
  ADD CONSTRAINT "commercial_discipline_records_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
