-- CreateEnum
CREATE TYPE "ConnectorImportState" AS ENUM ('draft', 'requires_credentials', 'ready_for_test', 'test_passed', 'blocked', 'disabled');

-- CreateEnum
CREATE TYPE "ConnectorCredentialState" AS ENUM ('customer_credential_missing', 'configured', 'test_not_run', 'test_passed', 'blocked_by_provider_approval');

-- CreateTable
CREATE TABLE "connector_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID,
    "connector_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "state" "ConnectorImportState" NOT NULL DEFAULT 'draft',
    "credential_state" "ConnectorCredentialState" NOT NULL DEFAULT 'customer_credential_missing',
    "notes" TEXT,
    "last_dry_run_at" TIMESTAMP(3),
    "last_dry_run_result" JSONB,
    "last_import_at" TIMESTAMP(3),
    "last_import_result" JSONB,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "disabled_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connector_import_jobs_tenant_key_idx" ON "connector_import_jobs"("tenant_key");
CREATE INDEX "connector_import_jobs_event_id_idx" ON "connector_import_jobs"("event_id");
CREATE INDEX "connector_import_jobs_connector_id_idx" ON "connector_import_jobs"("connector_id");
CREATE INDEX "connector_import_jobs_state_idx" ON "connector_import_jobs"("state");
CREATE INDEX "connector_import_jobs_created_by_user_id_idx" ON "connector_import_jobs"("created_by_user_id");

ALTER TABLE "connector_import_jobs" ADD CONSTRAINT "connector_import_jobs_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connector_import_jobs" ADD CONSTRAINT "connector_import_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connector_import_jobs" ADD CONSTRAINT "connector_import_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connector_import_jobs" ADD CONSTRAINT "connector_import_jobs_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
