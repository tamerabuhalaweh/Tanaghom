ALTER TABLE "ghl_lead_sync_runs"
ADD COLUMN IF NOT EXISTS "appointments_pulled" INTEGER NOT NULL DEFAULT 0;
