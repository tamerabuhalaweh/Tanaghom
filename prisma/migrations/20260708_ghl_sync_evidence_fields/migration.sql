-- R1 - GHL production read-sync evidence fields.
-- Stores the provider read path and elapsed sync duration for audit/release evidence.

ALTER TABLE "ghl_lead_sync_runs"
  ADD COLUMN "provider_endpoint" TEXT,
  ADD COLUMN "duration_ms" INTEGER;

