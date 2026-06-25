DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventSeverity') THEN
    CREATE TYPE "EventSeverity" AS ENUM ('info', 'warning', 'error', 'critical');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditResult') THEN
    CREATE TYPE "AuditResult" AS ENUM ('success', 'failure', 'blocked', 'denied', 'deferred', 'escalated', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "observability_events" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_category" TEXT NOT NULL,
  "severity" "EventSeverity" NOT NULL DEFAULT 'info',
  "human_user_id" UUID,
  "agent_rep_id" UUID,
  "acting_agent_type" TEXT,
  "acting_agent_id" TEXT,
  "source_substrate" TEXT,
  "source_module" TEXT,
  "target_object_type" TEXT,
  "target_object_id" TEXT,
  "run_id" UUID,
  "artifact_id" UUID,
  "saif_decision_record_id" UUID,
  "approval_id" UUID,
  "capability_resolution_id" UUID,
  "mcp_mediation_request_id" UUID,
  "payload_summary" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observability_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "observability_events_event_type_idx" ON "observability_events"("event_type");
CREATE INDEX IF NOT EXISTS "observability_events_event_category_idx" ON "observability_events"("event_category");
CREATE INDEX IF NOT EXISTS "observability_events_severity_idx" ON "observability_events"("severity");
CREATE INDEX IF NOT EXISTS "observability_events_human_user_id_idx" ON "observability_events"("human_user_id");
CREATE INDEX IF NOT EXISTS "observability_events_agent_rep_id_idx" ON "observability_events"("agent_rep_id");
CREATE INDEX IF NOT EXISTS "observability_events_target_object_type_target_object_id_idx" ON "observability_events"("target_object_type", "target_object_id");
CREATE INDEX IF NOT EXISTS "observability_events_saif_decision_record_id_idx" ON "observability_events"("saif_decision_record_id");
CREATE INDEX IF NOT EXISTS "observability_events_approval_id_idx" ON "observability_events"("approval_id");
CREATE INDEX IF NOT EXISTS "observability_events_capability_resolution_id_idx" ON "observability_events"("capability_resolution_id");
CREATE INDEX IF NOT EXISTS "observability_events_mcp_mediation_request_id_idx" ON "observability_events"("mcp_mediation_request_id");
CREATE INDEX IF NOT EXISTS "observability_events_run_id_idx" ON "observability_events"("run_id");
CREATE INDEX IF NOT EXISTS "observability_events_artifact_id_idx" ON "observability_events"("artifact_id");
CREATE INDEX IF NOT EXISTS "observability_events_occurred_at_idx" ON "observability_events"("occurred_at");

CREATE TABLE IF NOT EXISTS "audit_records" (
  "id" UUID NOT NULL,
  "audit_type" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "result" "AuditResult" NOT NULL,
  "human_user_id" UUID,
  "agent_rep_id" UUID,
  "acting_agent_type" TEXT,
  "acting_agent_id" TEXT,
  "target_object_type" TEXT,
  "target_object_id" TEXT,
  "source_substrate" TEXT,
  "source_module" TEXT,
  "reason" TEXT,
  "rationale" TEXT,
  "before_state" JSONB,
  "after_state" JSONB,
  "risk_category" TEXT,
  "policy_matched" TEXT,
  "saif_decision_record_id" UUID,
  "approval_id" UUID,
  "capability_resolution_id" UUID,
  "mcp_mediation_decision_id" UUID,
  "spine_run_id" UUID,
  "spine_artifact_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_records_audit_type_idx" ON "audit_records"("audit_type");
CREATE INDEX IF NOT EXISTS "audit_records_action_idx" ON "audit_records"("action");
CREATE INDEX IF NOT EXISTS "audit_records_result_idx" ON "audit_records"("result");
CREATE INDEX IF NOT EXISTS "audit_records_human_user_id_idx" ON "audit_records"("human_user_id");
CREATE INDEX IF NOT EXISTS "audit_records_agent_rep_id_idx" ON "audit_records"("agent_rep_id");
CREATE INDEX IF NOT EXISTS "audit_records_target_object_type_target_object_id_idx" ON "audit_records"("target_object_type", "target_object_id");
CREATE INDEX IF NOT EXISTS "audit_records_saif_decision_record_id_idx" ON "audit_records"("saif_decision_record_id");
CREATE INDEX IF NOT EXISTS "audit_records_approval_id_idx" ON "audit_records"("approval_id");
CREATE INDEX IF NOT EXISTS "audit_records_capability_resolution_id_idx" ON "audit_records"("capability_resolution_id");
CREATE INDEX IF NOT EXISTS "audit_records_spine_run_id_idx" ON "audit_records"("spine_run_id");
CREATE INDEX IF NOT EXISTS "audit_records_created_at_idx" ON "audit_records"("created_at");
