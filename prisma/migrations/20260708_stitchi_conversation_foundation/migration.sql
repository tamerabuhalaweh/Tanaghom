DO $$ BEGIN
  CREATE TYPE "StitchiConversationStatus" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StitchiMessageRole" AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StitchiActionRunStatus" AS ENUM ('proposed', 'awaiting_approval', 'approved', 'rejected', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StitchiActionRiskLevel" AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StitchiApprovalDecision" AS ENUM ('approved', 'rejected', 'changes_requested');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "stitchi_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "event_id" UUID,
  "title" TEXT NOT NULL,
  "status" "StitchiConversationStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stitchi_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stitchi_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" "StitchiMessageRole" NOT NULL DEFAULT 'user',
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stitchi_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stitchi_action_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_type" TEXT NOT NULL,
  "status" "StitchiActionRunStatus" NOT NULL DEFAULT 'proposed',
  "input_payload" JSONB NOT NULL,
  "preview_payload" JSONB,
  "result_payload" JSONB,
  "requires_approval" BOOLEAN NOT NULL DEFAULT false,
  "risk_level" "StitchiActionRiskLevel" NOT NULL DEFAULT 'low',
  "audit_record_id" UUID,
  "langgraph_thread_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "stitchi_action_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stitchi_action_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "action_run_id" UUID NOT NULL,
  "approver_user_id" UUID NOT NULL,
  "decision" "StitchiApprovalDecision" NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stitchi_action_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stitchi_conversations_tenant_key_idx" ON "stitchi_conversations"("tenant_key");
CREATE INDEX IF NOT EXISTS "stitchi_conversations_user_id_idx" ON "stitchi_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "stitchi_conversations_event_id_idx" ON "stitchi_conversations"("event_id");
CREATE INDEX IF NOT EXISTS "stitchi_conversations_status_idx" ON "stitchi_conversations"("status");

CREATE INDEX IF NOT EXISTS "stitchi_messages_tenant_key_idx" ON "stitchi_messages"("tenant_key");
CREATE INDEX IF NOT EXISTS "stitchi_messages_conversation_id_idx" ON "stitchi_messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "stitchi_messages_role_idx" ON "stitchi_messages"("role");
CREATE INDEX IF NOT EXISTS "stitchi_messages_created_at_idx" ON "stitchi_messages"("created_at");

CREATE INDEX IF NOT EXISTS "stitchi_action_runs_tenant_key_idx" ON "stitchi_action_runs"("tenant_key");
CREATE INDEX IF NOT EXISTS "stitchi_action_runs_conversation_id_idx" ON "stitchi_action_runs"("conversation_id");
CREATE INDEX IF NOT EXISTS "stitchi_action_runs_user_id_idx" ON "stitchi_action_runs"("user_id");
CREATE INDEX IF NOT EXISTS "stitchi_action_runs_action_type_idx" ON "stitchi_action_runs"("action_type");
CREATE INDEX IF NOT EXISTS "stitchi_action_runs_status_idx" ON "stitchi_action_runs"("status");

CREATE INDEX IF NOT EXISTS "stitchi_action_approvals_tenant_key_idx" ON "stitchi_action_approvals"("tenant_key");
CREATE INDEX IF NOT EXISTS "stitchi_action_approvals_action_run_id_idx" ON "stitchi_action_approvals"("action_run_id");
CREATE INDEX IF NOT EXISTS "stitchi_action_approvals_approver_user_id_idx" ON "stitchi_action_approvals"("approver_user_id");
CREATE INDEX IF NOT EXISTS "stitchi_action_approvals_decision_idx" ON "stitchi_action_approvals"("decision");

ALTER TABLE "stitchi_conversations"
  ADD CONSTRAINT "stitchi_conversations_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_conversations"
  ADD CONSTRAINT "stitchi_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_conversations"
  ADD CONSTRAINT "stitchi_conversations_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stitchi_messages"
  ADD CONSTRAINT "stitchi_messages_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_messages"
  ADD CONSTRAINT "stitchi_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "stitchi_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_runs"
  ADD CONSTRAINT "stitchi_action_runs_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_runs"
  ADD CONSTRAINT "stitchi_action_runs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "stitchi_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_runs"
  ADD CONSTRAINT "stitchi_action_runs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_approvals"
  ADD CONSTRAINT "stitchi_action_approvals_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_approvals"
  ADD CONSTRAINT "stitchi_action_approvals_action_run_id_fkey"
  FOREIGN KEY ("action_run_id") REFERENCES "stitchi_action_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stitchi_action_approvals"
  ADD CONSTRAINT "stitchi_action_approvals_approver_user_id_fkey"
  FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
