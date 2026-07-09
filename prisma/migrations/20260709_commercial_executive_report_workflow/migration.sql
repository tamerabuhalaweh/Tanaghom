ALTER TABLE "commercial_executive_report_schedules"
  ADD COLUMN "recipient_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "report_language" TEXT NOT NULL DEFAULT 'English',
  ADD COLUMN "report_sections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "kpi_policy" JSONB,
  ADD COLUMN "working_days_only" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "send_hour" INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN "send_minute" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_delivery_attempt_at" TIMESTAMP(3),
  ADD COLUMN "last_delivery_status" TEXT;

ALTER TABLE "commercial_executive_report_schedules"
  ALTER COLUMN "approval_required" SET DEFAULT false;

UPDATE "commercial_executive_report_schedules"
SET
  "recipient_roles" = CASE WHEN cardinality("recipient_roles") = 0 THEN ARRAY['admin', 'cco']::TEXT[] ELSE "recipient_roles" END,
  "report_sections" = CASE WHEN cardinality("report_sections") = 0 THEN ARRAY[
    'executive_summary',
    'revenue_lines',
    'channel_performance',
    'lead_funnel',
    'data_freshness',
    'connector_readiness',
    'department_work',
    'alerts',
    'missing_data'
  ]::TEXT[] ELSE "report_sections" END,
  "approval_required" = false
WHERE "status" = 'active';
