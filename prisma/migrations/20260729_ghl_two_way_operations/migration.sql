ALTER TYPE "ApprovalTargetType" ADD VALUE IF NOT EXISTS 'external_operation';

ALTER TABLE "lead_capture_records"
  ADD COLUMN "external_appointment_id" TEXT;

CREATE INDEX "lead_capture_records_external_appointment_id_idx"
  ON "lead_capture_records"("external_appointment_id");

CREATE TYPE "GhlOperationType" AS ENUM (
  'contact_upsert',
  'contact_tags_update',
  'opportunity_upsert',
  'appointment_upsert',
  'whatsapp_send'
);

CREATE TYPE "GhlOperationStatus" AS ENUM (
  'previewed',
  'pending_approval',
  'approved',
  'executing',
  'provider_accepted',
  'reconciled',
  'rejected',
  'cancelled',
  'blocked',
  'failed',
  'reconciliation_failed',
  'expired'
);

CREATE TYPE "GhlReconciliationStatus" AS ENUM (
  'pending',
  'confirmed',
  'failed',
  'not_required'
);

CREATE TYPE "GhlWebhookProcessingStatus" AS ENUM (
  'received',
  'processed',
  'duplicate',
  'rejected',
  'failed'
);

CREATE TABLE "ghl_operation_commands" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "event_id" UUID,
  "commercial_plan_id" UUID,
  "lead_id" UUID,
  "stitchi_action_run_id" UUID,
  "operation_type" "GhlOperationType" NOT NULL,
  "status" "GhlOperationStatus" NOT NULL DEFAULT 'previewed',
  "reconciliation_status" "GhlReconciliationStatus" NOT NULL DEFAULT 'pending',
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "preview_hash" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "input_payload" JSONB NOT NULL,
  "preview_payload" JSONB NOT NULL,
  "provider_endpoint" TEXT NOT NULL,
  "provider_object_id" TEXT,
  "provider_contact_id" TEXT,
  "provider_opportunity_id" TEXT,
  "provider_appointment_id" TEXT,
  "provider_message_id" TEXT,
  "provider_response_status" INTEGER,
  "provider_result" JSONB,
  "failure_reason" TEXT,
  "approval_id" UUID,
  "capability_resolution_id" UUID,
  "mcp_mediation_request_id" UUID,
  "mcp_mediation_decision_id" UUID,
  "requested_by_user_id" UUID NOT NULL,
  "requested_by_agent_rep_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "approved_by_agent_rep_id" UUID,
  "approved_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "execution_lease_id" TEXT,
  "execution_lease_expires_at" TIMESTAMP(3),
  "reconciled_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "raw_secrets_returned" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ghl_operation_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ghl_operation_commands_tenant_key_fkey"
    FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_commercial_plan_id_fkey"
    FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "lead_capture_records"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_stitchi_action_run_id_fkey"
    FOREIGN KEY ("stitchi_action_run_id") REFERENCES "stitchi_action_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ghl_operation_commands_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ghl_operation_commands_tenant_key_idempotency_key_key"
  ON "ghl_operation_commands"("tenant_key", "idempotency_key");
CREATE INDEX "ghl_operation_commands_tenant_key_idx" ON "ghl_operation_commands"("tenant_key");
CREATE INDEX "ghl_operation_commands_event_id_idx" ON "ghl_operation_commands"("event_id");
CREATE INDEX "ghl_operation_commands_commercial_plan_id_idx" ON "ghl_operation_commands"("commercial_plan_id");
CREATE INDEX "ghl_operation_commands_lead_id_idx" ON "ghl_operation_commands"("lead_id");
CREATE INDEX "ghl_operation_commands_stitchi_action_run_id_idx" ON "ghl_operation_commands"("stitchi_action_run_id");
CREATE INDEX "ghl_operation_commands_operation_type_idx" ON "ghl_operation_commands"("operation_type");
CREATE INDEX "ghl_operation_commands_status_idx" ON "ghl_operation_commands"("status");
CREATE INDEX "ghl_operation_commands_status_execution_lease_expires_at_idx"
  ON "ghl_operation_commands"("status", "execution_lease_expires_at");
CREATE INDEX "ghl_operation_commands_reconciliation_status_idx" ON "ghl_operation_commands"("reconciliation_status");
CREATE INDEX "ghl_operation_commands_provider_object_id_idx" ON "ghl_operation_commands"("provider_object_id");
CREATE INDEX "ghl_operation_commands_provider_contact_id_idx" ON "ghl_operation_commands"("provider_contact_id");
CREATE INDEX "ghl_operation_commands_provider_opportunity_id_idx" ON "ghl_operation_commands"("provider_opportunity_id");
CREATE INDEX "ghl_operation_commands_provider_appointment_id_idx" ON "ghl_operation_commands"("provider_appointment_id");
CREATE INDEX "ghl_operation_commands_provider_message_id_idx" ON "ghl_operation_commands"("provider_message_id");
CREATE INDEX "ghl_operation_commands_requested_by_user_id_idx" ON "ghl_operation_commands"("requested_by_user_id");
CREATE INDEX "ghl_operation_commands_requested_by_agent_rep_id_idx" ON "ghl_operation_commands"("requested_by_agent_rep_id");
CREATE INDEX "ghl_operation_commands_approved_by_user_id_idx" ON "ghl_operation_commands"("approved_by_user_id");
CREATE INDEX "ghl_operation_commands_approved_by_agent_rep_id_idx" ON "ghl_operation_commands"("approved_by_agent_rep_id");
CREATE INDEX "ghl_operation_commands_created_at_idx" ON "ghl_operation_commands"("created_at");

CREATE TABLE "ghl_webhook_events" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "signature_verified" BOOLEAN NOT NULL DEFAULT false,
  "processing_status" "GhlWebhookProcessingStatus" NOT NULL DEFAULT 'received',
  "provider_object_id" TEXT,
  "location_id" TEXT,
  "summary" JSONB,
  "error_summary" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),

  CONSTRAINT "ghl_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ghl_webhook_events_tenant_key_fkey"
    FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ghl_webhook_events_tenant_key_provider_event_id_key"
  ON "ghl_webhook_events"("tenant_key", "provider_event_id");
CREATE INDEX "ghl_webhook_events_tenant_key_idx" ON "ghl_webhook_events"("tenant_key");
CREATE INDEX "ghl_webhook_events_event_type_idx" ON "ghl_webhook_events"("event_type");
CREATE INDEX "ghl_webhook_events_processing_status_idx" ON "ghl_webhook_events"("processing_status");
CREATE INDEX "ghl_webhook_events_provider_object_id_idx" ON "ghl_webhook_events"("provider_object_id");
CREATE INDEX "ghl_webhook_events_received_at_idx" ON "ghl_webhook_events"("received_at");
