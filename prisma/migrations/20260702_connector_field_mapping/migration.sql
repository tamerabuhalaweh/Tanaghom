-- CreateEnum
CREATE TYPE "MappingTargetType" AS ENUM ('event_kpi_record', 'lead_attribution');

-- CreateEnum
CREATE TYPE "MappingValidationStatus" AS ENUM ('valid', 'invalid', 'untested');

-- CreateTable
CREATE TABLE "connector_field_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "event_id" UUID,
    "display_name" TEXT NOT NULL,
    "target_type" "MappingTargetType" NOT NULL DEFAULT 'event_kpi_record',
    "field_mappings" JSONB NOT NULL,
    "validation_status" "MappingValidationStatus" NOT NULL DEFAULT 'untested',
    "validation_errors" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_field_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connector_field_mappings_tenant_key_idx" ON "connector_field_mappings"("tenant_key");
CREATE INDEX "connector_field_mappings_connector_id_idx" ON "connector_field_mappings"("connector_id");
CREATE INDEX "connector_field_mappings_event_id_idx" ON "connector_field_mappings"("event_id");
CREATE INDEX "connector_field_mappings_created_by_user_id_idx" ON "connector_field_mappings"("created_by_user_id");

ALTER TABLE "connector_field_mappings" ADD CONSTRAINT "connector_field_mappings_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connector_field_mappings" ADD CONSTRAINT "connector_field_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connector_field_mappings" ADD CONSTRAINT "connector_field_mappings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
