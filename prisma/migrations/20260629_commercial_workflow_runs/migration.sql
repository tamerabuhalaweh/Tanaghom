DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommercialWorkflowRunStatus') THEN
    CREATE TYPE "CommercialWorkflowRunStatus" AS ENUM ('active', 'blocked', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommercialWorkflowStageId') THEN
    CREATE TYPE "CommercialWorkflowStageId" AS ENUM ('brief', 'draft', 'optimize', 'approval', 'package', 'postiz', 'analytics', 'leads', 'evidence');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommercialWorkflowStepStatus') THEN
    CREATE TYPE "CommercialWorkflowStepStatus" AS ENUM ('done', 'active', 'waiting', 'blocked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "commercial_workflow_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "campaign_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_by_agent_rep_id" UUID,
  "status" "CommercialWorkflowRunStatus" NOT NULL DEFAULT 'active',
  "active_stage" "CommercialWorkflowStageId" NOT NULL DEFAULT 'brief',
  "readiness_score" INTEGER NOT NULL DEFAULT 0,
  "blockers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source" TEXT NOT NULL DEFAULT 'STITCH',
  "metadata" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "commercial_workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commercial_workflow_steps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "stage_id" "CommercialWorkflowStageId" NOT NULL,
  "step_status" "CommercialWorkflowStepStatus" NOT NULL,
  "summary" TEXT NOT NULL,
  "blocking_reason" TEXT,
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commercial_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commercial_workflow_run_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "audit_record_id" UUID,
  "action" TEXT NOT NULL,
  "result" "AuditResult" NOT NULL,
  "source_module" TEXT,
  "target_object_type" TEXT,
  "target_object_id" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commercial_workflow_run_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_runs_tenant_key_fkey') THEN
    ALTER TABLE "commercial_workflow_runs"
      ADD CONSTRAINT "commercial_workflow_runs_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_runs_campaign_id_fkey') THEN
    ALTER TABLE "commercial_workflow_runs"
      ADD CONSTRAINT "commercial_workflow_runs_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "content_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_runs_created_by_user_id_fkey') THEN
    ALTER TABLE "commercial_workflow_runs"
      ADD CONSTRAINT "commercial_workflow_runs_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_runs_created_by_agent_rep_id_fkey') THEN
    ALTER TABLE "commercial_workflow_runs"
      ADD CONSTRAINT "commercial_workflow_runs_created_by_agent_rep_id_fkey"
      FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_steps_run_id_fkey') THEN
    ALTER TABLE "commercial_workflow_steps"
      ADD CONSTRAINT "commercial_workflow_steps_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "commercial_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commercial_workflow_run_events_run_id_fkey') THEN
    ALTER TABLE "commercial_workflow_run_events"
      ADD CONSTRAINT "commercial_workflow_run_events_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "commercial_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "commercial_workflow_runs_tenant_key_idx" ON "commercial_workflow_runs"("tenant_key");
CREATE INDEX IF NOT EXISTS "commercial_workflow_runs_campaign_id_idx" ON "commercial_workflow_runs"("campaign_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_runs_created_by_user_id_idx" ON "commercial_workflow_runs"("created_by_user_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_runs_status_idx" ON "commercial_workflow_runs"("status");
CREATE INDEX IF NOT EXISTS "commercial_workflow_runs_active_stage_idx" ON "commercial_workflow_runs"("active_stage");

CREATE UNIQUE INDEX IF NOT EXISTS "commercial_workflow_steps_run_id_stage_id_key" ON "commercial_workflow_steps"("run_id", "stage_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_steps_run_id_idx" ON "commercial_workflow_steps"("run_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_steps_stage_id_idx" ON "commercial_workflow_steps"("stage_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_steps_step_status_idx" ON "commercial_workflow_steps"("step_status");

CREATE INDEX IF NOT EXISTS "commercial_workflow_run_events_run_id_idx" ON "commercial_workflow_run_events"("run_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_run_events_audit_record_id_idx" ON "commercial_workflow_run_events"("audit_record_id");
CREATE INDEX IF NOT EXISTS "commercial_workflow_run_events_action_idx" ON "commercial_workflow_run_events"("action");
CREATE INDEX IF NOT EXISTS "commercial_workflow_run_events_result_idx" ON "commercial_workflow_run_events"("result");
CREATE INDEX IF NOT EXISTS "commercial_workflow_run_events_created_at_idx" ON "commercial_workflow_run_events"("created_at");
