CREATE TYPE "CommercialExecutiveReportCadence" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom');

CREATE TYPE "CommercialExecutiveReportStatus" AS ENUM ('preview', 'generated', 'approved_send_ready', 'archived');

CREATE TYPE "CommercialExecutiveReportDeliveryChannel" AS ENUM ('dashboard', 'email', 'whatsapp');

CREATE TYPE "CommercialExecutiveReportScheduleStatus" AS ENUM ('active', 'paused', 'archived');

CREATE TABLE "commercial_executive_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "cadence" "CommercialExecutiveReportCadence" NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "status" "CommercialExecutiveReportStatus" NOT NULL DEFAULT 'preview',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "filters" JSONB,
  "metrics" JSONB NOT NULL,
  "alerts" JSONB NOT NULL,
  "missing_sources" JSONB NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'low',
  "preview_payload" JSONB NOT NULL,
  "generated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commercial_executive_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commercial_executive_report_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "cadence" "CommercialExecutiveReportCadence" NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "delivery_channels" "CommercialExecutiveReportDeliveryChannel"[] NOT NULL DEFAULT ARRAY['dashboard']::"CommercialExecutiveReportDeliveryChannel"[],
  "status" "CommercialExecutiveReportScheduleStatus" NOT NULL DEFAULT 'active',
  "approval_required" BOOLEAN NOT NULL DEFAULT true,
  "next_run_at" TIMESTAMP(3),
  "last_preview_report_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commercial_executive_report_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commercial_executive_reports_tenant_key_idx" ON "commercial_executive_reports"("tenant_key");
CREATE INDEX "commercial_executive_reports_cadence_idx" ON "commercial_executive_reports"("cadence");
CREATE INDEX "commercial_executive_reports_status_idx" ON "commercial_executive_reports"("status");
CREATE INDEX "commercial_executive_reports_period_start_period_end_idx" ON "commercial_executive_reports"("period_start", "period_end");
CREATE INDEX "commercial_executive_reports_generated_by_user_id_idx" ON "commercial_executive_reports"("generated_by_user_id");

CREATE INDEX "commercial_executive_report_schedules_tenant_key_idx" ON "commercial_executive_report_schedules"("tenant_key");
CREATE INDEX "commercial_executive_report_schedules_cadence_idx" ON "commercial_executive_report_schedules"("cadence");
CREATE INDEX "commercial_executive_report_schedules_status_idx" ON "commercial_executive_report_schedules"("status");
CREATE INDEX "commercial_executive_report_schedules_next_run_at_idx" ON "commercial_executive_report_schedules"("next_run_at");
CREATE INDEX "commercial_executive_report_schedules_created_by_user_id_idx" ON "commercial_executive_report_schedules"("created_by_user_id");

ALTER TABLE "commercial_executive_reports"
  ADD CONSTRAINT "commercial_executive_reports_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_executive_reports"
  ADD CONSTRAINT "commercial_executive_reports_generated_by_user_id_fkey"
  FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_executive_report_schedules"
  ADD CONSTRAINT "commercial_executive_report_schedules_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_executive_report_schedules"
  ADD CONSTRAINT "commercial_executive_report_schedules_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
