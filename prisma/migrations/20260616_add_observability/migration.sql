-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('success', 'failure', 'blocked', 'denied', 'deferred', 'escalated', 'cancelled');

-- CreateEnum
CREATE TYPE "LearningSignalType" AS ENUM ('performance', 'quality', 'compliance', 'efficiency', 'risk', 'pattern');

-- CreateEnum
CREATE TYPE "LearningSignalStatus" AS ENUM ('observed', 'under_review', 'accepted', 'rejected', 'superseded');

-- CreateTable
CREATE TABLE "observability_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

-- CreateTable
CREATE TABLE "audit_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

-- CreateTable
CREATE TABLE "learning_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signal_type" "LearningSignalType" NOT NULL,
    "signal_category" TEXT,
    "source_event_id" UUID,
    "source_audit_record_id" UUID,
    "source_run_id" UUID,
    "source_artifact_id" UUID,
    "saif_decision_record_id" UUID,
    "dks_entry_id" UUID,
    "signal_summary" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'low',
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

-- CreateIndex
CREATE INDEX "observability_events_event_type_idx" ON "observability_events"("event_type");

-- CreateIndex
CREATE INDEX "observability_events_event_category_idx" ON "observability_events"("event_category");

-- CreateIndex
CREATE INDEX "observability_events_severity_idx" ON "observability_events"("severity");

-- CreateIndex
CREATE INDEX "observability_events_human_user_id_idx" ON "observability_events"("human_user_id");

-- CreateIndex
CREATE INDEX "observability_events_agent_rep_id_idx" ON "observability_events"("agent_rep_id");

-- CreateIndex
CREATE INDEX "observability_events_target_object_type_target_object_id_idx" ON "observability_events"("target_object_type", "target_object_id");

-- CreateIndex
CREATE INDEX "observability_events_saif_decision_record_id_idx" ON "observability_events"("saif_decision_record_id");

-- CreateIndex
CREATE INDEX "observability_events_approval_id_idx" ON "observability_events"("approval_id");

-- CreateIndex
CREATE INDEX "observability_events_capability_resolution_id_idx" ON "observability_events"("capability_resolution_id");

-- CreateIndex
CREATE INDEX "observability_events_mcp_mediation_request_id_idx" ON "observability_events"("mcp_mediation_request_id");

-- CreateIndex
CREATE INDEX "observability_events_run_id_idx" ON "observability_events"("run_id");

-- CreateIndex
CREATE INDEX "observability_events_artifact_id_idx" ON "observability_events"("artifact_id");

-- CreateIndex
CREATE INDEX "observability_events_occurred_at_idx" ON "observability_events"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_records_audit_type_idx" ON "audit_records"("audit_type");

-- CreateIndex
CREATE INDEX "audit_records_action_idx" ON "audit_records"("action");

-- CreateIndex
CREATE INDEX "audit_records_result_idx" ON "audit_records"("result");

-- CreateIndex
CREATE INDEX "audit_records_human_user_id_idx" ON "audit_records"("human_user_id");

-- CreateIndex
CREATE INDEX "audit_records_agent_rep_id_idx" ON "audit_records"("agent_rep_id");

-- CreateIndex
CREATE INDEX "audit_records_target_object_type_target_object_id_idx" ON "audit_records"("target_object_type", "target_object_id");

-- CreateIndex
CREATE INDEX "audit_records_saif_decision_record_id_idx" ON "audit_records"("saif_decision_record_id");

-- CreateIndex
CREATE INDEX "audit_records_approval_id_idx" ON "audit_records"("approval_id");

-- CreateIndex
CREATE INDEX "audit_records_capability_resolution_id_idx" ON "audit_records"("capability_resolution_id");

-- CreateIndex
CREATE INDEX "audit_records_spine_run_id_idx" ON "audit_records"("spine_run_id");

-- CreateIndex
CREATE INDEX "audit_records_created_at_idx" ON "audit_records"("created_at");

-- CreateIndex
CREATE INDEX "learning_signals_signal_type_idx" ON "learning_signals"("signal_type");

-- CreateIndex
CREATE INDEX "learning_signals_signal_category_idx" ON "learning_signals"("signal_category");

-- CreateIndex
CREATE INDEX "learning_signals_status_idx" ON "learning_signals"("status");

-- CreateIndex
CREATE INDEX "learning_signals_saif_decision_record_id_idx" ON "learning_signals"("saif_decision_record_id");

-- CreateIndex
CREATE INDEX "learning_signals_dks_entry_id_idx" ON "learning_signals"("dks_entry_id");

-- CreateIndex
CREATE INDEX "learning_signals_source_event_id_idx" ON "learning_signals"("source_event_id");

-- CreateIndex
CREATE INDEX "learning_signals_source_run_id_idx" ON "learning_signals"("source_run_id");

-- CreateIndex
CREATE INDEX "learning_signals_created_at_idx" ON "learning_signals"("created_at");
