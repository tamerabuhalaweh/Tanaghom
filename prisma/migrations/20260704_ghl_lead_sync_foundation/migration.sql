-- Sprint B - GHL Two-Way Lead Sync Foundation
-- Adds GHL source-of-truth lead mirror fields and an auditable sync run ledger.

CREATE TYPE "LeadSourceOfTruth" AS ENUM ('tanaghum', 'gohighlevel');
CREATE TYPE "GhlLeadSyncMode" AS ENUM ('pull_preview', 'pull_sync', 'write_back_preview', 'write_back');
CREATE TYPE "GhlLeadSyncStatus" AS ENUM ('requires_credentials', 'mapping_required', 'blocked', 'previewed', 'synced', 'failed');

ALTER TABLE "lead_capture_records"
  ADD COLUMN "source_of_truth" "LeadSourceOfTruth" NOT NULL DEFAULT 'tanaghum',
  ADD COLUMN "external_source_provider" TEXT,
  ADD COLUMN "external_source_id" TEXT,
  ADD COLUMN "external_opportunity_id" TEXT,
  ADD COLUMN "external_pipeline_id" TEXT,
  ADD COLUMN "external_stage_id" TEXT,
  ADD COLUMN "external_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "external_last_synced_at" TIMESTAMP(3),
  ADD COLUMN "external_sync_fingerprint" TEXT;

CREATE TABLE "ghl_lead_sync_runs" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "event_id" UUID,
  "mode" "GhlLeadSyncMode" NOT NULL,
  "status" "GhlLeadSyncStatus" NOT NULL,
  "source_of_truth" "LeadSourceOfTruth" NOT NULL DEFAULT 'gohighlevel',
  "contacts_pulled" INTEGER NOT NULL DEFAULT 0,
  "opportunities_pulled" INTEGER NOT NULL DEFAULT 0,
  "leads_upserted" INTEGER NOT NULL DEFAULT 0,
  "tags_mapped" INTEGER NOT NULL DEFAULT 0,
  "stages_mapped" INTEGER NOT NULL DEFAULT 0,
  "write_backs_prepared" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  "warnings" JSONB,
  "raw_payload_returned" BOOLEAN NOT NULL DEFAULT false,
  "created_by_user_id" UUID NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "ghl_lead_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_capture_records_source_of_truth_idx" ON "lead_capture_records"("source_of_truth");
CREATE INDEX "lead_capture_records_external_source_provider_idx" ON "lead_capture_records"("external_source_provider");
CREATE INDEX "lead_capture_records_external_source_id_idx" ON "lead_capture_records"("external_source_id");
CREATE INDEX "lead_capture_records_external_opportunity_id_idx" ON "lead_capture_records"("external_opportunity_id");
CREATE INDEX "lead_capture_records_external_last_synced_at_idx" ON "lead_capture_records"("external_last_synced_at");

CREATE INDEX "ghl_lead_sync_runs_tenant_key_idx" ON "ghl_lead_sync_runs"("tenant_key");
CREATE INDEX "ghl_lead_sync_runs_event_id_idx" ON "ghl_lead_sync_runs"("event_id");
CREATE INDEX "ghl_lead_sync_runs_mode_idx" ON "ghl_lead_sync_runs"("mode");
CREATE INDEX "ghl_lead_sync_runs_status_idx" ON "ghl_lead_sync_runs"("status");
CREATE INDEX "ghl_lead_sync_runs_created_by_user_id_idx" ON "ghl_lead_sync_runs"("created_by_user_id");
CREATE INDEX "ghl_lead_sync_runs_started_at_idx" ON "ghl_lead_sync_runs"("started_at");

ALTER TABLE "ghl_lead_sync_runs"
  ADD CONSTRAINT "ghl_lead_sync_runs_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ghl_lead_sync_runs"
  ADD CONSTRAINT "ghl_lead_sync_runs_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ghl_lead_sync_runs"
  ADD CONSTRAINT "ghl_lead_sync_runs_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
