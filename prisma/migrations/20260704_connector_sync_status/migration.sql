-- Sprint A - Production KPI Connector Backbone
-- Adds explicit sync contract fields to connector import jobs.

CREATE TYPE "ConnectorSyncStatus" AS ENUM (
  'not_started',
  'requires_credentials',
  'ready_for_sync',
  'synced',
  'failed',
  'blocked'
);

ALTER TABLE "connector_import_jobs"
  ADD COLUMN "sync_status" "ConnectorSyncStatus" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "last_sync_at" TIMESTAMP(3),
  ADD COLUMN "last_sync_rows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_sync_error" TEXT,
  ADD COLUMN "last_sync_audit_record_id" UUID;

UPDATE "connector_import_jobs"
SET
  "sync_status" = CASE
    WHEN "disabled_at" IS NOT NULL THEN 'blocked'::"ConnectorSyncStatus"
    WHEN "last_import_at" IS NOT NULL THEN 'synced'::"ConnectorSyncStatus"
    WHEN "state" = 'requires_credentials' THEN 'requires_credentials'::"ConnectorSyncStatus"
    WHEN "state" = 'test_passed' THEN 'ready_for_sync'::"ConnectorSyncStatus"
    WHEN "state" = 'blocked' THEN 'failed'::"ConnectorSyncStatus"
    ELSE 'not_started'::"ConnectorSyncStatus"
  END,
  "last_sync_at" = "last_import_at";

CREATE INDEX "connector_import_jobs_sync_status_idx" ON "connector_import_jobs"("sync_status");
CREATE INDEX "connector_import_jobs_last_sync_at_idx" ON "connector_import_jobs"("last_sync_at");
