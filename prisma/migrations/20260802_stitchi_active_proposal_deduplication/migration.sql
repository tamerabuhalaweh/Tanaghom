ALTER TABLE "stitchi_action_runs"
  ADD COLUMN IF NOT EXISTS "proposal_fingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "stitchi_action_runs_active_proposal_fingerprint_key"
  ON "stitchi_action_runs"(
    "tenant_key",
    "conversation_id",
    "user_id",
    "proposal_fingerprint"
  )
  WHERE "proposal_fingerprint" IS NOT NULL
    AND "status" IN ('proposed', 'awaiting_approval', 'approved', 'running');
