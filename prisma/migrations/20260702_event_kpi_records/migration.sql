-- Sprint 60: Per-event KPI records for manual/imported/connector performance tracking.

CREATE TYPE "EventKpiSourceType" AS ENUM ('manual', 'imported', 'connector');

CREATE TABLE "event_kpi_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "source_type" "EventKpiSourceType" NOT NULL DEFAULT 'manual',
    "source_name" TEXT NOT NULL DEFAULT 'manual',
    "metric_date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'manual',
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "form_completions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "meetings_booked" INTEGER NOT NULL DEFAULT 0,
    "meetings_attended" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "no_shows" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_kpi_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_kpi_records_tenant_key_idx" ON "event_kpi_records"("tenant_key");
CREATE INDEX "event_kpi_records_event_id_idx" ON "event_kpi_records"("event_id");
CREATE INDEX "event_kpi_records_metric_date_idx" ON "event_kpi_records"("metric_date");
CREATE INDEX "event_kpi_records_channel_idx" ON "event_kpi_records"("channel");
CREATE INDEX "event_kpi_records_source_type_idx" ON "event_kpi_records"("source_type");

ALTER TABLE "event_kpi_records"
  ADD CONSTRAINT "event_kpi_records_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_kpi_records"
  ADD CONSTRAINT "event_kpi_records_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
