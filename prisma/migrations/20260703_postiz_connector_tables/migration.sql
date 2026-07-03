-- Sprint 65 follow-up: create legacy Postiz connector governance tables used by
-- event/channel readiness. These models existed in Prisma schema but were missing
-- from the migration history, causing deployed readiness checks to return 500.

DO $$ BEGIN
  CREATE TYPE "PostizConnectorStatus" AS ENUM ('active', 'inactive', 'planned', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('active', 'inactive', 'disconnected', 'placeholder');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExecutionRequestStatus" AS ENUM ('pending', 'validating', 'ready', 'executing', 'completed', 'blocked', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExecutionMode" AS ENUM ('mock', 'simulated', 'live');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RequestedAction" AS ENUM ('prepare_draft', 'prepare_schedule', 'publish');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostizJobStatus" AS ENUM ('pending', 'preparing', 'prepared', 'scheduled', 'published', 'failed', 'cancelled', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "postiz_connectors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "connector_name" TEXT NOT NULL,
  "connector_status" "PostizConnectorStatus" NOT NULL DEFAULT 'planned',
  "mcp_connector_id" UUID,
  "implementation_id" UUID,
  "target_system" TEXT NOT NULL DEFAULT 'Postiz',
  "base_url_placeholder" TEXT,
  "credential_binding_id" TEXT,
  "supports_draft" BOOLEAN NOT NULL DEFAULT true,
  "supports_schedule" BOOLEAN NOT NULL DEFAULT true,
  "supports_publish" BOOLEAN NOT NULL DEFAULT false,
  "m4_allowed" BOOLEAN NOT NULL DEFAULT true,
  "m5_allowed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "postiz_connectors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "postiz_connectors_connector_name_key" ON "postiz_connectors"("connector_name");
CREATE INDEX IF NOT EXISTS "postiz_connectors_connector_status_idx" ON "postiz_connectors"("connector_status");

CREATE TABLE IF NOT EXISTS "postiz_account_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "postiz_connector_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "account_reference_placeholder" TEXT,
  "account_display_name" TEXT,
  "account_status" "AccountStatus" NOT NULL DEFAULT 'placeholder',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "postiz_account_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "postiz_account_references_postiz_connector_id_idx" ON "postiz_account_references"("postiz_connector_id");
CREATE INDEX IF NOT EXISTS "postiz_account_references_platform_idx" ON "postiz_account_references"("platform");

DO $$ BEGIN
  ALTER TABLE "postiz_account_references"
    ADD CONSTRAINT "postiz_account_references_postiz_connector_id_fkey"
    FOREIGN KEY ("postiz_connector_id") REFERENCES "postiz_connectors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "publishing_execution_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publishing_package_id" UUID NOT NULL,
  "publishing_manifest_id" UUID,
  "postiz_connector_id" UUID NOT NULL,
  "capability_resolution_id" UUID,
  "mcp_mediation_request_id" UUID,
  "mcp_mediation_decision_id" UUID,
  "spine_run_id" UUID,
  "approval_id" UUID,
  "saif_decision_record_id" UUID,
  "requested_by_user_id" UUID NOT NULL,
  "requested_by_agent_rep_id" UUID NOT NULL,
  "request_status" "ExecutionRequestStatus" NOT NULL DEFAULT 'pending',
  "execution_mode" "ExecutionMode" NOT NULL DEFAULT 'mock',
  "requested_action" "RequestedAction" NOT NULL DEFAULT 'prepare_draft',
  "blocked_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publishing_execution_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "publishing_execution_requests_publishing_package_id_idx" ON "publishing_execution_requests"("publishing_package_id");
CREATE INDEX IF NOT EXISTS "publishing_execution_requests_request_status_idx" ON "publishing_execution_requests"("request_status");
CREATE INDEX IF NOT EXISTS "publishing_execution_requests_requested_by_user_id_idx" ON "publishing_execution_requests"("requested_by_user_id");

DO $$ BEGIN
  ALTER TABLE "publishing_execution_requests"
    ADD CONSTRAINT "publishing_execution_requests_postiz_connector_id_fkey"
    FOREIGN KEY ("postiz_connector_id") REFERENCES "postiz_connectors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "postiz_publishing_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publishing_execution_request_id" UUID NOT NULL,
  "publishing_package_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "account_reference_id" UUID,
  "job_status" "PostizJobStatus" NOT NULL DEFAULT 'pending',
  "postiz_external_reference_placeholder" TEXT,
  "scheduled_at" TIMESTAMP(3),
  "timezone" TEXT,
  "payload_hash" TEXT,
  "payload_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "postiz_publishing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "postiz_publishing_jobs_publishing_execution_request_id_idx" ON "postiz_publishing_jobs"("publishing_execution_request_id");
CREATE INDEX IF NOT EXISTS "postiz_publishing_jobs_publishing_package_id_idx" ON "postiz_publishing_jobs"("publishing_package_id");
CREATE INDEX IF NOT EXISTS "postiz_publishing_jobs_job_status_idx" ON "postiz_publishing_jobs"("job_status");

DO $$ BEGIN
  ALTER TABLE "postiz_publishing_jobs"
    ADD CONSTRAINT "postiz_publishing_jobs_publishing_execution_request_id_fkey"
    FOREIGN KEY ("publishing_execution_request_id") REFERENCES "publishing_execution_requests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "postiz_publishing_jobs"
    ADD CONSTRAINT "postiz_publishing_jobs_account_reference_id_fkey"
    FOREIGN KEY ("account_reference_id") REFERENCES "postiz_account_references"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "postiz_connectors" (
  "id",
  "connector_name",
  "connector_status",
  "target_system",
  "base_url_placeholder",
  "credential_binding_id",
  "supports_draft",
  "supports_schedule",
  "supports_publish",
  "m4_allowed",
  "m5_allowed",
  "updated_at"
) VALUES (
  '00000000-0000-4000-8000-000000000073',
  'Postiz Scheduling Connector',
  'active',
  'Postiz',
  'tenant-owned-postiz-base-url',
  'tenant:postiz:api_key',
  true,
  true,
  false,
  true,
  false,
  CURRENT_TIMESTAMP
) ON CONFLICT ("connector_name") DO UPDATE SET
  "connector_status" = 'active',
  "supports_schedule" = true,
  "supports_publish" = false,
  "m5_allowed" = false,
  "updated_at" = CURRENT_TIMESTAMP;
