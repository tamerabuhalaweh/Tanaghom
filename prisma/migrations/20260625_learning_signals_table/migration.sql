DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningSignalType') THEN
    CREATE TYPE "LearningSignalType" AS ENUM ('performance', 'quality', 'compliance', 'efficiency', 'risk', 'pattern');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningSignalStatus') THEN
    CREATE TYPE "LearningSignalStatus" AS ENUM ('observed', 'review_pending', 'accepted', 'rejected', 'converted_to_dks', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "learning_signals" (
  "id" UUID NOT NULL,
  "signal_type" "LearningSignalType" NOT NULL,
  "signal_category" TEXT,
  "source_event_id" UUID,
  "source_audit_record_id" UUID,
  "source_run_id" UUID,
  "source_artifact_id" UUID,
  "saif_decision_record_id" UUID,
  "dks_entry_id" UUID,
  "signal_summary" TEXT,
  "confidence" "Confidence" NOT NULL DEFAULT 'low',
  "strength" DOUBLE PRECISION,
  "observed_outcome" TEXT,
  "expected_outcome" TEXT,
  "variance" TEXT,
  "recommendation" TEXT,
  "status" "LearningSignalStatus" NOT NULL DEFAULT 'observed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_user_id" UUID,
  "reviewed_by_agent_rep_id" UUID,
  CONSTRAINT "learning_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "learning_signals_signal_type_idx" ON "learning_signals"("signal_type");
CREATE INDEX IF NOT EXISTS "learning_signals_signal_category_idx" ON "learning_signals"("signal_category");
CREATE INDEX IF NOT EXISTS "learning_signals_status_idx" ON "learning_signals"("status");
CREATE INDEX IF NOT EXISTS "learning_signals_saif_decision_record_id_idx" ON "learning_signals"("saif_decision_record_id");
CREATE INDEX IF NOT EXISTS "learning_signals_dks_entry_id_idx" ON "learning_signals"("dks_entry_id");
CREATE INDEX IF NOT EXISTS "learning_signals_source_event_id_idx" ON "learning_signals"("source_event_id");
CREATE INDEX IF NOT EXISTS "learning_signals_source_run_id_idx" ON "learning_signals"("source_run_id");
CREATE INDEX IF NOT EXISTS "learning_signals_created_at_idx" ON "learning_signals"("created_at");
